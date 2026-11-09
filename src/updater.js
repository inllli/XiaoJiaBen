import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// 发版前把 githubRepo 改成真实仓库（owner/repo），在 Release 里上传 .apk 并写更新说明即可
export const UPDATE_CONFIG = {
    githubRepo: 'inllli/XiaoJiaBen',
    // iOS 上架后填 App Store 链接，例如 https://apps.apple.com/app/id1234567890
    iosAppStoreUrl: '',
    // 未上架时可用 TestFlight 公共链接（https://testflight.apple.com/join/xxxx）
    iosTestFlightUrl: '',
};

const getCurrentVersion = () => (Constants.expoConfig && Constants.expoConfig.version) || '0.0.0';

const cmpVersion = (a, b) => {
    const pa = String(a).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const x = pa[i] || 0;
        const y = pb[i] || 0;
        if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
};

// 查询 GitHub 最新 Release，和当前 app.json 的 version 对比
export async function checkUpdate() {
    const current = getCurrentVersion();
    if (!UPDATE_CONFIG.githubRepo || UPDATE_CONFIG.githubRepo.indexOf('YOUR_GITHUB') === 0) {
        return { hasUpdate: false, configured: false, current };
    }
    try {
        const res = await fetch(`https://api.github.com/repos/${UPDATE_CONFIG.githubRepo}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) return { hasUpdate: false, current, error: `HTTP ${res.status}` };
        const data = await res.json();
        const latest = String(data.tag_name || '').replace(/^v/i, '');
        if (!latest || cmpVersion(latest, current) <= 0) return { hasUpdate: false, current, latest };
        const assets = data.assets || [];
        const apk = assets.find(a => a.name && a.name.toLowerCase().endsWith('.apk'));
        return {
            hasUpdate: true,
            configured: true,
            current,
            latest,
            notes: String(data.body || '').trim(),
            apkUrl: apk ? apk.browser_download_url : '',
            htmlUrl: data.html_url || '',
        };
    } catch (e) {
        return { hasUpdate: false, current, error: e.message };
    }
}

// 国内直连 github.com 的 release 附件经常不通（api.github.com 却能连），
// 所以下载按顺序尝试：直连 → 几个 GitHub 加速镜像 → 全失败才提示开 VPN
const APK_MIRRORS = [
    '',
    'https://ghfast.top/',
    'https://ghproxy.net/',
    'https://gh-proxy.com/',
];

// 下载 APK 并调起系统安装器（仅 Android；iOS 请走 App Store）
export async function downloadAndInstallApk(apkUrl, onProgress) {
    if (Platform.OS !== 'android') {
        return { ok: false, message: 'iOS 不支持侧载安装，请前往 App Store 更新' };
    }
    if (!apkUrl) return { ok: false, message: '该版本没有附带 apk 安装包' };
    const target = `${FileSystem.cacheDirectory}xiaojia-ble-update.apk`;
    let lastError = '';
    for (let i = 0; i < APK_MIRRORS.length; i++) {
        const src = APK_MIRRORS[i] ? APK_MIRRORS[i] + apkUrl : apkUrl;
        try {
            if (onProgress) onProgress(0);
            const task = FileSystem.createDownloadResumable(src, target, {}, p => {
                if (p.totalBytesExpectedToWrite > 0 && onProgress) {
                    onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
                }
            });
            const result = await task.downloadAsync();
            if (!result) { lastError = '没有返回下载结果'; continue; }
            if (result.status && result.status !== 200) { lastError = `HTTP ${result.status}`; continue; }
            // 镜像有时会返回一张 HTML 错误页，用体积挡一下，免得把坏文件交给安装器
            const info = await FileSystem.getInfoAsync(target, { size: true });
            if (!info.exists || (info.size || 0) < 1024 * 1024) { lastError = '安装包下载不完整'; continue; }
            const contentUri = await FileSystem.getContentUriAsync(target);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: contentUri,
                type: 'application/vnd.android.package-archive',
                flags: 1,
            });
            return { ok: true };
        } catch (e) {
            lastError = e.message || String(e);
        }
    }
    return { ok: false, message: `下载失败（${lastError || '网络不通'}）。国内网络请开启 VPN 或加速器后重试` };
}
