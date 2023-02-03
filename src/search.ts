import { SiteInfo } from "./siteinfo";
import { SiteHandler } from "./sitehandler";
import { SearchResult, TorrentData, Size2Txt, setShowHide } from "./common";
import { BencodingRead } from "./bencoding";
import { FileCompare } from "./filecompare";
const sha1 = require("js-sha1");

interface TorrentInfo {
    orgName: string;
    name: string;
    blob: Blob;
    buf: ArrayBuffer;
    data: TorrentData | null;
    hash: string;
};

interface QBData {
    categories: { [key: string]: { name: string } };
    torrents: {
        [hash: string]: {
            category: string;
            progress: number;
            state: string;
        }
    };
};

let qbServer: {
    url?: string;
    username?: string;
    password?: string;
} = {};


const handler = new SiteHandler('search.', 'site_table');
handler.Handler.result = onResult;


const searchTable = document.getElementById('search_table') as HTMLTableElement;
const searchText = document.getElementById('search_text') as HTMLInputElement;

const downTable = document.getElementById('down_table') as HTMLTableElement;

const filesTable = document.getElementById('files_table') as HTMLTableElement;


let torrents: TorrentInfo[] = [];
let downloading = 0;
let qbData: (QBData | null) = null;


document.getElementById('search_form')!.onsubmit = () => {
    doSearch(searchText.value);
    return false;
};

document.getElementById('button_close')!.onclick = () => {
    handler.clearTabs();
};


document.getElementById('button_refresh')!.onclick = refreshQB;


const showSearch = setShowHide('search_table', 'search_show', 'search_hide', show => {
    document.getElementById('search_form')!.style.position = show ? 'fixed' : 'absolute';
    document.getElementById('popup_search')!.style.display = show ? '' : 'none';
});
showSearch(true);
const showDown = setShowHide('down_table', 'down_show', 'down_hide');
showDown(false);
const showAnalyse = setShowHide('files_table', 'files_show', 'files_hide', show => {
    document.getElementById('popup_analyse')!.style.display = show ? '' : 'none';
});
showAnalyse(false);
const showPopup = setShowHide('popup_view', 'button_show', 'button_hide');
showPopup(true);


const onFilesSelect = setSelect(filesTable, 'button_add', 'button_files_all', addTortent);
const onSearchSelect = setSelect(searchTable, 'button_down', 'button_search_all', doDownload);


function setSelect(parent: HTMLElement, doName: string, allName: string, doFunc: (names: string[]) => void): () => void {
    const buttonDo = document.getElementById(doName) as HTMLButtonElement;
    const buttonAll = document.getElementById(allName) as HTMLButtonElement;
    const doText = buttonDo.textContent;

    buttonDo.onclick = () => {
        const checked = parent.querySelectorAll('input[type="checkbox"]:checked');
        const names = Array.from(checked).map(cb => (cb as HTMLInputElement).name);
        doFunc(names);
    };

    buttonAll.onclick = () => {
        const setChecked = !!parent.querySelector('input[type="checkbox"]:not(:checked)');
        for (const cb of parent.querySelectorAll('input[type="checkbox"]')) {
            (cb as HTMLInputElement).checked = setChecked;
        }
        refresh();
    };

    function refresh() {
        const count = parent.querySelectorAll('input[type="checkbox"]:checked').length;
        buttonDo.disabled = count <= 0;
        if (count > 0) {
            buttonDo.textContent = doText + '(' + count + ')';
        } else {
            buttonDo.textContent = doText;
        }
        buttonAll.disabled = !parent.querySelector('input[type="checkbox"]');
    }

    return refresh;
}


function onResult(site: SiteInfo, param: SearchResult[]) {
    const template = searchTable.querySelector('template')!.content.firstElementChild!;
    const removeSet: HTMLElement[] = [];
    for (const row of searchTable.rows) {
        if (row.querySelector('a[name="site"]')?.textContent == site.name) {
            removeSet.push(row);
        }
    }
    for (const elem of removeSet) {
        elem.remove();
    }
    for (const item of param) {
        const element = template.cloneNode(true) as HTMLElement;

        const url = site.FullUrl(item.download);
        const check = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
        element.onclick = elem => {
            const name = (elem.target as HTMLElement).localName;
            if (name != 'a' && name != 'input') {
                check.checked = !check.checked;
                onSearchSelect();
            }
        };

        check.name = url;
        check.onchange = onSearchSelect;

        let a = element.querySelector('a[name="site"]') as HTMLAnchorElement;
        a.textContent = site.name;
        a.href = site.url;
        a.onclick = () => {
            handler.linkSite(site.name);
            return false;
        };

        a = element.querySelector('a[name="file"]') as HTMLAnchorElement;
        a.textContent = item.file;
        a.href = site.FullUrl(item.link);
        a.target = "_blank";

        (element.querySelector('span[name="title"]') as HTMLElement).textContent = item.title;
        (element.querySelector('td[name="size"]') as HTMLElement).textContent = item.size;
        (element.querySelector('td[name="seed"]') as HTMLElement).textContent = item.seed + '/' + item.down + '/' + item.finish;
        (element.querySelector('a[name="download"]') as HTMLAnchorElement).href = url;
        insertRow(item.sizeNumber, element);
    }
    onSearchSelect();
}


function insertRow(value: number, elem: any) {
    const tbody = searchTable.querySelector('tbody')!;
    elem.sortValue = value;
    for (const row of searchTable.rows) {
        const v = (row as any).sortValue as (number | undefined);
        if (v && v < value) {
            tbody.insertBefore(elem, row);
            return;
        }
    }
    tbody.append(elem);
}

async function doSearch(text: string) {
    showSearch(true);
    searchTable.querySelector('tbody')!.innerHTML = '';
    onSearchSelect();
    const urls: { [siteName: string]: string } = {};
    for (const site of SiteInfo.GetList()) {
        urls[site.name] = site.SearchUrl(text);
    }
    handler.createTabs(urls);
}

function doDownload(urls: string[]) {
    showSearch(false);
    showDown(true);
    torrents = [];
    const template = downTable.querySelector('template')!.content.firstElementChild!;
    const tbody = downTable.querySelector('tbody')!;
    tbody.innerHTML = '';
    downloading = urls.length;
    const nameSet: { [name: string]: true; } = {};
    for (const url of urls) {
        const element = template.cloneNode(true) as HTMLElement;
        const name = element.querySelector('td[name="name"]') as HTMLElement;
        name.textContent = url;

        const status = element.querySelector('td[name="status"]') as HTMLElement;
        status.textContent = '连接中...';

        const progress = element.querySelector('div[name="progress"]') as HTMLElement;

        tbody.append(element);

        let orgName: string;
        let filename: string;
        let xhr = new XMLHttpRequest();
        xhr.onprogress = ev => {
            if (!filename) {
                orgName = filename = getFileName(xhr);
                for (let i = 1; nameSet[filename]; i++) {
                    const idx = orgName.lastIndexOf('.');
                    if (idx > 0) {
                        filename = orgName.substring(0, idx) + '_' + i + orgName.substring(idx);
                    } else {
                        filename = orgName + '_' + i;
                    }
                }
                nameSet[filename] = true;
                name.textContent = filename;
            }
            status.textContent = '下载：' + Size2Txt(ev.loaded);
            if (ev.total > 0) progress.style.width = Math.round(ev.loaded * 100 / ev.total) + '%';
        };
        xhr.onload = async ev => {
            if (xhr.status != 200) {
                status.textContent = '错误：' + xhr.status;
                downloadDone();
                return;
            }
            status.textContent = '完成(' + Size2Txt(ev.loaded) + ') ';
            progress.style.width = '100%';
            torrents.push({
                orgName: orgName,
                name: filename,
                blob: xhr.response,
                buf: await xhr.response.arrayBuffer(),
                data: null,
                hash: '',
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(xhr.response);
            a.textContent = '下载';
            a.download = filename;
            status.append(a);
            downloadDone();
        };
        xhr.onerror = ev => {
            console.log('error:', ev);
            status.textContent = '错误';
            downloadDone();
        };
        xhr.open("GET", url, true);
        xhr.responseType = "blob";
        xhr.send();
    }
}

function getFileName(xhr: XMLHttpRequest): string {
    const cd = xhr.getResponseHeader('content-disposition') ?? '';
    //console.log(cd);
    for (let kv of cd.split(';')) {
        kv = kv.trim();
        if (kv.startsWith('filename=')) {
            let filename = kv.substring(9);
            const bytes = new Uint8Array(filename.length);
            for (let i = 0; i < filename.length; i++) {
                bytes[i] = filename.charCodeAt(i);
            }
            filename = new TextDecoder('utf8').decode(bytes);
            if (filename.startsWith('"') && filename.endsWith('"')) {
                filename = filename.substring(1, filename.length - 1).replace(/\\\"/g, '"');
            }
            return decodeURIComponent(filename);
        }
    }

    const ary = xhr.responseURL.split('/');
    return ary[ary.length - 1].split('?')[0];
}

function downloadDone() {
    if (--downloading > 0) return;
    //console.log(torrents);
    showDown(false);
    showAnalyse(true);

    const head = filesTable.querySelector('thead>tr')!;
    for (let i = head.children.length - 1; i >= 1; i--) {
        head.children[i].remove();
    }
    interface Row {
        ary: (FileCompare | null)[];
        size: number;
    }
    const rows: Row[] = [];
    for (const ti in torrents) {
        const torrent = torrents[ti];
        torrent.data = BencodingRead(torrent.buf) as TorrentData;
        //console.log(torrent.data);
        const info = torrent.data.info;
        torrent.hash = sha1(torrent.buf.slice(info._pos_start, info._pos_end));

        const th = document.createElement('th');
        th.colSpan = 3;
        th.textContent = torrent.name;
        head.append(th);

        const files: FileCompare[] = [];
        if (!info.files || info.files.length <= 0) {
            files.push(new FileCompare(info));
        } else {
            let offset = 0;
            for (let i = 0; i < info.files.length; i++) {
                const file = new FileCompare(info, i, offset);
                offset += file.size;
                files.push(file);
            }
            for (const file of files) {
                file.calcKeyName(files);
            }
        }

        for (const file of files) {
            let maxCompare = 0;
            let maxRow: (Row | null) = null;
            for (const row of rows) {
                if (row.ary[ti] || row.size != file.size) continue;
                for (const other of row.ary) {
                    if (!other) continue;
                    let compare = file.compare(other);
                    if (compare > maxCompare) {
                        maxCompare = compare;
                        maxRow = row;
                    }
                    break;
                }
            }
            if (!maxRow) {
                maxRow = {
                    ary: new Array(torrents.length),
                    size: file.size,
                };
                rows.push(maxRow);
            }
            maxRow.ary[ti] = file;
        }
    }
    //console.log(rows);

    refreshQB();

    const tbody = filesTable.querySelector('tbody')!;
    tbody.innerHTML = '';
    for (const row of rows) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = row.size.toString();
        tr.append(th);

        let maxSame = 0;
        let maxFile: FileCompare | null = null;
        for (const file of row.ary) {
            if (!file) continue;
            let same = 0;
            for (const other of row.ary) {
                if (!other) continue;
                if (file.CRC == other.CRC && file.fullPath == other.fullPath) {
                    same++;
                }
            }
            if (same <= maxSame) continue;
            maxSame = same;
            maxFile = file;
            if (same >= torrents.length / 2) break;
        }
        for (const file of row.ary) {
            const td1 = document.createElement('td');
            const td2 = document.createElement('td');
            const td3 = document.createElement('td');
            if (file) {
                td1.textContent = file.index + '.';
                td2.textContent = file.CRC.toString(16);
                if (file.CRC != maxFile?.CRC) td2.style.color = 'red';
                td3.textContent = file.fullPath;
                if (file.fullPath != maxFile?.fullPath) td3.style.color = 'red';
            }
            tr.append(td1, td2, td3);
        }
        tbody.append(tr);
    }
}

function qbLogin() {
    if (!qbServer.url) {
        qbError('未配置QB服务器');
        return;
    }
    if (!qbServer.username || !qbServer.password) {
        qbError('未配置QB用户名、密码');
        return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', qbServer.url + 'api/v2/auth/login', true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=UTF-8');
    xhr.onreadystatechange = () => {
        if (xhr.readyState != 4) return;
        if ((xhr.status === 200) && (xhr.responseText === "Ok."))
            refreshQB();
        else
            qbError('QB用户名或密码无效');
    };
    xhr.onerror = () => {
        qbError(xhr.responseText !== '' ? xhr.responseText : '连接失败。');
    };

    xhr.send(`username=${encodeURIComponent(qbServer.username)}&password=${encodeURIComponent(qbServer.password)}`);
}

function refreshQB() {
    if (!qbServer.url) return;
    const xhr = new XMLHttpRequest();
    xhr.onload = ev => {
        if (xhr.status == 403) {
            qbLogin();
            return;
        }
        if (xhr.status != 200) {
            qbError(xhr.responseText == '' ? xhr.status.toString() : xhr.responseText);
            return;
        }
        qbData = xhr.response;
        showAnalyseMsg('');
        //console.log(qbData);
        showQBData();
    };
    xhr.ontimeout = xhr.onerror = ev => {
        console.log('error:', ev);
        qbError(xhr.responseType == '' || xhr.responseType == 'text' ? xhr.responseText : '未知错误');
    };

    xhr.open('GET', qbServer.url + 'api/v2/sync/maindata', true);
    xhr.responseType = "json";
    xhr.send();
}

function showQBData() {
    if (!qbData) return;
    let qbRow = document.getElementById('qb_row');
    if (!qbRow) {
        qbRow = document.createElement('tr');
        qbRow.id = 'qb_row';
        let th = document.createElement('th');
        th.textContent = 'qBittorrent';
        qbRow.append(th);
        for (const _ in torrents) {
            th = document.createElement('th');
            th.colSpan = 3;
            qbRow.append(th);
        }
        filesTable.querySelector('thead')!.append(qbRow);
    }

    document.getElementById('form_select')!.style.display = '';
    const select = document.getElementById('category') as HTMLSelectElement;
    const oldValue = select.value;
    select.options.length = 1;
    for (const key in qbData.categories) {
        const option = new Option(key, qbData.categories[key].name);
        select.add(option);
    }
    select.value = oldValue;

    for (let i = 0; i < torrents.length; i++) {
        const th = qbRow.children[i + 1];
        const oldCheck = th.querySelector('input[type="checkbox"]:checked');
        th.innerHTML = '';
        const qbFile = qbData.torrents[torrents[i].hash];
        if (qbFile) {
            th.textContent = `【${qbFile.category}】${Math.floor(qbFile.progress * 1000) / 10}% ${qbFile.state}`;
        } else {
            const input = document.createElement('input');
            input.type = "checkbox";
            if (oldCheck) input.checked = true;
            input.onchange = onFilesSelect;
            input.name = i.toString();
            th.append(input);

            (th as HTMLElement).onclick = elem => {
                const name = (elem.target as HTMLElement).localName;
                if (name != 'button' && name != 'input') {
                    input.checked = !input.checked;
                    onFilesSelect();
                }
            };

            const button = document.createElement('button');
            button.textContent = '添加';
            button.onclick = () => addTortent([i.toString()]);
            th.append(button);
        }
    }
    onFilesSelect();
}

function addTortent(ts: string[]) {
    if (!qbServer.url) return;
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = ev => {
        if (xhr.readyState <= 3) return;
        showAnalyseMsg(xhr.status + '-' + xhr.responseText);
        if (!sendNext()) setTimeout(refreshQB, 1000);
    };

    const formData = new FormData();
    formData.append('autoTMM', 'true');
    formData.append('category', (document.getElementById('category') as HTMLSelectElement).value);
    formData.append('paused', (document.getElementById('paused') as HTMLInputElement).checked.toString());
    formData.append('skip_checking', (document.getElementById('skip_checking') as HTMLInputElement).checked.toString());
    formData.append('contentLayout', 'Original');
    formData.append('stopCondition', 'None');
    formData.append('dlLimit', 'NaN');
    formData.append('upLimit', 'NaN');

    let index = 0;
    function sendNext() {
        if (!qbServer.url) return;
        if (index >= ts.length) return false;
        xhr.open('POST', qbServer.url + 'api/v2/torrents/add', true);
        const i = parseInt(ts[index++]);
        formData.set('fileselect[]', torrents[i].blob);
        xhr.send(formData);
        return true;
    }

    sendNext();
}


function qbError(msg: string) {
    document.getElementById('form_select')!.style.display = 'none';
    qbData = null;
    showAnalyseMsg(msg);
}

function showAnalyseMsg(msg: string) {
    document.getElementById('analyse_message')!.textContent = msg;
}


chrome.storage.sync.get('qb', value => qbServerUpdate(value.qb));
chrome.storage.sync.onChanged.addListener(changes => {
    if (changes.qb) qbServerUpdate(changes.qb.newValue);
});

function qbServerUpdate(data: any) {
    qbServer = data ?? {};
    (document.getElementById('link_qb') as HTMLAnchorElement).href = qbServer.url ?? '';
}

function getQueryString(name: string) {
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    const r = window.location.search.substring(1).match(reg);
    if (r != null) {
        return decodeURIComponent(r[2]).replace(/\+/g, ' ');
    };
    return null;
}

onSearchSelect();
onFilesSelect();

SiteInfo.InitPromise.then(() => {
    let q = getQueryString('q');
    if (q != null) {
        searchText.value = q;
        doSearch(q);
    }
});
