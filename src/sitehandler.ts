import { MessageInfo, SiteJobData } from "./common";
import { SiteInfo } from "./siteinfo";

interface JobInfo {
    row?: HTMLTableRowElement;
    check?: HTMLInputElement;
    data: SiteJobData;
}

export class SiteHandler {
    job: string;
    port?: chrome.runtime.Port;
    jobs: { [siteName: string]: JobInfo } = {};
    table?: HTMLTableElement;
    tbody?: HTMLTableSectionElement;
    bottom?: HTMLTableCellElement;
    Handler: { [action: string]: (site: SiteInfo, param?: any) => void } = {};
    onSelectChanged: () => void = () => { };
    onSelectChanged_timeout: any = null;
    isCheckEnable: (site: SiteInfo) => boolean = _site => true;

    constructor(job: string, tableName?: string, sync = true) {
        this.job = job;
        if (tableName) {
            this.initTable(tableName);
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

    initTable(tableName: string) {
        this.table = document.getElementById(tableName) as HTMLTableElement;
        if (!this.table) return;

        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>站点</th><th>信息</th><th>操作</th></tr>';
        this.table.append(thead);
        this.tbody = document.createElement('tbody');
        this.table.append(this.tbody);
        const tfoot = document.createElement('tfoot');
        tfoot.innerHTML = '<tr><th colspan="3"></th></tr>'
            + '<tr id="sample_row"><th colspan="3">当前站点均为例子数据，请前往<a href="/options.html" target="pt_options">《配置》</a>。<br/>详情可查看<a href="/readme.html" target="bt_readme">《说明》</a>。</th></tr>';

        this.bottom = tfoot.querySelector('th')!;

        const btnSelect = document.createElement('button');
        btnSelect.type = "button";
        btnSelect.textContent = "全选";
        btnSelect.onclick = () => {
            let setChecked = false;
            for (const siteName in this.jobs) {
                const cb = this.jobs[siteName].check!;
                if (!cb.disabled && !cb.checked) {
                    setChecked = true;
                    break;
                }
            }
            for (const siteName in this.jobs) {
                const cb = this.jobs[siteName].check!;
                if (!cb.disabled)
                    cb.checked = setChecked;
            }
            this.onSiteSelect();
        };
        this.bottom.append(btnSelect);
        this.bottom.append(document.createTextNode(' '));

        const btnClose = document.createElement('button');
        btnClose.type = "button";
        btnClose.textContent = "全关";
        btnClose.onclick = () => this.clearTabs();
        this.bottom.append(btnClose);
        this.bottom.append(document.createTextNode(' '));

        const link_hide = document.createElement('a');
        link_hide.href = '/options.html';
        link_hide.target = 'pt_options';
        this.bottom.append(link_hide);

        const btnOption = document.createElement('button');
        btnOption.type = "button";
        btnOption.textContent = "配置";
        btnOption.onclick = () => link_hide.click();
        this.bottom.append(btnOption);
        this.bottom.append(document.createTextNode(' '));

        this.table.append(tfoot);
    }

    createRow(site: SiteInfo, data: SiteJobData): JobInfo {
        if (!this.tbody) return { data: data };

        const tr = document.createElement('tr');

        const td1 = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        if (this.isCheckEnable(site)) {
            cb.checked = true;
        } else {
            cb.disabled = true;
        }
        cb.onclick = () => this.onSiteSelect();
        td1.append(cb);
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

        tr.onclick = elem => {
            const name = (elem.target as HTMLElement).localName;
            if (name != 'a' && name != 'input') {
                cb.checked = !cb.checked;
                this.onSiteSelect();
            }
        };

        this.tbody.append(tr);

        return { data: data, row: tr, check: cb };
    }

    onSiteJobUpdate(site: SiteInfo, data?: SiteJobData) {
        let job = this.jobs[site.name];
        if (site.url.startsWith('http') && this.table) {
            document.getElementById('sample_row')!.style.display = 'none';
        }
        if (data) {
            if (!job) {
                job = this.jobs[site.name] = this.createRow(site, data);
                this.onSiteSelect();
            }
            job.data = data;
            if (job.row) {
                const [_td1, td2, td3] = job.row.querySelectorAll('td');
                td2.textContent = data.status;
                td3.querySelector('button')!.disabled = !data.url;
            }
        } else if (job) {
            if (job.check?.checked) {
                this.onSiteSelect();
            }
            job.row?.remove();
            delete this.jobs[site.name];
        }
    }

    onSiteSelect() {
        if (this.onSelectChanged_timeout) return;
        this.onSelectChanged_timeout = setTimeout(() => {
            this.onSelectChanged();
            this.onSelectChanged_timeout = null;
        }, 100);
    }

    getSelectedSites(): SiteInfo[] {
        const sites: SiteInfo[] = [];
        for (const site of SiteInfo.GetList()) {
            if (this.jobs[site.name]?.check?.checked) {
                sites.push(site);
            }
        }
        return sites;
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

    async createTabs(urls: { [siteName: string]: string }) {
        this.portMessage('createTabs', urls);
    }

    clearTabs() {
        this.portMessage('clearTabs');
    }

    portMessage(action: string, param?: any) {
        this.getPort().postMessage({ action: action, param: param } as MessageInfo);
    }
}
