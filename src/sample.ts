import { SearchResult, sendMessage } from "./common";

let Handler: { [name: string]: { (): void }; } = {}

Handler.search = function () {
    const item: SearchResult = {
        file: 'sample',
        title: '测试文件',
        size: '1G',
        seed: '1',
        down: '1',
        finish: '1',
        link: '',
        download: '/sample.torrent',
        progressText: '',
        progressPercent: 0,
        sizeNumber: 1024 * 1024 * 1024,
    };
    sendMessage('result', [item]);
    setStatus(`找到1个`, true);
}

Handler.signin = async function () {
    setStatus('签到成功！', true);
}

function setStatus(status: string, done = false) {
    sendMessage('status', { status: status, done: done })
}

sendMessage('job').then(param => {
    if (!param) return;
    console.log('onStart:', param);
    Handler[param.job]();
});
