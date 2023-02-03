import { TorrentDataInfo } from "./common";

export class FileCompare {
    fullPath: string;
    fileName: string;
    dirPath: string;
    size: number;
    CRC: number;
    name: string;
    extName: string;
    nameSplit: string[];
    keyName: string | null;
    index: number;

    constructor(info: TorrentDataInfo, index = -1, offset = 0) {
        if (index >= 0) {
            const file = info.files![index];
            this.fullPath = file.path.join('/');
            this.fileName = file.path[file.path.length - 1];
            this.dirPath = file.path.slice(0, file.path.length - 1).join('/');
            this.size = file.length;
            let CRC = 0x1;
            if (file.length > 0) {
                const pieceLength = info['piece length'];
                const end = offset + this.size;
                CRC += offset % pieceLength;
                CRC = Adler32(info.pieces, Math.floor(offset / pieceLength) * 20, Math.floor((end - 1) / pieceLength + 1) * 20, CRC);
                CRC += end % pieceLength;
                CRC &= 0xffffffff;
                CRC >>>= 0;
            }
            this.CRC = CRC;
        } else {
            this.fullPath = this.fileName = info.name;
            this.dirPath = '';
            this.size = info.length;
            this.CRC = Adler32(info.pieces, 0, info.pieces.byteLength);
        }
        const i = this.fileName.lastIndexOf('.');
        if (i > 0) {
            this.name = this.fileName.substring(0, i);
            this.extName = this.fileName.substring(i);
        } else {
            this.name = this.fileName;
            this.extName = '';
        }
        this.nameSplit = this.name.split(/[\. ]/g);
        this.keyName = null;
        this.index = index;
    }

    compare(other: FileCompare) {
        if (this.size != other.size) return 0;
        let d = Math.abs(this.index - other.index);
        let idxs = d >= 5 ? 0 : (5 - d) * .02 - .01;
        if (this.CRC == other.CRC) return .9 + idxs;
        if (this.fullPath == other.fullPath) return .8 + idxs;
        if (this.extName != other.extName) return .1 + idxs;
        if (this.name == other.name) return .7 + idxs;
        if (this.keyName == null || other.keyName == null) return .3 + idxs;
        if (this.keyName == other.keyName) return .6 + idxs;
        if (this.keyName.indexOf(other.keyName) >= 0 || other.keyName.indexOf(this.keyName) >= 0) return .5 + idxs;
        return .2 + idxs;
    }

    calcKeyName(others: FileCompare[]) {
        let keyCount: { [keyName: string]: number; } = {};
        for (const other of others) {
            if (other == this) continue;
            if (other.dirPath != this.dirPath) continue;
            if (other.extName != this.extName) continue;
            let kn = GetKeyName(this.nameSplit, other.nameSplit);
            if (!kn) continue;
            keyCount[kn] = (keyCount[kn] ?? 0) + 1;
        }
        let mc: number = 0;
        for (const key in keyCount) {
            const count = keyCount[key];
            if (count > mc) {
                mc = count;
                this.keyName = key;
            }
        }
    }
}

function GetKeyName(ns1: string[], ns2: string[]): string | null {
    let bi: number, ei: number;
    for (bi = 0; ; bi++) {
        if (bi >= ns1.length || bi >= ns2.length)
            return null;
        if (ns1[bi] != ns2[bi])
            break;
    }
    for (ei = 0; ; ei++) {
        if (ei >= ns1.length || ei >= ns2.length)
            return null;
        if (ns1[ns1.length - ei - 1] != ns2[ns2.length - ei - 1])
            break;
    }
    const c = ns1.length - bi - ei;
    if (c >= ns1.length / 2 || c <= 0 || ns2.length - bi - ei <= 0)
        return null;
    return ns1.slice(bi, bi + c).join('.');
}

function Adler32(buf: Uint8Array, begin: number, end: number, old: number = 0x1) {
    let s1 = old & 0xffff;
    let s2 = old >>> 16;
    for (let i = begin; i < end; i++) {
        s1 = (s1 + buf[i]) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    return ((s2 << 16) + s1) >>> 0;
}
