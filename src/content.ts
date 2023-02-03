import { SiteInfo } from "./siteinfo";
import { SearchResult, TxtToSize, sendMessage } from "./common";

//console.log('content!', document.URL);

let site: SiteInfo;

let Handler: { [name: string]: { (): void }; } = {}

Handler.search = function () {
    if (!findXPath(site.searchXPath)) {
        setStatus('失败！');
        return;
    }
    let items: SearchResult[] = [];
    let it = document.evaluate(site.torrentXPath, document);
    while (true) {
        let elem = it.iterateNext() as HTMLElement;
        if (!elem) break;
        function getstr(xpath: string) {
            return findXPath(xpath, elem)?.textContent?.trim() ?? '';
        }
        const st = getstr(site.sizeXPath);
        items.push({
            file: getstr(site.fileXPath),
            title: getstr(site.titleXPath),
            size: st,
            seed: getstr(site.seedXPath).replace(/,/g, ''),
            down: getstr(site.downXPath).replace(/,/g, ''),
            finish: getstr(site.finishXPath).replace(/,/g, ''),
            link: getstr(site.linkXPath),
            download: getstr(site.downloadXPath),
            sizeNumber: TxtToSize(st),
        });
    }
    //console.log('search:', items[0]);
    sendMessage('result', items);
    setStatus(`找到${items.length}个`, true);
}

Handler.signin = async function () {
    let elem: HTMLElement | null;
    if (elem = findXPath(site.signinSuccessXPath)) {
        setStatus(elem.textContent!, true);
    } else if (elem = findXPath(site.signinDoneXPath)) {
        let text = elem.textContent?.trim() ?? '';
        let r = text.match(/(\(|\[)(.*)(\]|\))/);
        if (r) text = r[2];
        setStatus(text, true);
    } else if (elem = findXPath(site.signinLinkXPath)) {
        setTimeout(() => elem!.click(), 1000);
        if (!site.signinSuccessXPath) setStatus('(成功)', true);
    } else if (!site.signinDoneXPath) {
        setStatus('(已签)', true);
    } else {
        setStatus('(错误)');
    }
}

function findXPath(path: string, elem?: HTMLElement): HTMLElement | null {
    if (!path) return null;
    return document.evaluate(path, elem ?? document).iterateNext() as HTMLElement;
}

function setStatus(status: string, done = false) {
    sendMessage('status', { status: status, done: done })
}

sendMessage('job').then(param => {
    if (!param) return;
    console.log('onStart:', param);
    site = SiteInfo.ByName[param.siteName];
    Handler[param.job]();
});
