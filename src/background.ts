import { MessageInfo, SiteJobData } from "./common";
import { SiteInfo } from "./siteinfo";

class CSiteJob {
    siteName: string;
    job: CJob;
    data: SiteJobData;

    constructor(siteName: string, job: CJob) {
        this.siteName = siteName;
        this.job = job;
        this.data = {
            status: '_',
            jobDone: false,
        };
    }

    sendMessage(action: string, param?: any) {
        if (this.data.tabId) {
            chrome.tabs.sendMessage(this.data.tabId, { action: action, param: param } as MessageInfo);
        }
    }

    async openUrl(url: string, active = false): Promise<boolean> {
        let tab = await this.getTab();
        if (tab) {
            chrome.tabs.update(tab.id!, { url: url, active: active });
            return false;
        }
        tab = await chrome.tabs.create({ url: url, active: active });
        const data = this.data;
        if (data.tabId) delete tabs[data.tabId];
        data.tabId = tab.id!;
        tabs[data.tabId] = this;
        return true;
    }

    getTab(): Promise<chrome.tabs.Tab | undefined> {
        return new Promise(resolve => {
            if (!this.data.tabId) {
                resolve(undefined);
                return;
            }
            chrome.tabs.get(this.data.tabId)
                .then(t => resolve(t))
                .catch(() => resolve(undefined));
        });
    }
};

interface JobSaveData {
    job: string;
    groupId?: number;
    sites: { [siteName: string]: SiteJobData };
}

class CJob {
    job: string;
    key: string;
    port?: chrome.runtime.Port;
    groupId?: number;
    sites: { [siteName: string]: CSiteJob } = {};
    saveTimer: any;

    constructor(job: string, key: string, port?: chrome.runtime.Port) {
        this.job = job;
        this.key = key;
        this.port = port;
    }

    async openUrl(siteName: string, url: string, active = false): Promise<boolean> {
        const sj = this.getOrCreate(siteName);
        if (!await sj.openUrl(url, active))
            return false;
        this.groupId = await CJob.groupTab(sj.data.tabId!, this.groupId);
        return true;
    }

    static groupTab(tabId: number, groupId?: number): Promise<number> {
        return new Promise<number>(resolve => {
            chrome.tabs.group({ tabIds: tabId, groupId: groupId })
                .then(resolve)
                .catch(() => chrome.tabs.group({ tabIds: tabId }).then(resolve));
        });
    }

    async activeSite(siteName: string) {
        const tab = await this.sites[siteName]?.getTab();
        if (!tab) return false;
        chrome.tabs.highlight({ tabs: tab.index });
        return true;
    }

    async startJob(siteName: string, url?: string, status = '...') {
        const sj = this.getOrCreate(siteName);
        if (!sj) return;
        sj.data.jobDone = false;
        sj.data.url = url;
        sj.data.status = status;
        this.updateSite(siteName);
        if (url) {
            await this.openUrl(siteName, url);
        }
    }

    async createTabs(urls: { [siteName: string]: string }, otherStatus = '_') {
        for (const site of SiteInfo.GetList()) {
            const url = urls[site.name];
            await this.startJob(site.name, url, url ? undefined : otherStatus);
        }
    }

    clearTabs() {
        const ids: number[] = [];
        for (const siteName in this.sites) {
            const sj = this.sites[siteName];
            if (sj.data.tabId) {
                ids.push(sj.data.tabId);
                sj.data.tabId = undefined;
            }
        }
        chrome.tabs.remove(ids).catch(() => null);
        this.groupId = undefined;
    }

    updateSite(siteName: string) {
        const sj = this.sites[siteName];
        this.portMessage('update', siteName, sj?.data);
    }

    portMessage(action: string, siteName: string, param?: any) {
        if (this.port) {
            this.port.postMessage({ action: action, siteName: siteName, param: param } as MessageInfo);
        }
    }

    doSaveData() {
        this.saveTimer = null;
        console.log(`save: job:${this.key} sites:${Object.keys(this.sites).length}`);
        const data: JobSaveData = { job: this.job, groupId: this.groupId, sites: {} };
        for (const siteName in this.sites) {
            data.sites[siteName] = this.sites[siteName].data;
        }
        chrome.storage.session.set({ [this.key]: data });
    }

    applySaveData() {
        if (!this.saveTimer)
            this.saveTimer = setTimeout(() => this.doSaveData(), 1000);
    }

    loadData(data: JobSaveData) {
        this.groupId = data.groupId;
        for (const site of SiteInfo.GetList()) {
            const sjd = data.sites[site.name];
            if (!sjd) continue;
            const sj = this.getOrCreate(site.name);
            sj.data = sjd;
            if (sjd.tabId) tabs[sjd.tabId] = sj;
        }
        console.log(`load: job:${this.key} sites:${Object.keys(this.sites).length}`);
    }

    getOrCreate(siteName: string): CSiteJob {
        let sj = this.sites[siteName];
        if (!sj) {
            sj = this.sites[siteName] = new CSiteJob(siteName, this);
            sj.data.status = '_';
        }
        return sj;
    }
};

const tabs: { [tabId: number]: CSiteJob } = {};
const jobs: { [job: string]: CJob } = {};

const TabHandler: { [action: string]: { (sj: CSiteJob, param: any): void }; } = {};

TabHandler.job = (sj, _param) => {
    if (sj.data.jobDone) return;
    return {
        job: sj.job.job,
        siteName: sj.siteName,
    }
}

TabHandler.status = (sj, param) => {
    sj.data.status = param.status;
    if (param.done) sj.data.jobDone = true;
    sj.job.updateSite(sj.siteName);
    sj.job.applySaveData();
}

TabHandler.result = (sj, param) => {
    sj.job.portMessage('result', sj.siteName, param);
}


interface PortFunc { (job: CJob, param: any): Promise<void> | void };
const PortHandler: { [action: string]: PortFunc } = {};

PortHandler.syncData = job => {
    for (const site of SiteInfo.GetList()) {
        job.getOrCreate(site.name);
        job.updateSite(site.name);
    }
};

PortHandler.createTabs = (job, param) => {
    job.applySaveData();
    return job.createTabs(param.urls, param.otherStatus);
}

PortHandler.clearTabs = job => {
    job.clearTabs();
    job.applySaveData();
}

PortHandler.activeSite = async (job, param) => {
    if (!SiteInfo.ByName[param.siteName]) return;
    if (await job.activeSite(param.siteName)) return;
    if (param.url) await job.openUrl(param.siteName, param.url, true);
    job.applySaveData();
}

PortHandler.startJob = (job, param) => {
    if (!SiteInfo.ByName[param.siteName]) return;
    job.applySaveData();
    return job.startJob(param.siteName, param.url, param.status);
}

chrome.runtime.onMessage.addListener((msg: MessageInfo, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    const sj = tabs[tabId];
    if (!sj) {
        sendResponse(undefined);
        return;
    }
    //console.log('onTabMessage', sj.job.job, sj.siteName, msg);
    const func = TabHandler[msg.action];
    if (!func) {
        console.error(msg.action);
        return;
    }
    const res = func(sj, msg.param);
    sendResponse(res);
});

chrome.runtime.onConnect.addListener(port => {
    let key = port.name;
    let jobName: string;
    if (key.endsWith('.')) {
        jobName = key.substring(0, key.length - 1);
        const tabId = port.sender?.tab?.id ?? 0;
        key += tabId;
    } else {
        jobName = key;
    }
    let job = jobs[key];
    if (job) {
        job.port = port;
    } else {
        job = new CJob(jobName, key, port);
        jobs[key] = job;
    }
    port.onMessage.addListener((msg: MessageInfo) => {
        //console.log('onPortMessage', job.key, msg, msgQueue);
        const func = PortHandler[msg.action];
        if (!func) {
            console.error(msg.action);
            return;
        }
        if (msgQueue) {
            msgQueue.push({ func: func, job: job, param: msg.param });
        } else {
            func(job, msg.param);
        }
    });
    port.onDisconnect.addListener(() => {
        if (job.port == port) {
            job.port = undefined;
        }
    })
});

function saveAll() {
    for (const jobName in jobs) {
        jobs[jobName].doSaveData();
    }
}

let msgQueue: { func: PortFunc, job: CJob, param: any }[] | null = [];

SiteInfo.InitPromise.then(async () => {
    const value = await chrome.storage.session.get(null);
    for (const key in value) {
        let data = value[key] as JobSaveData;
        let job = jobs[key];
        if (!job) {
            job = jobs[key] = new CJob(data.job, key);
        }
        job.loadData(data);
    }
    chrome.runtime.onRestartRequired.addListener(saveAll);
    chrome.runtime.onSuspend.addListener(saveAll);
    for (const msg of msgQueue!) {
        msg.func(msg.job, msg.param);
    }
    msgQueue = null;
});
