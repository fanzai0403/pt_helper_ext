# <img src="public/icons/icon_48.png" width="45" align="left"> PT Helper Extension

Chrome浏览器PT助手插件 - 多站点管理

## Features

- 多站点一键签到
- 多站点一键搜索、下载
- 多种子内容分析对比
- 多种子一键添加至qBittorrent

## Install

### 从商店安装

[Chrome应用商店 - PT Helper](https://chrome.google.com/webstore/detail/pt-helper/kdbmbhmgilklcoeafjhfdnhebbndbeof)

### 源文件编译

1. 拉取
- https://github.com/fanzai0403/pt_helper_ext.git

2. 编译
```
npm install
npm run build
```

3. 安装
- Chrome浏览器 => [管理扩展程序](chrome://extensions/) => 加载已解压的扩展程序 => build目录

## Config

### qBittorrent

- 地址：QB后台地址，不填会屏蔽QB功能
- 用户名、密码：填写后会自动登录（明文存放，谨防泄漏），不填写可以自己手动登录（共用Chrome会话）

### 站点配置

- 一个站点至少要定义名称（name，唯一）和地址（url）两个字段
- 其它字段会有默认值（基于NexusPHP的站点会比较像）
- 单个站点编辑/添加时，其它部分的name、url会被名称、地址覆盖
- 批量编辑时，需要输入数组，数组的元素是站点定义（name、url、其它可选）
- 站点字段定义：

| 字段名 | 定义 | 默认值 | 详情 |
| ---- | ---- | ---- | ---- |
| name | 名称 | 必填 | 站点名称，需要唯一 |
| url | 地址 | 必填 | 站点根目录URL |
| signin | 支持签到 | `true` |  |
| signinLinkXPath | 签到按钮XPath | `"//a[@href=\"attendance.php\"]"` | 空串`""`表示打开站点即自动签到 |
| signinSuccessXPath | 签到成功XPath | `"//td[@id=\"outer\"]//p[contains(text(),\"这是您的第\")]"` | 空串`""`表示直接假定成功 |
| signinDoneXPath | 签到已完成XPath | `"//table[@id=\"info_block\"]//text()[contains(.,\"签到已得\")]"` | 空串`""`表示找不到签到按钮即认为已签 |
| searchUrl | 搜索地址 | `"/torrents.php?search={0}"` | 其中`{0}`会被替换为搜索字符串 |
| searchXPath | 搜索成功XPath | `"//table[@class=\"searchbox\"]"` | 用于区分站点出错、需要登录等情况 |
| torrentXPath | 种子XPath | `"//table[@class=\"torrents\"]/tbody/tr/td/table[@class=\"torrentname\"]/../.."` | 一条种子记录的节点（以下几个XPath的根） |
| linkXPath | 种子详情链接XPath | `"./td[2]//table/tbody/tr/td/a/@href"` |  |
| downloadXPath | 种子下载链接XPath | `".//a[contains(@href,\"download\")]/@href"` |  |
| fileXPath | 种子文件名XPath | `"./td[2]//table/tbody/tr/td/a/@title"` |  |
| titleXPath | 种子标题XPath | `"./td[2]//table/tbody/tr/td/a/../br/following-sibling::text()[last()]"` |  |
| sizeXPath | 种子大小XPath | `"./td[5]"` |  |
| seedXPath | 种子做种人数XPath | `"./td[6]"` |  |
| downXPath | 种子下载人数XPath | `"./td[7]"` |  |
| finishXPath | 种子完成人数XPath | `"./td[8]"` |  |
| progressTextXPath | 进度文本XPath | `"./td[2]//table/tbody/tr/td/div/@title"` |  |
| progressBarXPath | 进度条XPath | `"./td[2]//table/tbody/tr/td/div/div"` | 根据此节点的width属性或文本计算进度百分比 |

## Notice

### 种子内容分析

- 长度不同的文件，内容一定不同
- 校验相同的文件，内容一定相同
- 校验不同的文件，内容不一定不同（顺序、前后文件变化等因素会影响校验）

### PT站不公开

- 因各PT站都明令禁止公布地址、名称，所以本插件默认不会包含任何PT站点配置
- 请不要在公开场合跟我或其它人沟通具体站点的配置（私聊可以）
- 如有需要，请在一些私有的PT论坛交流本插件的站点配置

### Chrome群组

- 组群的窗口可以方便的一键关闭、折叠、拖动等
- 被折叠的群组窗口不会刷新，批量操作会因此卡住

## Todo

- 支持QB之外的更多客户端
- 快速添加：站点预设+拥有站点检测
- 某些大站的适配（求药）
- 换一套美观、清晰的界面库
- 易用性提升（异常处理、自动刷新等）
