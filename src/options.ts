import { SiteInfo, SiteInfoDef } from "./siteinfo";

interface FormValue { [name: string]: string };

class FloatForm {
  form: HTMLFormElement;
  fields: { [name: string]: HTMLInputElement | HTMLTextAreaElement } = {};
  message: HTMLElement;

  constructor(id: string, onSubmit: (value: FormValue) => string | null) {
    this.form = document.getElementById(id) as HTMLFormElement;
    this.message = document.createElement('p');
    this.message.style.color = 'red';
    this.form.append(this.message);
    for (const elem of this.form.querySelectorAll('input,textarea')) {
      const input = elem as HTMLInputElement | HTMLTextAreaElement;
      if (!input.name) continue;
      this.fields[input.name] = input;
    }

    this.form.className = "front";
    this.form.onsubmit = () => {
      let msg: string | null;
      try {
        msg = onSubmit(this.getValue());
      } catch (error) {
        console.error(error);
        msg = '脚本错误！';
        return false;
      }
      if (msg) {
        this.message.textContent = msg;
      } else {
        this.showForm(false);
      }
      return false;
    };

    const cancel = this.form.querySelector('button[name="cancel"]');
    if (cancel) {
      (cancel as HTMLButtonElement).onclick = () => {
        this.showForm(false);
      };
    }

    this.showForm(false);
  }

  getValue(): FormValue {
    const value: FormValue = {};
    for (const name in this.fields) {
      value[name] = this.fields[name].value.trim();
    }
    return value;
  }

  setValue(value: FormValue) {
    for (const name in this.fields) {
      this.fields[name].value = value[name] ?? '';
    }
  }

  showForm(show: boolean) {
    document.getElementById('mask')!.style.display = show ? '' : 'none';
    this.form.style.display = show ? '' : 'none';
  }

  pop(value?: FormValue) {
    if (value) this.setValue(value);
    this.message.textContent = '';
    this.showForm(true);
  }
}

let editSiteName: string | undefined;
let qbData: FormValue = {};

const editForm = new FloatForm('edit_form', value => {
  let data;
  try {
    data = JSON.parse(value.json);
  } catch (error) {
    console.log(error);
    return 'json 格式错误！';
  }
  if (!Array.isArray(data)) return '需要数组';
  const items: { [name: string]: any } = {};
  const order: string[] = [];
  items.order = order;
  for (const sd of data) {
    if (sd?.constructor != Object) return '数组元素应为站点对象{}';
    if (!sd.name || !sd.url) return '站点必须有name和url';
    const key = '@' + sd.name;
    if (items[key]) return '名称(name)重复';
    items[key] = sd;
    order.push(sd.name);
  }
  const rm: string[] = [];
  for (const name in SiteInfo.ByName) {
    const key = '@' + name;
    if (!items[key]) {
      rm.push(key);
    }
  }
  chrome.storage.sync.set(items);
  if (rm.length > 0) {
    chrome.storage.sync.remove(rm);
  }
  return null;
});

const qbForm = new FloatForm('qb_form', value => {
  qbUpdate(value);
  chrome.storage.sync.set({ qb: value });
  return null;
});

const siteForm = new FloatForm('site_form', value => {
  let data: any = {};
  if (value.json) {
    try {
      data = JSON.parse(value.json);
    } catch (error) {
      console.log(error);
      return 'json 格式错误！';
    }
    if (data?.constructor != Object) return '需要站点对象{}';
  }
  data.name = value.name ?? data.name;
  data.url = value.url ?? data.url
  if (!data.name || !data.url) return '站点必须有名称和地址';
  const items: { [name: string]: any } = {};
  items['@' + data.name] = data;
  if (data.name != editSiteName) {
    if (SiteInfo.Order.indexOf(data.name) >= 0 && SiteInfo.ByName[data.name]) {
      return '名称重复';
    }
    items.order = SiteInfo.Order.filter(name => name != data.name);
    const i = editSiteName ? SiteInfo.Order.indexOf(editSiteName) : -1;
    if (i >= 0) {
      items.order[i] = data.name;
    } else {
      items.order.push(data.name);
    }
    if (editSiteName) {
      chrome.storage.sync.remove('@' + editSiteName!);
    }
  }
  chrome.storage.sync.set(items);
  return null;
});

document.getElementById('site_add')!.onclick = () => {
  editSiteName = undefined;
  siteForm.pop({});
};

document.getElementById('edit_all')!.onclick = () => {
  const sites: SiteInfoDef[] = [];
  for (const site of SiteInfo.GetList()) {
    sites.push(site.def);
  }
  editForm.pop({ json: JSON.stringify(sites, undefined, 2) });
};

document.getElementById('qb_edit')!.onclick = () => {
  qbForm.pop(qbData);
};

SiteInfo.OnUpdate.push(() => {
  const tbody = document.querySelector('#site_table>tbody')!;
  const template = (document.querySelector('#site_table template') as HTMLTemplateElement).content.firstElementChild!;
  tbody.innerHTML = '';
  const list = SiteInfo.GetList();
  let index = 0;
  for (const site of list) {
    const tr = template.cloneNode(true) as HTMLElement;
    const [td1, td2, td3] = tr.querySelectorAll('td');
    td1.textContent = site.name;
    const a = td2.querySelector('a')!;
    a.href = a.textContent = site.url;
    a.target = '_blank';
    const [btnEdit, btnDel, btnUp, btnDown] = td3.querySelectorAll('button');
    btnEdit.onclick = () => {
      editSiteName = site.name;
      const json: any = Object.assign({}, site.def);
      delete json.name;
      delete json.url;
      siteForm.pop({
        name: site.name,
        url: site.url,
        json: JSON.stringify(json, undefined, 2),
      });
    };
    btnDel.onclick = () => {
      if (!window.confirm(`确定删除 ${site.name} 吗？`)) return;
      chrome.storage.sync.remove('@' + site.name);
      const order = SiteInfo.Order.filter(name => name != site.name);
      chrome.storage.sync.set({ order: order });
    };
    if (index <= 0) {
      btnUp.style.display = 'none';
    } else {
      btnUp.onclick = switchOrder(index - 1);
    }
    if (index >= list.length - 1) {
      btnDown.style.display = 'none';
    } else {
      btnDown.onclick = switchOrder(index);
    }
    index++;
    tbody.append(tr);
  }
});

function switchOrder(index: number) {
  return () => {
    const order = [...SiteInfo.Order];
    const tmp = order[index + 1];
    order[index + 1] = order[index];
    order[index] = tmp;
    chrome.storage.sync.set({ order: order });
  };
}

function qbUpdate(data: FormValue) {
  qbData = data;
  const a = document.querySelector('a#qb_link') as HTMLAnchorElement;
  a.href = a.textContent = qbData.url ?? '';
}

chrome.storage.sync.get('qb', value => qbUpdate(value.qb ?? {}));
