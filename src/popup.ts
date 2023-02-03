import { SiteInfo } from "./siteinfo";
import { SiteHandler } from "./sitehandler";

const handler = new SiteHandler('signin', 'site_table');

document.getElementById('button_signin')!.onclick = () => {
  let urls: { [siteName: string]: string } = {};
  for (const site of SiteInfo.GetList()) {
    if (site.signin) {
      urls[site.name] = site.url;
    }
  }
  handler.createTabs(urls, '(不支持)');
  return false;
};

document.getElementById('button_close')!.onclick = ()=>{
  handler.clearTabs();
  return false;
};
