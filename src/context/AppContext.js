import React, { createContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { getThemeColors } from '../theme';
import { localDateStr } from '../dateUtils';
import { rescheduleAll, setupNotificationHandler } from '../notifications';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [inventory, setInventory] = useState([]);
    const [habits, setHabits] = useState([]);
    const [calendarData, setCalendarData] = useState({});
    const [themeBg, setThemeBg] = useState('#f7f6f1');
    const [nickname, setNickname] = useState('');
    // 依据主题背景色明暗派生的整套页面配色（字体/卡片/组件随主题联动）
    const themeColors = useMemo(() => getThemeColors(themeBg), [themeBg]);

    // 初始化新的数据结构，并包含默认值
    const [customOptions, setCustomOptions] = useState({
        categories: ['食品', '日用品', '洗护', '其他'],
        itemUnits: ['盒', '瓶', '袋', '个', '件', '把'],
        medUnits: ['粒', '片', '包', '支', '盒'],
        itemLocations: ['冰箱', '储物柜', '阳台'],
        medLocations: ['药箱', '随身包', '急救包'],
        medFrequencies: ['每日1次', '每日2次', '隔日', '每周几次'],
    });

    const [toastMsg, setToastMsg] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);
    // 消息提醒总开关（打卡/临期/过期），与条目级开关配合使用
    const [notifPrefs, setNotifPrefs] = useState({ checkIn: true, expiring: true, expired: true });
    // 本地数据读完之前不排通知，避免用空数据把已排的提醒清掉
    const [dataReady, setDataReady] = useState(false);

    const showToast = (msg) => {
        setToastMsg(msg);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);
    };

    const addLogEntry = (tag, message) => {
        const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
        const newLog = `[${timestamp}] [${tag}] ${message}`;
        setDebugLogs(prev => {
            const updated = [newLog, ...prev];
            return updated.slice(0, 200);
        });
    };

    const exportLogs = async () => {
        try {
            const logText = debugLogs.join('\n');
            const fileName = `XiaoJiaBen_Debug_${new Date().getTime()}.txt`;
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, logText || '暂无日志');
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: '导出小家本日志' });
                await dropTmp(fileUri);
            } else { showToast('文件已保存到应用沙盒'); }
        } catch (e) { showToast('导出日志失败: ' + e.message); }
    };

    // 导出产生的存档文件：沙盒副本用完即删，用户保存的目录记住 URI，清理时逐条列出供手动勾选
    const ARCHIVE_DIR_KEY = 'archiveDirUri';
    const isArchiveName = (n) => /^XiaoJiaBen_(Backup|Debug)_[^\s]+\.(json|txt)$/.test(n);
    // SAF 返回的是 content:// 文档 URI，整串解码后路径里仍带目录层级，直接从中提取文件名
    const archiveNameFromUri = (uri) => {
        let s = String(uri || '');
        try { s = decodeURIComponent(s); } catch (e) { }
        const m = s.match(/(XiaoJiaBen_(?:Backup|Debug)_[^\/\s]+\.(?:json|txt))/);
        return m ? m[1] : null;
    };
    // 文件名尾部的毫秒时间戳即导出时刻（XiaoJiaBen_Backup_<ms>.json）
    const archiveTimeFromName = (n) => {
        const m = String(n || '').match(/_(\d{10,})\.(?:json|txt)$/);
        return m ? Number(m[1]) : null;
    };
    const getArchiveDirUri = async () => {
        try { return await AsyncStorage.getItem(ARCHIVE_DIR_KEY); } catch (e) { return null; }
    };
    const pickArchiveDir = async () => {
        try {
            const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (!perm.granted) return null;
            await AsyncStorage.setItem(ARCHIVE_DIR_KEY, perm.directoryUri).catch(() => { });
            return perm.directoryUri;
        } catch (e) { return null; }
    };
    // 返回 { list: [{ uri, name, size, where }], scanned }；scanned 为保存目录里读到的条目总数
    const collectArchiveFiles = async () => {
        const list = [];
        let scanned = 0;
        try {
            const dir = FileSystem.documentDirectory;
            const names = await FileSystem.readDirectoryAsync(dir);
            for (const n of names.filter(isArchiveName)) {
                let size = 0;
                try {
                    const info = await FileSystem.getInfoAsync(dir + n, { size: true });
                    if (info && info.exists) size = info.size || 0;
                } catch (e) { }
                list.push({ uri: dir + n, name: n, size, mtime: archiveTimeFromName(n), where: 'sandbox' });
            }
        } catch (e) { }
        try {
            const dirUri = await getArchiveDirUri();
            if (dirUri) {
                let uris = [];
                try {
                    uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
                } catch (e) {
                    uris = await FileSystem.readDirectoryAsync(dirUri).catch(() => []);
                }
                scanned = (uris || []).length;
                for (const u of uris || []) {
                    const n = archiveNameFromUri(u);
                    if (n) list.push({ uri: u, name: n, size: 0, mtime: archiveTimeFromName(n), where: 'saved' });
                }
            }
        } catch (e) { }
        // 最新的排前面
        list.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
        return { list, scanned };
    };
    const deleteArchiveFiles = async (uris) => {
        let done = 0;
        for (const u of uris || []) {
            try { await FileSystem.deleteAsync(u, { idempotent: true }); done += 1; } catch (e) { }
        }
        return done;
    };
    const dropTmp = async (uri) => {
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch (e) { }
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const savedInventory = await AsyncStorage.getItem('inventory');
                const savedHabits = await AsyncStorage.getItem('habits');
                const savedCalendar = await AsyncStorage.getItem('calendarData');
                const savedOptions = await AsyncStorage.getItem('customOptions');
                const savedThemeBg = await AsyncStorage.getItem('themeBg');
                const savedNickname = await AsyncStorage.getItem('nickname');
                const savedNotifPrefs = await AsyncStorage.getItem('notifPrefs');

                if (savedInventory) setInventory(JSON.parse(savedInventory));
                if (savedHabits) setHabits(JSON.parse(savedHabits));
                if (savedCalendar) setCalendarData(JSON.parse(savedCalendar));
                if (savedThemeBg) setThemeBg(savedThemeBg);
                if (savedNickname) setNickname(savedNickname);

                // 数据迁移逻辑：兼容旧版 customOptions 结构
                let options = customOptions;
                if (savedOptions) {
                    let parsed = JSON.parse(savedOptions);
                    // 如果是旧结构（有 units, locations）且没有新结构，进行迁移
                    if (parsed.units && !parsed.itemUnits) {
                        parsed = {
                            ...customOptions,
                            categories: parsed.categories || ['食品', '日用品', '洗护', '其他'],
                            itemUnits: [...parsed.units], // 复制旧的单位作为物品单位
                            medUnits: ['粒', '片', '包', '支', '盒'], // 药品使用新的默认值
                            itemLocations: [...parsed.locations], // 复制旧的位置作为物品位置
                            medLocations: ['药箱', '随身包', '急救包'], // 药品使用新的默认值
                            medFrequencies: ['每日1次', '每日2次', '隔日', '每周几次'],
                        };
                        addLogEntry('Init', '已自动迁移偏好设置数据');
                    } else {
                        options = parsed;
                    }
                }
                setCustomOptions(options);
                if (savedNotifPrefs) {
                    try {
                        const p = JSON.parse(savedNotifPrefs);
                        setNotifPrefs({ checkIn: p.checkIn !== false, expiring: p.expiring !== false, expired: p.expired !== false });
                    } catch (e) { /* 偏好读取失败就用默认值 */ }
                }
                addLogEntry('Init', `加载本地数据完成，当前物品数量: ${JSON.parse(savedInventory || '[]').length}`);
                setDataReady(true);
            } catch (e) {
                console.log('Load error:', e);
                addLogEntry('Error', `加载本地数据失败: ${e.message}`);
                setDataReady(true);
            }
        };
        loadData();
    }, []);

    const saveData = async (newInv, newHabits, newCal, newOpts = customOptions, newThemeBg = themeBg) => {
        try {
            await AsyncStorage.setItem('inventory', JSON.stringify(newInv));
            await AsyncStorage.setItem('habits', JSON.stringify(newHabits));
            await AsyncStorage.setItem('calendarData', JSON.stringify(newCal));
            await AsyncStorage.setItem('customOptions', JSON.stringify(newOpts));
            await AsyncStorage.setItem('themeBg', newThemeBg);
        } catch (e) {
            console.log('Save error:', e);
            addLogEntry('Error', `保存数据失败: ${e.message}`);
        }
    };

    // 消息提醒总开关：持久化并立刻按新偏好重排通知
    const updateNotifPrefs = async (patch) => {
        const next = { ...notifPrefs, ...patch };
        setNotifPrefs(next);
        try { await AsyncStorage.setItem('notifPrefs', JSON.stringify(next)); } catch (e) { addLogEntry('Error', '保存提醒设置失败: ' + e.message); }
        return next;
    };

    // App 在前台时也要把通知弹出来
    useEffect(() => { setupNotificationHandler(); }, []);

    // 统一重排入口：启动、增删改条目、打卡、导入、清除、改开关都会落在这里。
    // 串一个 800ms 防抖，避免连续操作时反复清空重排。
    useEffect(() => {
        if (!dataReady) return;
        const timer = setTimeout(() => {
            rescheduleAll({ inventory, habits, calendarData, prefs: notifPrefs }).catch(() => {});
        }, 800);
        return () => clearTimeout(timer);
    }, [inventory, habits, calendarData, notifPrefs, dataReady]);

    // 偏好设置更新
    const updateCustomOptionList = (key, list) => {
        const newOptions = { ...customOptions, [key]: list };
        setCustomOptions(newOptions);
        saveData(inventory, habits, calendarData, newOptions, themeBg);
        showToast('偏好设置已更新');
    };

    // 弹窗内快速新增标签
    const addCustomOption = (type, value) => {
        if (!value.trim()) return;
        const val = value.trim();
        const newOptions = { ...customOptions };
        if (newOptions[type] && !newOptions[type].includes(val)) {
            newOptions[type].push(val);
            setCustomOptions(newOptions);
            saveData(inventory, habits, calendarData, newOptions, themeBg);
        }
    };

    const updateTheme = (color) => {
        setThemeBg(color);
        saveData(inventory, habits, calendarData, customOptions, color);
        showToast('主题色已更新');
        addLogEntry('Theme', `主题色更新为 ${color}`);
    };

    const getItemStatus = (item) => {
        const stockNum = parseFloat(item.stock);
        const stock = isNaN(stockNum) ? 0 : stockNum;
        // 已过期：设置了到期日且已过当天（diffDays < 0）
        let isExpired = false;
        if (!item.noExpire && item.expireDate) {
            const diffDays = Math.ceil((new Date(item.expireDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) isExpired = true;
        }
        let isWarn = false, isDanger = false;
        if (item.threshold !== undefined && item.threshold !== null && item.threshold !== '') {
            const threshold = parseFloat(item.threshold);
            // 预警只针对仍有库存的物品（stock<=0 归入“已用完”）
            if (!isNaN(threshold) && threshold > 0 && stock > 0 && stock <= threshold) isWarn = true;
        }
        if (!item.noExpire && item.expireDate && item.expireDays !== undefined && item.expireDays !== null && item.expireDays !== '') {
            const days = parseInt(item.expireDays);
            if (!isNaN(days)) {
                const diffDays = Math.ceil((new Date(item.expireDate) - new Date()) / (1000 * 60 * 60 * 24));
                // 临期：diffDays 在 [0, days] 区间（<0 已归入已过期）
                if (days === 0) { if (diffDays === 0) isDanger = true; }
                else { if (diffDays >= 0 && diffDays <= days) isDanger = true; }
            }
        }
        // 优先级：已过期 > 已用完 > 临期 > 快用完 > 正常
        if (isExpired) return 'expired';
        if (stock <= 0) return 'empty';
        if (isDanger) return 'danger';
        if (isWarn) return 'warn';
        return 'ok';
    };

    const addLog = (category, text, sub, itemName) => {
        const today = localDateStr();
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const record = { id: Date.now().toString(), time: timeStr, text, sub, category, item: itemName };
        const newCalendarData = { ...calendarData };
        if (!newCalendarData[today]) newCalendarData[today] = [];
        newCalendarData[today].unshift(record);
        setCalendarData(newCalendarData);
        saveData(inventory, habits, newCalendarData, customOptions, themeBg);
    };

    const removeLog = (date, recordId) => {
        const newCalendarData = { ...calendarData };
        if (newCalendarData[date]) {
            newCalendarData[date] = newCalendarData[date].filter(r => r.id !== recordId);
            if (newCalendarData[date].length === 0) delete newCalendarData[date];
        }
        setCalendarData(newCalendarData);
        saveData(inventory, habits, newCalendarData, customOptions, themeBg);
        showToast('记录已删除');
    };

    // 需求14修复：确保根据记录生成时的状态决定是否恢复库存
    // 在删除时，我们不依赖当前物品的状态，而是依赖记录的逻辑（或者记录内存储的标记）
    // 但由于旧记录没有存储标记，这里我们采用“查找当前物品状态”作为兜底，
    // 实际上最完美的方案是保存记录时存入 associateInventory: true/false。
    // 这里我们尽量兼容旧逻辑，同时保证“不关联”的记录绝对不触发恢复。
    const deleteRecordWithStockRestore = (date, recordId, record) => {
        const newCalendarData = { ...calendarData };
        if (newCalendarData[date]) {
            newCalendarData[date] = newCalendarData[date].filter(r => r.id !== recordId);
            if (newCalendarData[date].length === 0) delete newCalendarData[date];
        }
        setCalendarData(newCalendarData);

        if (record && record.item) {
            // 查找当前物品
            const targetItem = inventory.find(i => i.name === record.item && (record.category === 'medicine' ? i.category === '药品' : i.category !== '药品'));

            // 核心修复：以“记录产生时”的关联状态为准决定是否恢复库存（旧记录无标记时回退到当前配置）
            let restoreAmount = 0;
            let shouldRestore = false;

            const associatedAtRecord = record.isAssociatedAtCheckIn !== undefined ? record.isAssociatedAtCheckIn : (targetItem ? targetItem.associateInventory : false);
            if (targetItem && associatedAtRecord) {
                if (record.category === 'medicine') {
                    if (record.dose) restoreAmount = parseFloat(record.dose);
                    else if (record.sub) {
                        const match = record.sub.match(/剂量[：:](\d+[\.]?\d*)/);
                        if (match) restoreAmount = parseFloat(match[1]);
                    }
                } else if (record.category === 'inventory' && record.checkIn) {
                    if (record.dose) restoreAmount = parseFloat(record.dose);
                    else if (record.sub) {
                        const m = record.sub.match(/用量[：:](\d+(?:\.\d+)?)/);
                        if (m) restoreAmount = parseFloat(m[1]);
                    }
                }
                if (restoreAmount > 0) shouldRestore = true;
            }

            if (shouldRestore) {
                const newInventory = inventory.map(item => {
                    if (item.id === targetItem.id) {
                        return { ...item, stock: (parseFloat(item.stock) || 0) + restoreAmount };
                    }
                    return item;
                });
                setInventory(newInventory);
                saveData(newInventory, habits, newCalendarData, customOptions, themeBg);
                showToast(`记录已删除，库存已恢复 ${restoreAmount}`);
                addLogEntry('Data', `删除记录: ${record.item}, 恢复库存: ${restoreAmount}`);
                return;
            }
        }

        saveData(inventory, habits, newCalendarData, customOptions, themeBg);
        showToast('记录已删除');
    };

    const sanitizeItemData = (item) => {
        // 兼容旧版单封面字段 cover（字符串）→ 新版 covers（数组）
        const finalCovers = (item.covers && Array.isArray(item.covers) && item.covers.length > 0) ? item.covers : (item.cover ? [item.cover] : ['📦']);
        return {
            ...item,
            name: (item.name || '').trim() || '未命名物品',
            stock: isNaN(parseFloat(item.stock)) ? 0 : parseFloat(item.stock),
            unit: (item.unit || '').trim() || '件',
            category: (item.category || '').trim() || '其他',
            covers: finalCovers,
            cover: finalCovers[0],
            locations: item.locations || '',
            location: item.location || '',
            purpose: item.purpose || '',
            remark: item.remark || '',
            threshold: (item.threshold !== undefined && item.threshold !== null && item.threshold !== '') ? (isNaN(parseFloat(item.threshold)) ? '' : parseFloat(item.threshold).toString()) : '',
            expireDays: (item.expireDays !== undefined && item.expireDays !== null && item.expireDays !== '') ? (isNaN(parseFloat(item.expireDays)) ? '' : parseFloat(item.expireDays).toString()) : '',
            noExpire: item.noExpire !== undefined ? item.noExpire : true,
            expireDate: item.noExpire ? '' : (item.expireDate || ''),
            enableCheckIn: item.enableCheckIn !== undefined ? item.enableCheckIn : false,
            associateInventory: item.associateInventory !== undefined ? item.associateInventory : false,
            // 打卡提醒：开启/重复规则/每周哪几天/多个时间点/提前分钟
            remindOn: item.remindOn !== undefined ? !!item.remindOn : false,
            remindRepeat: item.remindRepeat || 'daily',
            remindWeekdays: Array.isArray(item.remindWeekdays) ? item.remindWeekdays : [],
            remindTimes: Array.isArray(item.remindTimes) ? item.remindTimes : [],
            remindAdvance: (item.remindAdvance !== undefined && item.remindAdvance !== null && item.remindAdvance !== '') ? Number(item.remindAdvance) : 0,
            locations: item.locations || '',
        };
    };

    const addItem = (item) => {
        const sanitized = sanitizeItemData(item);
        const newItem = { ...sanitized, id: Date.now().toString() };
        const newInventory = [...inventory, newItem];
        setInventory(newInventory);
        saveData(newInventory, habits, calendarData, customOptions, themeBg);
        addLog('inventory', `新增物品 ${newItem.name}`, `初始库存：${newItem.stock}${newItem.unit}`, newItem.name);
        addLogEntry('Data', `新增物品: ${newItem.name}, 库存: ${newItem.stock}${newItem.unit}`);
        showToast('添加成功');
    };

    const editItem = (itemId, updatedData) => {
        const sanitized = sanitizeItemData(updatedData);
        const oldItem = inventory.find(i => i.id === itemId);
        let changeDetails = [];
        if (oldItem) {
            if (String(oldItem.stock) !== String(sanitized.stock)) changeDetails.push('库存 ' + oldItem.stock + '→' + sanitized.stock);
            if (oldItem.name !== sanitized.name) changeDetails.push('名称 ' + oldItem.name + '→' + sanitized.name);
            if (oldItem.category !== sanitized.category) changeDetails.push('分类 ' + oldItem.category + '→' + sanitized.category);
            if (oldItem.unit !== sanitized.unit) changeDetails.push('单位 ' + oldItem.unit + '→' + sanitized.unit);
            const oldCovers = oldItem.covers ? (Array.isArray(oldItem.covers) ? oldItem.covers : [oldItem.covers]) : [oldItem.cover];
            const newCovers = sanitized.covers || [];
            if (JSON.stringify(oldCovers) !== JSON.stringify(newCovers)) changeDetails.push(`封面已更新（${oldCovers.filter(c => c).length}张→${newCovers.filter(c => c).length}张）`);
            const oldLoc = oldItem.locations || oldItem.location || '未指定';
            const newLoc = sanitized.locations || '未指定';
            if (String(oldLoc) !== String(newLoc)) changeDetails.push('位置 ' + oldLoc + '→' + newLoc);
            if (String(oldItem.threshold || '') !== String(sanitized.threshold || '')) changeDetails.push('预警值 ' + (oldItem.threshold || '未设置') + '→' + (sanitized.threshold || '未设置'));
            if (String(oldItem.expireDays || '') !== String(sanitized.expireDays || '')) changeDetails.push('临期提醒 ' + (oldItem.expireDays || '未设置') + '→' + (sanitized.expireDays || '未设置'));
            if (oldItem.expireDate !== sanitized.expireDate && oldItem.noExpire === sanitized.noExpire) changeDetails.push('过期日期 ' + (oldItem.expireDate || '未设置') + '→' + (sanitized.expireDate || '未设置'));
            if (oldItem.purpose !== sanitized.purpose) changeDetails.push('用途 ' + (oldItem.purpose || '未设置') + '→' + (sanitized.purpose || '未设置'));
            if (oldItem.remark !== sanitized.remark) changeDetails.push('备注 ' + (oldItem.remark || '无') + '→' + (sanitized.remark || '无'));
            if (String(oldItem.noExpire) !== String(sanitized.noExpire)) {
                const fmtDate = d => d ? String(d).replace(/-/g, '.') : '';
                if (sanitized.noExpire) changeDetails.push('过期设置 有期限（' + fmtDate(oldItem.expireDate) + '）→无期限');
                else changeDetails.push('过期设置 无期限→有期限（' + fmtDate(sanitized.expireDate) + '）');
            }
            if (String(oldItem.enableCheckIn || false) !== String(sanitized.enableCheckIn || false)) changeDetails.push('打卡 ' + (oldItem.enableCheckIn ? '已开启' : '未开启') + '→' + (sanitized.enableCheckIn ? '已开启' : '未开启'));
            if (String(oldItem.associateInventory || false) !== String(sanitized.associateInventory || false)) changeDetails.push('关联库存 ' + (oldItem.associateInventory ? '已关联' : '未关联') + '→' + (sanitized.associateInventory ? '已关联' : '未关联'));
            if (sanitized.category === '药品') {
                if (oldItem.dose !== sanitized.dose) changeDetails.push('剂量 ' + (oldItem.dose || '未设置') + '→' + sanitized.dose);
                if (oldItem.freq !== sanitized.freq) changeDetails.push('频次 ' + (oldItem.freq || '未设置') + '→' + sanitized.freq);
                if ((oldItem.timing || '') !== (sanitized.timing || '')) changeDetails.push('服用时机 ' + (oldItem.timing || '不限') + '→' + (sanitized.timing || '不限'));
                if (sanitized.timing === '固定时间' && oldItem.time !== sanitized.time) changeDetails.push('服用时间 ' + (oldItem.time || '未设置') + '→' + (sanitized.time || '未设置'));
            }
        }
        const changeText = changeDetails.length > 0 ? changeDetails.join('；') : '信息更新';

        const newInventory = inventory.map(item => item.id === itemId ? { ...item, ...sanitized } : item);
        setInventory(newInventory);
        saveData(newInventory, habits, calendarData, customOptions, themeBg);
        addLog('inventory', '编辑 ' + sanitized.name, changeText, sanitized.name);
        addLogEntry('Data', '编辑物品: ' + sanitized.name + ', 变更: ' + changeText);
        showToast('修改成功');
    };

    const deleteItem = (itemId) => {
        const item = inventory.find(i => i.id === itemId);
        const newInventory = inventory.filter(i => i.id !== itemId);
        setInventory(newInventory);
        saveData(newInventory, habits, calendarData, customOptions, themeBg);
        addLog('inventory', `删除物品 ${item.name}`, `已清理库存`, item.name);
        addLogEntry('Data', `删除物品: ${item.name}`);
        showToast('删除成功');
    };

    const updateStock = (itemId, amount, itemName, unit) => {
        if (amount === 0) return;
        const newInventory = inventory.map(item => {
            if (item.id === itemId) return { ...item, stock: Math.max(0, item.stock + amount) };
            return item;
        });
        const action = amount > 0 ? '补货了' : '消耗了';
        setInventory(newInventory);
        addLog('inventory', `${action} ${Math.abs(amount)}${unit} ${itemName}`, `剩余库存：${newInventory.find(i => i.id === itemId).stock}${unit}`, itemName);
        saveData(newInventory, habits, calendarData, customOptions, themeBg);
        // 消耗后库存归零要顺带提示补货，不能只报一个变化量
        const after = newInventory.find(i => i.id === itemId);
        const left = after ? Math.round((after.stock || 0) * 10) / 10 : 0;
        showToast(left <= 0 ? `${action} ${Math.abs(amount)}${unit}，库存为 0，需补货` : `${action} ${Math.abs(amount)}${unit}`);
    };

    // 批量改库存：一次事件循环内多条（文字记库存），避免连续调用 updateStock 时互相覆盖旧 state
    const updateStockBatch = (changes) => {
        if (!changes || changes.length === 0) return;
        let next = inventory;
        const results = [];
        changes.forEach(c => {
            if (!c || !c.amount) return;
            next = next.map(it => (it.id === c.itemId ? { ...it, stock: Math.max(0, it.stock + c.amount) } : it));
            const action = c.amount > 0 ? '补货了' : '消耗了';
            const found = next.find(i => i.id === c.itemId);
            results.push({ text: `${action} ${Math.abs(c.amount)}${c.unit || ''} ${c.itemName}`, sub: `剩余库存：${found ? found.stock : 0}${c.unit || ''}`, name: c.itemName });
        });
        setInventory(next);
        results.forEach(r => addLog('inventory', r.text, r.sub, r.name));
        saveData(next, habits, calendarData, customOptions, themeBg);
        showToast(`已记录 ${results.length} 条库存变动`);
    };

    const addHabit = (habit) => {
        const newHabit = { ...habit, id: Date.now().toString() };
        const newHabits = [...habits, newHabit];
        setHabits(newHabits);
        saveData(inventory, newHabits, calendarData, customOptions, themeBg);
        showToast('习惯添加成功');
    };

    const editHabit = (habitId, updatedData) => {
        const newHabits = habits.map(h => h.id === habitId ? { ...h, ...updatedData } : h);
        setHabits(newHabits);
        saveData(inventory, newHabits, calendarData, customOptions, themeBg);
        showToast('习惯修改成功');
    };

    const deleteHabit = (habitId) => {
        const newHabits = habits.filter(h => h.id === habitId);
        setHabits(newHabits);
        saveData(inventory, newHabits, calendarData, customOptions, themeBg);
        showToast('习惯已删除');
    };

    const addHabitRecord = (habitName, tags = '', customTime = null, customDate = null) => {
        const text = `完成 ${habitName} 打卡`;
        const sub = tags ? `标签：${tags}` : '快速打卡';
        const today = customDate || localDateStr();
        const timeStr = customTime || new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const record = { id: Date.now().toString(), time: timeStr, text, sub, category: 'habit', item: habitName };
        const newCalendarData = { ...calendarData };
        if (!newCalendarData[today]) newCalendarData[today] = [];
        newCalendarData[today].unshift(record);
        setCalendarData(newCalendarData);
        saveData(inventory, habits, newCalendarData, customOptions, themeBg);
        showToast(`${habitName} 打卡成功`);
    };

    const addMedicineCheckInRecord = (medName, dose, unit, customTime = null, note = '', customDate = null, associateOverride = undefined) => {
        const today = customDate || localDateStr();
        const timeStr = customTime || new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const targetMed = inventory.find(i => i.name === medName && i.category === '药品');

        // 修复：保存记录时存入当前的关联状态（补打卡可显式指定本次是否关联）
        const isAssociated = associateOverride !== undefined ? associateOverride : (targetMed && targetMed.associateInventory);
        const record = {
            id: Date.now().toString(),
            time: timeStr,
            text: `服用了 ${medName}`,
            sub: `剂量：${dose}${unit} ${note}`,
            category: 'medicine',
            item: medName,
            dose: dose,
            unit: unit,
            isAssociatedAtCheckIn: isAssociated // 关键：记录产生时的状态
        };

        let newInventory = inventory;
        if (isAssociated) {
            newInventory = inventory.map(item => {
                if (item.name === medName && item.category === '药品') return { ...item, stock: (parseFloat(item.stock) || 0) - parseFloat(dose) };
                return item;
            });
        }
        const newCalendarData = { ...calendarData };
        if (!newCalendarData[today]) newCalendarData[today] = [];
        newCalendarData[today].unshift(record);
        setInventory(newInventory); setCalendarData(newCalendarData);
        saveData(newInventory, habits, newCalendarData, customOptions, themeBg);
        showToast(`${medName} 打卡成功`);
    };

    const addItemCheckInRecord = (itemName, amount, unit, customTime = null, note = '', customDate = null, associateOverride = undefined) => {
        const today = customDate || localDateStr();
        const timeStr = customTime || new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const qty = parseFloat(amount);
        const useQty = (isNaN(qty) || qty <= 0) ? 1 : qty;
        const targetItem = inventory.find(i => i.name === itemName && i.category !== '药品');

        // 修复：保存记录时存入当前的关联状态（补打卡可显式指定本次是否关联）
        const isAssociated = associateOverride !== undefined ? associateOverride : (targetItem && targetItem.associateInventory);
        const record = {
            id: Date.now().toString(),
            time: timeStr,
            text: '使用了 ' + itemName,
            sub: ('用量：' + useQty + unit + ' ' + note).trim(),
            category: 'inventory',
            item: itemName,
            dose: useQty,
            unit: unit,
            checkIn: true,
            isAssociatedAtCheckIn: isAssociated // 关键：记录产生时的状态
        };

        let newInventory = inventory;
        if (isAssociated) {
            newInventory = inventory.map(item => {
                if (item.id === targetItem.id) return { ...item, stock: (parseFloat(item.stock) || 0) - useQty };
                return item;
            });
        }
        const newCalendarData = { ...calendarData };
        if (!newCalendarData[today]) newCalendarData[today] = [];
        newCalendarData[today].unshift(record);
        setInventory(newInventory); setCalendarData(newCalendarData);
        saveData(newInventory, habits, newCalendarData, customOptions, themeBg);
        addLogEntry('Data', '物品打卡: ' + itemName + ', 用量: ' + useQty + unit);
        showToast(itemName + ' 打卡成功');
    };

    // 昵称：最多 3 个字符（按 code point 计数，一个表情算一个），独立存储、不并入备份。
    // 截断放在输入层做，这里只管持久化——拼音输入法组词过程中不能硬截断
    const updateNickname = async (name) => {
        const clean = String(name || '');
        setNickname(clean);
        try { await AsyncStorage.setItem('nickname', clean); } catch (e) { addLogEntry('Error', '保存昵称失败: ' + e.message); }
    };

    const clearAllData = async () => {
        setInventory([]); setHabits([]); setCalendarData({});
        setNickname('');
        setCustomOptions({
            categories: ['食品', '日用品', '洗护', '其他'],
            itemUnits: ['盒', '瓶', '袋', '个', '件', '把'],
            medUnits: ['粒', '片', '包', '支', '盒'],
            itemLocations: ['冰箱', '储物柜', '阳台'],
            medLocations: ['药箱', '随身包', '急救包'],
            medFrequencies: ['每日1次', '每日2次', '隔日', '每周几次'],
        });
        setThemeBg('#f7f6f1');
        await AsyncStorage.clear();
        showToast('已恢复出厂设置');
        addLogEntry('Data', '清除了所有数据');
    };

    // 将封面图片压缩后转成 base64，随备份一起导出（否则备份只含本地路径，换设备后封面全丢）
    const collectCoverData = async (items) => {
        const map = {};
        for (const it of items || []) {
            const list = Array.isArray(it.covers) ? it.covers : (it.cover ? [it.cover] : []);
            for (const c of list) {
                if (!c || typeof c !== 'string' || !c.startsWith('file') || map[c]) continue;
                try {
                    const r = await ImageManipulator.manipulateAsync(c, [{ resize: { width: 720 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
                    if (r && r.base64) map[c] = r.base64;
                } catch (e) { /* 该封面已失效，跳过 */ }
            }
        }
        return map;
    };

    // 导入时把 base64 写回 covers 目录，并把 items 里的旧路径替换成本机新路径
    const restoreCoverData = async (items, coverData) => {
        const keys = coverData ? Object.keys(coverData) : [];
        if (keys.length === 0) return items;
        const dir = FileSystem.documentDirectory + 'covers/';
        try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch (e) { }
        const map = {};
        let idx = 0;
        for (const oldUri of keys) {
            try {
                const dest = dir + 'imported_' + Date.now() + '_' + (idx++) + '.jpg';
                await FileSystem.writeAsStringAsync(dest, coverData[oldUri], { encoding: 'base64' });
                map[oldUri] = dest;
            } catch (e) { /* 单张写入失败则跳过 */ }
        }
        return items.map(it => {
            const list = Array.isArray(it.covers) ? it.covers : (it.cover ? [it.cover] : []);
            const newList = list.map(c => map[c] || c);
            return { ...it, covers: newList, cover: map[it.cover] || it.cover || newList[0] };
        });
    };

    const exportData = async (mode) => {
        try {
            showToast('正在打包封面，请稍候…');
            const coverData = await collectCoverData(inventory);
            const data = { inventory, habits, calendarData, customOptions, themeBg, coverData };
            const fileName = `XiaoJiaBen_Backup_${new Date().getTime()}.json`;
            const content = JSON.stringify(data);
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, content);
            if (mode === 'save') {
                if (Platform.OS === 'android') {
                    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (!perm.granted) { showToast('已取消保存'); await dropTmp(fileUri); return; }
                    await AsyncStorage.setItem(ARCHIVE_DIR_KEY, perm.directoryUri).catch(() => { });
                    const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(perm.directoryUri, fileName, 'application/json');
                    await FileSystem.writeAsStringAsync(targetUri, content);
                    await dropTmp(fileUri);
                    showToast('已保存到本地：' + fileName);
                } else if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: '保存小家本备份' });
                    await dropTmp(fileUri);
                } else { showToast('文件已保存到应用沙盒'); }
                return;
            }
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: '导出小家本备份' });
                await dropTmp(fileUri);
            } else { showToast('文件已保存到应用沙盒'); }
        } catch (e) { showToast('导出失败: ' + e.message); }
    };

    const importData = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
            if (!result.canceled) {
                const fileUri = result.assets[0].fileCopyUri || result.assets[0].uri;
                const response = await fetch(fileUri);
                const fileContent = await response.text();
                const data = JSON.parse(fileContent);
                if (data.inventory && data.calendarData) {
                    // 兼容旧版备份：物品字段补齐 + cover→covers 迁移（避免旧数据编辑时封面被清成默认）
                    const migratedInventory = (data.inventory || []).map(it => {
                        const covers = (it.covers && Array.isArray(it.covers) && it.covers.length > 0) ? it.covers : (it.cover ? [it.cover] : ['📦']);
                        return {
                            ...it,
                            covers,
                            cover: it.cover || covers[0],
                            locations: it.locations || it.location || '',
                            location: it.location || '',
                            purpose: it.purpose || '',
                            remark: it.remark || '',
                            enableCheckIn: it.enableCheckIn !== undefined ? it.enableCheckIn : false,
                            associateInventory: it.associateInventory !== undefined ? it.associateInventory : false,
                            // 旧备份没有这些字段，补默认（提醒默认关闭）
                            remindOn: it.remindOn !== undefined ? !!it.remindOn : false,
                            remindRepeat: it.remindRepeat || 'daily',
                            remindWeekdays: Array.isArray(it.remindWeekdays) ? it.remindWeekdays : [],
                            remindTimes: Array.isArray(it.remindTimes) ? it.remindTimes : [],
                            remindAdvance: (it.remindAdvance !== undefined && it.remindAdvance !== null && it.remindAdvance !== '') ? Number(it.remindAdvance) : 0,
                        };
                    });
                    // 兼容旧版 customOptions（units/locations → itemUnits/itemLocations）
                    let migratedOptions = { ...customOptions };
                    if (data.customOptions) {
                        const p = data.customOptions;
                        if (p.units && !p.itemUnits) {
                            migratedOptions = {
                                ...customOptions,
                                categories: p.categories || customOptions.categories,
                                itemUnits: [...p.units],
                                itemLocations: [...(p.locations || [])],
                            };
                        } else {
                            migratedOptions = { ...customOptions, ...p };
                        }
                    }
                    const migratedHabits = data.habits || [];
                    const inventoryWithCovers = await restoreCoverData(migratedInventory, data.coverData);
                    setInventory(inventoryWithCovers); setHabits(migratedHabits); setCalendarData(data.calendarData);
                    setCustomOptions(migratedOptions);
                    if (data.themeBg) setThemeBg(data.themeBg);
                    saveData(inventoryWithCovers, migratedHabits, data.calendarData, migratedOptions, data.themeBg || themeBg);
                    showToast('恢复成功！');
                    addLogEntry('Data', `成功导入数据，物品数: ${inventoryWithCovers.length}（已兼容旧版格式）`);
                } else { showToast('文件格式不正确'); }
            }
        } catch (e) { showToast('导入失败: ' + e.message); }
    };

    return (
        <AppContext.Provider value={{
            inventory, habits, calendarData, customOptions, themeBg, nickname, themeColors, toastMsg, toastVisible, debugLogs, showToast,
            addItem, editItem, deleteItem, updateStock, updateStockBatch, addHabit, editHabit, deleteHabit,
            addHabitRecord, addMedicineCheckInRecord, addItemCheckInRecord, removeLog, addCustomOption, clearAllData, exportData, importData, getItemStatus, updateTheme, updateNickname,
            notifPrefs, updateNotifPrefs,
            collectArchiveFiles, deleteArchiveFiles, getArchiveDirUri, pickArchiveDir,
            addLogEntry, exportLogs, deleteRecordWithStockRestore, updateCustomOptionList
        }}>
            {children}
        </AppContext.Provider>
    );
};