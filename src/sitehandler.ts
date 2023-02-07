import { MessageInfo, SiteJobData } from "./common";
import { SiteInfo } from "./siteinfo";

interface JobInfo {
    row?: HTMLTableRowElement;
    data: SiteJobData;
}

export class SiteHandler {
    job: string;
    port?: chrome.runtime.Port;
    jobs: { [siteName: string]: JobInfo } = {};
    table?: HTMLTableElement;
    tbody?: HTMLTableSectionElement;
    Handler: { [action: string]: (site: SiteInfo, param?: any) => void } = {};

    constructor(job: string, tableName?: string, sync = true) {
        this.job = job;
        if (tableName) {
            this.table = document.getElementById(tableName) as HTMLTableElement;
            if (this.table) {
                const thead = document.createElement('thead');
                thead.innerHTML = '<tr><th>站点</th><th>信息</th><th>操作</th></tr>';
                this.table.append(thead);
                this.tbody = document.createElement('tbody');
                this.table.append(this.tbody);
                const tfoot = document.createElement('tfoot');
                tfoot.innerHTML = '<tr><th colspan="3">当前站点均为例子数据，请前往<a href="/options.html" target="pt_options">《配置》</a>。<br/>详情可查看<a href="/readme.html" target="bt_readme">《说明》</a>。</th></tr>';
                this.table.append(tfoot);
            }
        }

        this.Handler.update = this.onSiteJobUpdate;

        this.getPort();
        if (sync) {
            this.portMessage('syncData');
        }
    }

    getPort(): chrome.runtime.Port {
        if (this.port) return this.port;
        this.port = chrome.runtime.connect({ name: this.job });

        this.port.onMessage.addListener((msg: MessageInfo) => {
            //console.log('onPortMessage', this.job, msg);
            const func = this.Handler[msg.action];
            if (!func) {
                console.error(msg.action);
                return;
            }
            const site = SiteInfo.ByName[msg.siteName!];
            func.call(this, site, msg.param);
        });

        this.port.onDisconnect.addListener(() => this.port = undefined);

        return this.port;
    }

    createRow(site: SiteInfo, data: SiteJobData) {
        if (!this.tbody) return undefined;

        const tr = document.createElement('tr');

        const td1 = document.createElement('td');
        const a = document.createElement('a');
        a.textContent = site.name;
        a.href = site.url;
        a.target = '_blank';
        a.onclick = () => { this.linkSite(site.name); return false };
        td1.append(a);
        tr.append(td1);

        const td2 = document.createElement('td');
        tr.append(td2);

        const td3 = document.createElement('td');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '刷新';
        btn.onclick = () => this.reloadSite(site.name);
        td3.append(btn);
        tr.append(td3);

        this.tbody.append(tr);

        return tr;
    }

    onSiteJobUpdate(site: SiteInfo, data?: SiteJobData) {
        let job = this.jobs[site.name];
        if (site.url.startsWith('http') && this.table) {
            this.table.querySelector('tfoot')!.style.display = 'none';
        }
        if (data) {
            if (!job) {
                job = this.jobs[site.name] = { data: data };
                job.row = this.createRow(site, data);
            }
            job.data = data;
            if (job.row) {
                const [_td1, td2, td3] = job.row.querySelectorAll('td');
                td2.textContent = data.status;
                td3.querySelector('button')!.disabled = !data.url;
            }
        } else if (job) {
            job.row?.remove();
            delete this.jobs[site.name];
        }
    }

    async linkSite(siteName: string) {
        const job = this.jobs[siteName];
        if (!job) return;
        const site = SiteInfo.ByName[siteName];
        this.portMessage('activeSite', { siteName: siteName, url: job?.data.url ?? site.url });
    }

    async reloadSite(siteName: string) {
        const job = this.jobs[siteName];
        if (!job?.data.url) return;
        this.portMessage('startJob', { siteName: siteName, url: job.data.url });
    }

    async createTabs(urls: { [siteName: string]: string }, otherStatus = '_') {
        this.portMessage('createTabs', { urls: urls, otherStatus: otherStatus });
    }

    clearTabs() {
        this.portMessage('clearTabs');
    }

    portMessage(action: string, param?: any) {
        this.getPort().postMessage({ action: action, param: param } as MessageInfo);
    }
}
