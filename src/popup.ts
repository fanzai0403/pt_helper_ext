import { SiteInfo } from "./siteinfo";
import { SiteHandler } from "./sitehandler";

const handler = new SiteHandler('signin', 'site_table');

document.getElementById('button_signin')!.onclick = () => {
  let urls: { [siteName: string]: string } = {};
  for (const site of handler.getSelectedSites()) {
    if (site.signin) {
      urls[site.name] = site.url;
    }
  }
  handler.createTabs(urls);
  return false;
};

document.getElementById('button_search')!.onclick = () => document.getElementById('link_search')!.click();
document.getElementById('button_readme')!.onclick = () => document.getElementById('link_readme')!.click();

handler.isCheckEnable = site => site.signin;
