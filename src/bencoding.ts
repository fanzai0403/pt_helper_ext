import { BencodingDict } from "./common";

const decoder = new TextDecoder('utf8');

class BuffReader {
    view: Uint8Array;
    pos: number;

    constructor(buff: ArrayBufferLike) {
        this.view = new Uint8Array(buff)
        this.pos = 0;
    }

    go(n: number) {
        this.pos += n;
        console.assert(this.pos >= 0);
        console.assert(this.pos <= this.view.byteLength);
    }

    readChar(): string {
        const c = this.view[this.pos]
        this.go(1);
        return String.fromCharCode(c);
    }

    readBytes(n: number): Uint8Array {
        const p = this.pos;
        this.go(n);
        return this.view.slice(p, this.pos);
    }

    readInt(end = 'e'): number {
        let s = "";
        while (true) {
            const c = this.readChar();
            if (c == end) break;
            console.assert(c >= '0' && c <= '9');
            s += c;
        }
        console.assert(s.length > 0);
        return parseInt(s);
    }

    readBin(): Uint8Array {
        const len = this.readInt(':');
        return this.readBytes(len);
    }

    readStr(): string {
        const bytes = this.readBin();
        return decoder.decode(bytes);
    }

    readArray(): any[] {
        let array = [];
        while (true) {
            const c = this.readChar();
            if (c == 'e') break;
            this.go(-1);
            array.push(this.readValue());
        }
        return array;
    }

    readDict(): BencodingDict {
        const dict: BencodingDict = {
            _pos_start: this.pos - 1,
            _pos_end: 0,
        };
        while (true) {
            const c = this.readChar();
            if (c == 'e') break;
            if (c != 'u') this.go(-1);
            const key = this.readStr();
            const value = this.readValue(key == 'pieces');
            dict[key] = value;
        }
        dict._pos_end = this.pos;
        return dict;
    }

    readValue(bin: boolean = false): any {
        const c = this.readChar();
        switch (c) {
            case 'n':
                return null;
            case 't':
                return true;
            case 'f':
                return false;
            case 'i':
                return this.readInt();
            case 'u':
                return this.readStr();
            case 'l':
                return this.readArray();
            case 'd':
                return this.readDict();
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                this.go(-1);
                return bin ? this.readBin() : this.readStr();
            default:
                console.error('unknown type: ', c);
        }
    }
}

export function BencodingRead(buff: ArrayBufferLike): any {
    return new BuffReader(buff).readValue();
}
