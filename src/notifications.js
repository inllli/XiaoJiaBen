import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 通知渠道（Android 8+ 必须归入渠道；用户可单独关它）
export const REMINDER_CHANNEL = 'reminders';
// 打卡提醒滚动排未来多少天：重启/重排时重建，7 天内开过 App 就不会断
const CHECKIN_WINDOW_DAYS = 7;
// 临期/过期是一次性的特定日期，排远一点无妨
const EXPIRE_WINDOW_DAYS = 60;
// 单个条目最多 6 个打卡时间点
export const MAX_REMIND_TIMES = 6;
export const ADVANCE_OPTIONS = [0, 5, 10, 20, 30];

const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayOffset = (d, off) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + off);

const parseHM = (s) => {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(s || '').trim());
    if (!m) return null;
    const h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h > 23 || mi > 59) return null;
    return { h, m: mi };
};

const parseYMD = (s) => {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
    if (!m) return null;
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return isNaN(d.getTime()) ? null : d;
};

export const currentHM = () => {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
};

// 今天是否已打卡了几次（一天多个时间点时据此跳过前面的提醒）
const countDoneToday = (calendarData, todayKey, name, kind) => {
    const list = (calendarData && calendarData[todayKey]) || [];
    return list.filter(r => r && r.item === name && r.category === kind).length;
};

const freqMatches = (day, repeat, weekdays, off) => {
    if (repeat === 'weekly') {
        const wd = Array.isArray(weekdays) ? weekdays : [];
        return wd.includes(day.getDay());
    }
    if (repeat === 'odd') return off % 2 === 0; // 今天起，隔一天一次
    return true; // daily
};

export const setupNotificationHandler = () => {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
};

// 渠道一旦创建，importance 在系统里就固定死了（改代码不会更新已有渠道），
// 所以升级时删掉旧渠道重建一次，保证 MAX + 声音真正生效；只做一次，避免每次启动重置用户的渠道设置
const CHANNEL_VERSION = 'v2';
let channelReady = false;
export const ensureChannel = async () => {
    if (Platform.OS !== 'android' || channelReady) return;
    try {
        let upgraded = true;
        try {
            upgraded = (await AsyncStorage.getItem('notifChannelVersion')) === CHANNEL_VERSION;
        } catch (e) {
            upgraded = false;
        }
        if (!upgraded) await Notifications.deleteNotificationChannelAsync(REMINDER_CHANNEL).catch(() => { });
        await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
            name: '打卡与到期提醒',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            enableVibrate: true,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8eaa8b',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
        if (!upgraded) await AsyncStorage.setItem('notifChannelVersion', CHANNEL_VERSION).catch(() => { });
        channelReady = true;
    } catch (e) {
        // 渠道创建失败不影响排程，忽略
    }
};

export const getPermissionStatus = async () => {
    try {
        const res = await Notifications.getPermissionsAsync();
        return res.status;
    } catch (e) {
        return 'undetermined';
    }
};

export const requestPermission = async () => {
    try {
        const res = await Notifications.requestPermissionsAsync();
        return res.status === 'granted';
    } catch (e) {
        return false;
    }
};

// ---------- 系统提醒设置引导 ----------
// 通知权限能自己检测；「自启动 / 省电策略 / 后台弹出界面」是厂商私有开关，
// Android 没有开放读取接口，App 只能把用户带到对应页让他手动确认。
const APP_PKG = 'com.Yjia.xiaojiaoben';

const startIntent = async (action, params) => {
    if (Platform.OS !== 'android') return false;
    try {
        await IntentLauncher.startActivityAsync(action, params || {});
        return true;
    } catch (e) {
        return false;
    }
};

// 通知设置：允许通知 / 横幅 / 锁屏显示
export const openNotifSettings = async () => {
    if (await startIntent('android.settings.APP_NOTIFICATION_SETTINGS', { extra: { 'android.provider.extra.APP_PACKAGE': APP_PKG } })) return true;
    if (await startIntent('android.settings.APP_NOTIFICATION_SETTINGS', { extra: { app_pkg: APP_PKG } })) return true;
    return startIntent('android.settings.APPLICATION_DETAILS_SETTINGS', { data: 'package:' + APP_PKG });
};

// 电池优化列表：把省电策略从「智能省电」改成「无限制」
export const openBatterySettings = async () => {
    if (await startIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')) return true;
    return startIntent('android.settings.APPLICATION_DETAILS_SETTINGS', { data: 'package:' + APP_PKG });
};

// 应用权限管理：小米/红米的「自启动」「后台弹出界面」都在这一页；其他机型落到应用详情页
export const openPermissionSettings = async () => {
    if (await startIntent('miui.intent.action.APP_PERM_EDITOR', { extra: { extra_pkgname: APP_PKG } })) return true;
    return startIntent('android.settings.APPLICATION_DETAILS_SETTINGS', { data: 'package:' + APP_PKG });
};

const scheduleOne = async (when, title, body, data) => {
    if (!when || when.getTime() <= Date.now() + 1000) return false;
    try {
        await Notifications.scheduleNotificationAsync({
            content: { title, body, data, sound: 'default' },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: when,
                channelId: REMINDER_CHANNEL,
            },
        });
        return true;
    } catch (e) {
        return false;
    }
};

// 打卡提醒：按重复规则 + 多个时间点，滚动排未来 CHECKIN_WINDOW_DAYS 天
const scheduleCheckIn = async (entry, ctx) => {
    if (!entry.remindOn) return 0;
    const times = Array.isArray(entry.remindTimes) ? entry.remindTimes.filter(t => parseHM(t)) : [];
    if (!times.length) return 0;

    const repeat = entry.remindRepeat === 'weekly' || entry.remindRepeat === 'odd' ? entry.remindRepeat : 'daily';
    const weekdays = Array.isArray(entry.remindWeekdays) ? entry.remindWeekdays : [];
    const advance = Number(entry.remindAdvance) || 0;
    const doneToday = countDoneToday(ctx.calendarData, ctx.todayKey, entry.name, entry.kind);

    let count = 0;
    for (let off = 0; off < CHECKIN_WINDOW_DAYS; off += 1) {
        const day = dayOffset(ctx.today, off);
        if (!freqMatches(day, repeat, weekdays, off)) continue;
        // 今天已经打过 k 次，就从第 k 个时间点开始提醒
        const dayTimes = off === 0 ? times.slice(Math.min(doneToday, times.length)) : times;
        for (const t of dayTimes) {
            const hm = parseHM(t);
            if (!hm) continue;
            const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hm.h, hm.m, 0, 0);
            if (advance > 0) {
                const pre = new Date(slot.getTime() - advance * 60000);
                if (pre.getTime() > Date.now()) {
                    if (await scheduleOne(pre, '打卡提醒', `${entry.name} · ${advance} 分钟后该打卡`, { kind: entry.kind, name: entry.name, type: 'checkin-advance' })) count += 1;
                }
            }
            if (slot.getTime() > Date.now()) {
                if (await scheduleOne(slot, '打卡提醒', `${entry.name} 该打卡了`, { kind: entry.kind, name: entry.name, type: 'checkin' })) count += 1;
            }
        }
    }
    return count;
};

// 临期 / 过期提醒：只有填了到期日（且不是"无期限"）的条目才排
const scheduleExpiry = async (entry, ctx) => {
    if (entry.noExpire) return 0;
    const ex = parseYMD(entry.expireDate);
    if (!ex) return 0;
    const exDay = startOfDay(ex);
    const diffDays = Math.round((exDay.getTime() - ctx.today.getTime()) / 86400000);
    if (diffDays > EXPIRE_WINDOW_DAYS || diffDays < -30) return 0;

    let count = 0;

    // 过期当天 09:00
    if (ctx.prefs.expired) {
        const slot = new Date(exDay.getFullYear(), exDay.getMonth(), exDay.getDate(), 9, 0, 0, 0);
        if (slot.getTime() > Date.now()) {
            if (await scheduleOne(slot, '过期提醒', `${entry.name} 今天到期`, { kind: entry.kind, name: entry.name, type: 'expired' })) count += 1;
        } else if (diffDays === 0) {
            // 今天就是到期日、但 9 点已过 —— 立刻补一条
            const soon = new Date(Date.now() + 30000);
            if (await scheduleOne(soon, '过期提醒', `${entry.name} 今天到期`, { kind: entry.kind, name: entry.name, type: 'expired' })) count += 1;
        }
    }

    // 临期：到期前 N 天当天 09:00，只提醒一次
    const advDays = parseInt(entry.expireDays, 10);
    if (ctx.prefs.expiring && !isNaN(advDays) && advDays > 0) {
        const preDay = new Date(exDay.getTime() - advDays * 86400000);
        const slot = new Date(preDay.getFullYear(), preDay.getMonth(), preDay.getDate(), 9, 0, 0, 0);
        if (slot.getTime() > Date.now()) {
            if (await scheduleOne(slot, '临期提醒', `${entry.name} 还有 ${advDays} 天到期（${entry.expireDate}）`, { kind: entry.kind, name: entry.name, type: 'expiring' })) count += 1;
        } else if (diffDays >= 0) {
            // 设定的提前日已过、但物品还没过期 —— 立刻补一条，避免这条永远不提醒
            const soon = new Date(Date.now() + 30000);
            if (await scheduleOne(soon, '临期提醒', `${entry.name} ${diffDays === 0 ? '今天到期' : `${diffDays} 天后到期`}（${entry.expireDate}）`, { kind: entry.kind, name: entry.name, type: 'expiring' })) count += 1;
        }
    }

    return count;
};

// 统一重排：先清空本 App 已排的，再按当前数据重排（幂等，随时可调）
export const rescheduleAll = async ({ inventory = [], habits = [], calendarData = {}, prefs = {} } = {}) => {
    try {
        const status = await getPermissionStatus();
        if (status !== 'granted') {
            await Notifications.cancelAllScheduledNotificationsAsync();
            return { scheduled: 0, granted: false };
        }
        await ensureChannel();
        await Notifications.cancelAllScheduledNotificationsAsync();

        const now = new Date();
        // prefs 缺字段时按"开"处理，和设置页默认一致
        const prefsOn = { checkIn: prefs.checkIn !== false, expiring: prefs.expiring !== false, expired: prefs.expired !== false };
        const ctx = { today: startOfDay(now), todayKey: dateKey(now), calendarData, prefs: prefsOn };

        const entries = [];
        (inventory || []).forEach(it => {
            if (!it || !it.name) return;
            entries.push({
                name: it.name,
                kind: it.category === '药品' ? 'medicine' : 'inventory',
                remindOn: !!it.remindOn,
                remindRepeat: it.remindRepeat,
                remindWeekdays: it.remindWeekdays,
                remindTimes: it.remindTimes,
                remindAdvance: it.remindAdvance,
                noExpire: it.noExpire !== undefined ? it.noExpire : true,
                expireDate: it.expireDate,
                expireDays: it.expireDays,
            });
        });
        (habits || []).forEach(h => {
            if (!h || !h.name) return;
            entries.push({
                name: h.name,
                kind: 'habit',
                remindOn: !!h.remindOn,
                remindRepeat: h.remindRepeat,
                remindWeekdays: h.remindWeekdays,
                remindTimes: h.remindTimes,
                remindAdvance: h.remindAdvance,
                noExpire: true,
                expireDate: '',
                expireDays: '',
            });
        });

        let scheduled = 0;
        // 条目多、时间点多时避免一次排上千条把系统通知队列撑爆（超出预算的按条目先后截断）
        let budget = 180;
        for (const e of entries) {
            if (budget <= 0) break;
            if (prefsOn.checkIn) {
                const n = await scheduleCheckIn(e, ctx);
                scheduled += n; budget -= n;
            }
            if (budget <= 0) break;
            const m = await scheduleExpiry(e, ctx);
            scheduled += m; budget -= m;
        }
        return { scheduled, granted: true };
    } catch (e) {
        return { error: String((e && e.message) || e) };
    }
};

// 供"设置-消息提醒"展示：当前真正排进系统的通知条数
export const countScheduled = async () => {
    try {
        const list = await Notifications.getAllScheduledNotificationsAsync();
        return list.length;
    } catch (e) {
        return 0;
    }
};
