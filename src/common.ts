export interface SearchResult {
    file: string;
    title: string;
    size: string;
    seed: string;
    down: string;
    finish: string;
    link: string;
    download: string;
    sizeNumber: number;
}

export interface MessageInfo {
    action: string;
    siteName?: string;
    param: any;
}

export interface TorrentData extends BencodingDict {
    info: TorrentDataInfo;
}

export interface TorrentDataInfo extends BencodingDict {
    files?: TorrentDataFile[];
    length: number;
    name: string;
    ['piece length']: number;
    pieces: Uint8Array;
}

export interface TorrentDataFile extends BencodingDict {
    length: number;
    path: string[];
}

export interface BencodingDict {
    _pos_start: number;
    _pos_end: number;
    [key: string]: any;
}

export interface SiteJobData {
    tabId?: number;
    url?: string;
    status: string;
    jobDone: boolean;
}

export function Size2Txt(size: number): string {
    if (size < 1024) return size.toString();
    if (size < 1024 * 1024) return (size / 1024).toFixed(2) + 'K';
    if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(2) + 'M';
    return (size / 1024 / 1024 / 1024).toFixed(2) + 'G';
}

export function TxtToSize(txt: string) {
    txt = txt.replace(/,/g, '').toLowerCase();
    let b = 1;
    function removeEnd(str: string) {
        if (!txt.endsWith(str)) return false;
        txt = txt.substring(0, txt.length - str.length);
        return true;
    }

    removeEnd('b');
    removeEnd('i');
    if (removeEnd('k')) b *= 1024;
    if (removeEnd('m')) b *= 1024 * 1024;
    if (removeEnd('g')) b *= 1024 * 1024 * 1024;
    if (removeEnd('t')) b *= 1024 * 1024 * 1024 * 1024;

    return Math.round(parseFloat(txt) * b);
}

export function setShowHide(panelId: string, showId: string, hideId: string, callBack?: (show: boolean) => void): (show: boolean) => void {
    const panel = document.getElementById(panelId)!;
    const btnShow = document.getElementById(showId)!;
    const btnHide = document.getElementById(hideId)!;
    function showAll(show: boolean) {
        panel.style.display = show ? '' : 'none';
        btnShow.style.display = !show ? '' : 'none';
        btnHide.style.display = show ? '' : 'none';
        if (callBack) callBack(show);
    }
    btnShow.onclick = () => { showAll(true); return false; };
    btnHide.onclick = () => { showAll(false); return false; };
    return showAll;
}

export function sendMessage(action: string, param?: any) {
    return chrome.runtime.sendMessage({ action: action, param: param } as MessageInfo);
}
