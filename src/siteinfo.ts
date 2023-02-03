export interface SiteInfoDef {
    name: string;
    url: string;
    signin?: boolean;
    signinLinkXPath?: string;
    signinSuccessXPath?: string;
    signinDoneXPath?: string;
    searchUrl?: string;
    searchXPath?: string;
    torrentXPath?: string;
    linkXPath?: string;
    downloadXPath?: string;
    fileXPath?: string;
    titleXPath?: string;
    sizeXPath?: string;
    seedXPath?: string;
    downXPath?: string;
    finishXPath?: string;
};

export class SiteInfo implements SiteInfoDef {
    name = ''
    url = '';
    signin = true;
    signinLinkXPath = '//a[@href="attendance.php"]';
    signinSuccessXPath = '//td[@id="outer"]//p[contains(text(),"这是您的第")]';
    signinDoneXPath = '//table[@id="info_block"]//text()[contains(.,"签到已得")]';
    searchUrl = '/torrents.php?search={0}';
    searchXPath = '//table[@class="searchbox"]';
    torrentXPath = '//table[@class="torrents"]/tbody/tr/td/table[@class="torrentname"]/../..';
    linkXPath = './td[2]//table/tbody/tr/td/a/@href';
    downloadXPath = './/a[contains(@href,"download")]/@href';
    fileXPath = './td[2]//table/tbody/tr/td/a/@title';
    titleXPath = './td[2]//table/tbody/tr/td/a/../br/following-sibling::text()[last()]';
    sizeXPath = './td[5]';
    seedXPath = './td[6]';
    downXPath = './td[7]';
    finishXPath = './td[8]';

    def: SiteInfoDef;

    static ByName: { [name: string]: SiteInfo } = {};
    static Order: string[] = [];
    static OnUpdate: (() => void)[] = [];
    static InitPromise: Promise<void>;

    constructor(def: SiteInfoDef) {
        this.def = def;
        Object.assign(this, def);
    }

    SearchUrl(txt: string) {
        return this.FullUrl(this.searchUrl, txt);
    }

    FullUrl(path: string, txt?: string) {
        let url = this.url;
        if (url.charAt(url.length - 1) != '/') {
            url += '/';
        }
        if (path.charAt(0) == '/') {
            path = path.substring(1);
        }
        if (txt === undefined) return url + path;
        return url + path.replace('{0}', encodeURIComponent(txt));
    }

    static GetList() {
        const sites: SiteInfo[] = [];
        for (const siteName of SiteInfo.Order) {
            const site = SiteInfo.ByName[siteName];
            if (site) sites.push(site);
        }
        return sites;
    }

    static CallUpdate() {
        for (const func of SiteInfo.OnUpdate) {
            func();
        }
    }
}

chrome.storage.sync.onChanged.addListener(changes => {
    for (const key in changes) {
        const value = changes[key].newValue;
        if (key == 'order') {
            SiteInfo.Order = value;
        } if (key.startsWith('@')) {
            if (value) {
                const site = new SiteInfo(value);
                SiteInfo.ByName[site.name] = site;
            } else {
                delete SiteInfo.ByName[key.substring(1)];
            }
        }
    }
    SiteInfo.CallUpdate();
});

async function init() {
    const items = await chrome.storage.sync.get(null);
    for (const key in items) {
        const value = items[key];
        if (key == 'order') {
            SiteInfo.Order = value;
        } else if (key.startsWith('@')) {
            const site = new SiteInfo(value);
            SiteInfo.ByName[site.name] = site;
        }
    }
    SiteInfo.CallUpdate();
}

SiteInfo.InitPromise = init();
