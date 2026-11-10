import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, FlatList, PanResponder, Animated, unstable_batchedUpdates, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS, THEME_COLORS } from '../theme';
import { searchColorNames, contrastText } from '../colorNames';
import { checkUpdate, downloadAndInstallApk, UPDATE_CONFIG } from '../updater';
import { getPermissionStatus, requestPermission, openNotifSettings, openBatterySettings, openPermissionSettings } from '../notifications';

// 行高（初次测量前的默认值）
const ROW_H = 48;

// 文件大小：B / KB / MB
const formatSize = (bytes) => {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
};

// 导出时刻：YYYY-MM-DD HH:mm
const formatArchiveTime = (ms) => {
    const n = Number(ms) || 0;
    if (n <= 0) return '';
    const d = new Date(n);
    const p = (v) => (v < 10 ? '0' + v : '' + v);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 偏好行子组件
const PrefRow = ({
    item, index, isDragging,
    renameIndex, renameText, setRenameText,
    startRename, deletePrefItem, confirmRename,
    handleResponder, onRowLayout, registerAnim,
}) => {
    const animY = useRef(new Animated.Value(0)).current;
    const { themeColors: tc } = useContext(AppContext);

    // 将本行的让位动画值注册给父组件，拖动中由父组件直接驱动（不触发 React 重渲染）
    useEffect(() => {
        registerAnim(item, animY);
        return () => registerAnim(item, null);
    }, [item, registerAnim]);

    return (
        <Animated.View
            onLayout={onRowLayout}
            style={[
                styles.prefEditRow,
                // 拖动时：整行浅绿圆角填充（无白边、无阴影），内容向中间留出 8px 间距
                isDragging && {
                    backgroundColor: 'rgba(142, 170, 139, 0.22)',
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    borderBottomWidth: 0,
                },
                {
                    // 所有行统一用 animY 驱动位移（被拖行也写 animY），避免松手切换 transform 导致闪回
                    transform: [{ translateY: animY }],
                    zIndex: isDragging ? 10 : 1,
                },
            ]}
        >
            {renameIndex === index ? (
                <View style={{ flexDirection: 'row', flex: 1, gap: 8, zIndex: 2 }}>
                    <TextInput
                        style={[styles.input, { flex: 1, padding: 8, backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]}
                        value={renameText}
                        onChangeText={setRenameText}
                        autoFocus
                    />
                    <TouchableOpacity style={[styles.prefConfirmBtn, { backgroundColor: tc.accent }]} onPress={confirmRename}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>✓</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <Text style={{ flex: 1, fontSize: 15, color: tc.textMain, zIndex: 2 }}>{item}</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2 }}>
                <TouchableOpacity onPress={() => startRename(index)} style={styles.prefIconBtn}>
                    <Text style={styles.prefIconBtnText}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deletePrefItem(index)} style={styles.prefIconBtn}>
                    <Text style={[styles.prefIconBtnText, { color: COLORS.pink }]}>✕</Text>
                </TouchableOpacity>
                <View style={[styles.dragHandle, isDragging && styles.dragHandleActive]} {...handleResponder.panHandlers}>
                    <View style={styles.dragBars}>
                        <View style={styles.dragBar} />
                        <View style={styles.dragBar} />
                        <View style={styles.dragBar} />
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

export default function UserScreen() {
    const { exportData, importData, clearAllData, themeBg, themeColors: tc, updateTheme, exportLogs, debugLogs, customOptions, updateCustomOptionList, nickname, updateNickname, notifPrefs, updateNotifPrefs, collectArchiveFiles, deleteArchiveFiles, pickArchiveDir } = useContext(AppContext);
    const [settingsVisible, setSettingsVisible] = useState(false);
    // 消息提醒弹窗
    const [notifVisible, setNotifVisible] = useState(false);
    // 通知权限状态：只有它能自动检测，其余系统开关只能跳转引导
    const [notifPermStatus, setNotifPermStatus] = useState('undetermined');
    // 本地存档清理：文件清单 + 手动勾选
    const [archiveVisible, setArchiveVisible] = useState(false);
    const [archiveFiles, setArchiveFiles] = useState([]);
    const [archivePick, setArchivePick] = useState({});
    // 昵称最多 6 个字符：末尾是英文字母说明拼音还没上屏，此时不截断，否则输入法组词会被打断
    const handleNickChange = (t) => {
        const chars = Array.from(t || '');
        const last = chars[chars.length - 1] || '';
        if (chars.length > 6 && !/[a-zA-Z]/.test(last)) updateNickname(chars.slice(0, 6).join(''));
        else updateNickname(t);
    };
    const normalizeNick = () => updateNickname(Array.from(nickname || '').slice(0, 6).join(''));
    // 本地存档：进页面读一次清单（沙盒残留 + 用户上次保存目录），点卡片时再刷新
    useEffect(() => {
        let alive = true;
        collectArchiveFiles()
            .then(r => { if (alive) setArchiveFiles((r && r.list) || []); })
            .catch(() => { });
        return () => { alive = false; };
    }, []);
    const openArchive = async () => {
        try {
            const r = await collectArchiveFiles();
            setArchiveFiles((r && r.list) || []);
        } catch (e) { }
        setArchivePick({});
        setArchiveVisible(true);
    };
    const toggleArchivePick = (uri) => setArchivePick(prev => ({ ...prev, [uri]: !prev[uri] }));
    const archivePickedCount = archiveFiles.filter(f => archivePick[f.uri]).length;
    const chooseArchiveDir = async () => {
        const dir = await pickArchiveDir();
        if (!dir) { setTipMsg('已取消，或没有授予目录访问权限'); setTipVisible(true); return; }
        let r = { list: [], scanned: 0 };
        try { r = await collectArchiveFiles(); } catch (e) { }
        setArchiveFiles((r && r.list) || []);
        const savedCount = ((r && r.list) || []).filter(f => f.where === 'saved').length;
        setTipMsg(savedCount > 0
            ? `已读取到 ${savedCount} 个存档文件`
            : `这个目录里没有小家本的存档文件（读到 ${(r && r.scanned) || 0} 个条目）`);
        setTipVisible(true);
    };
    // 消息提醒开关：首次开启时申请通知权限；被拒就提示去系统设置
    const toggleNotif = async (key) => {
        const enabled = !notifPrefs[key];
        updateNotifPrefs({ [key]: enabled });
        const next = { ...notifPrefs, [key]: enabled };
        if (!next.checkIn && !next.expiring && !next.expired) return;
        const status = await getPermissionStatus();
        if (status !== 'granted') {
            const ok = await requestPermission();
            if (!ok) { setTipMsg('未获得通知权限，正在打开系统通知设置'); setTipVisible(true); openNotifSettings().catch(() => { }); }
        }
    };
    // 打开消息提醒弹窗时顺手刷新一次通知权限
    const openNotifModal = async () => {
        setNotifVisible(true);
        try { setNotifPermStatus(await getPermissionStatus()); } catch (e) { }
    };
    const refreshNotifPerm = async () => {
        try { setNotifPermStatus(await getPermissionStatus()); } catch (e) { }
    };
    // 系统设置引导：跳不过去就给文字兜底
    const gotoSystemSetting = async (fn) => {
        const ok = await fn();
        if (!ok) { setTipMsg('没找到对应的设置页，请手动到 系统设置 → 应用管理 → 小家本 里设置'); setTipVisible(true); }
    };
    const [customColor, setCustomColor] = useState('#f7f6f1');
    const [colorPreview, setColorPreview] = useState('');
    // 颜色名检索结果（输入「雾霾蓝」这类名称时展示候选色块）
    const [colorMatches, setColorMatches] = useState([]);
    // 主题色选择改为“预览 + 保存”：pendingBg 为弹窗内临时选中色，点“保存”才生效
    const [pendingBg, setPendingBg] = useState('#f7f6f1');

    const [prefsVisible, setPrefsVisible] = useState(false);
    const [editKey, setEditKey] = useState('');
    const [editList, setEditList] = useState([]);
    const [newItemText, setNewItemText] = useState('');
    const [renameIndex, setRenameIndex] = useState(null);
    const [renameText, setRenameText] = useState('');
    // 统一提示弹窗（替代 Alert）
    const [tipVisible, setTipVisible] = useState(false);
    const [tipMsg, setTipMsg] = useState('');
    // 删除标签确认弹窗
    const [delPrefVisible, setDelPrefVisible] = useState(false);
    const [delPrefIndex, setDelPrefIndex] = useState(null);
    // 标签弹窗退出确认（仅退出 / 保存并退出）
    const [prefsExitVisible, setPrefsExitVisible] = useState(false);
    // 清除数据二次确认
    const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
    const [exportChoiceVisible, setExportChoiceVisible] = useState(false);

    const rowHRef = useRef(ROW_H);
    const measuredRef = useRef(false);

    // 各行让位动画值注册表：拖动中由父组件直接驱动（零 React 重渲染，保证跟手）
    const rowAnimRefs = useRef({});
    const registerAnim = (item, anim) => {
        if (anim) rowAnimRefs.current[item] = anim;
        else delete rowAnimRefs.current[item];
    };

    const [dragIndex, setDragIndex] = useState(null);

    const listRef = useRef(null);
    const editListRef = useRef(editList);
    const dragRef = useRef({ index: null, from: null, target: null, list: [], touchDy: 0, scrollAcc: 0 });

    useEffect(() => { editListRef.current = editList; }, [editList]);
    // 每次打开设置弹窗时，将临时选中色重置为当前已保存主题色
    useEffect(() => { if (settingsVisible) setPendingBg(themeBg); }, [settingsVisible]);

    // 自定义颜色输入：合法 hex 直接预览；否则按颜色名检索候选色块
    const handleColorInput = (t) => {
        setCustomColor(t);
        if (/^#[0-9A-Fa-f]{6}$/.test(t.trim())) {
            setColorPreview(t.trim());
            setPendingBg(t.trim());
            setColorMatches([]);
        } else {
            setColorMatches(searchColorNames(t));
        }
    };
    const applyColorName = (value) => {
        setCustomColor(value);
        setColorPreview(value);
        setPendingBg(value);
        setColorMatches([]);
    };

    // 偏好设置弹窗：右滑关闭（水平手势优先，不影响内部 ScrollView 垂直滚动）
    const settingsPan = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dx > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => { if (g.dx > 90) setSettingsVisible(false); },
    })).current;

    const resetDragState = () => {
        dragRef.current = { index: null, from: null, target: null, list: [], touchDy: 0, scrollAcc: 0 };
        setDragIndex(null);
    };

    const endDrag = () => { stopAutoScroll(); resetDragState(); };

    const applyDragDy = () => {
        const d = dragRef.current;
        if (d.index === null) return;
        const rh = rowHRef.current || ROW_H;
        const totalDy = d.touchDy + d.scrollAcc;

        // 被拖行直接更新自己的动画值（纯原生层更新，不触发 React Render）
        const selfAnim = rowAnimRefs.current[d.list[d.from]];
        if (selfAnim) selfAnim.setValue(totalDy);

        const maxTarget = d.list.length - 1;
        let target = d.from + Math.floor(totalDy / rh + 0.5);
        target = Math.max(0, Math.min(maxTarget, target));

        // 跨越行中心才触发一次让位：直接驱动其他行的动画值，全程不触发 React 重渲染
        if (target !== d.target) {
            d.target = target;
            const list = d.list;
            for (let i = 0; i < list.length; i++) {
                if (i === d.from) continue;
                let shift = 0;
                if (target > d.from && i > d.from && i <= target) shift = -rh;
                else if (target < d.from && i >= target && i < d.from) shift = rh;
                const rowAnim = rowAnimRefs.current[list[i]];
                if (rowAnim) {
                    if (shift === 0) rowAnim.setValue(0);
                    else Animated.timing(rowAnim, { toValue: shift, duration: 60, useNativeDriver: true }).start();
                }
            }
        }
    };

    const commitDrag = () => {
        const d = dragRef.current;
        const shouldCommit = d.index !== null && d.target !== null && d.target !== d.from;
        unstable_batchedUpdates(() => {
            if (shouldCommit) {
                const nl = [...d.list];
                const [moved] = nl.splice(d.from, 1);
                nl.splice(d.target, 0, moved);
                setEditList(nl);
                editListRef.current = nl;
            }
            stopAutoScroll();
            dragRef.current = { index: null, from: null, target: null, list: [], touchDy: 0, scrollAcc: 0 };
            setDragIndex(null);
        });
        // 归零必须在渲染提交之后：此时 cell 已到新位置，行直接落在目标位。
        // 若在渲染前归零，原生层会先把 transform 置 0（cell 还在旧位置）→ 闪回原位一帧
        requestAnimationFrame(() => {
            Object.values(rowAnimRefs.current).forEach(a => { if (a) a.setValue(0); });
        });
    };

    const listWrapRef = useRef(null);
    const listScreenRef = useRef({ y: 0, height: 0 });
    const listOffsetRef = useRef(0);
    const listContentRef = useRef(0);
    const autoScrollRef = useRef(null);

    const measureListRect = () => {
        if (listWrapRef.current && listWrapRef.current.measureInWindow) {
            listWrapRef.current.measureInWindow((x, y, w, h) => {
                listScreenRef.current = { y, height: h };
            });
        }
    };

    const stopAutoScroll = () => { if (autoScrollRef.current) { clearInterval(autoScrollRef.current.timer); autoScrollRef.current = null; } };

    const startAutoScroll = (dir) => {
        if (autoScrollRef.current) {
            if (autoScrollRef.current.dir === dir) return;
            stopAutoScroll();
        }
        autoScrollRef.current = {
            dir, timer: setInterval(() => {
                const d = dragRef.current;
                if (d.index === null) { stopAutoScroll(); return; }
                const step = 3;
                const maxOffset = Math.max(0, listContentRef.current - listScreenRef.current.height);
                const next = listOffsetRef.current + dir * step;
                if (next < 0 || next > maxOffset) { stopAutoScroll(); return; }
                if (listRef.current) listRef.current.scrollToOffset({ offset: next, animated: false });
                listOffsetRef.current = next;
                d.scrollAcc += dir * step;
                applyDragDy();
            }, 16)
        };
    };

    const updateAutoScroll = (g) => {
        const { y, height } = listScreenRef.current;
        if (!height) { stopAutoScroll(); return; }
        const relY = g.moveY - y;
        const maxOffset = Math.max(0, listContentRef.current - height);
        if (relY < 40) { if (listOffsetRef.current <= 0) { stopAutoScroll(); return; } startAutoScroll(-1); }
        else if (relY > height - 40) { if (listOffsetRef.current >= maxOffset) { stopAutoScroll(); return; } startAutoScroll(1); }
        else stopAutoScroll();
    };

    const makeHandleResponder = (item) => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // 用 capture 阶段抢回响应权：列表可滚时 ScrollView 会在 capture 阶段先成为 responder，
        // 只有 capture 的 move 才能在滚动开始前把手势接管回来，保证按住手柄拖动稳定生效
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 3 || Math.abs(g.dx) > 3,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
            // 用 item 定位当前 index（数据重排后仍准确），避免闭包里的旧 index 拖到别的行
            const idx = editListRef.current.indexOf(item);
            if (idx < 0) return;
            measureListRect();
            dragRef.current = { index: idx, from: idx, target: idx, list: editListRef.current, touchDy: 0, scrollAcc: 0 };
            setDragIndex(idx);
            const selfAnim = rowAnimRefs.current[item];
            if (selfAnim) selfAnim.setValue(0);
        },
        onPanResponderMove: (_, g) => {
            dragRef.current.touchDy = g.dy;
            applyDragDy();
            updateAutoScroll(g);
        },
        onPanResponderRelease: commitDrag,
        onPanResponderTerminate: commitDrag,
    });

    const copyLogs = () => {
        const logText = debugLogs.join('\n');
        Clipboard.setStringAsync(logText || '暂无日志');
        setTipMsg('日志已复制到剪贴板'); setTipVisible(true);
    };

    // 升级更新：进“我的”页静默检测（5 分钟内不重复请求，避免触发 GitHub 频率限制）
    const [updateInfo, setUpdateInfo] = useState(null);
    const [updateVisible, setUpdateVisible] = useState(false);
    const [updateChecking, setUpdateChecking] = useState(false);
    const [updateDownloading, setUpdateDownloading] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateMsg, setUpdateMsg] = useState('');
    const lastUpdateCheck = useRef(0);

    useFocusEffect(useCallback(() => {
        // 在线升级只做 Android（iOS 未上架、无 TestFlight，不展示该入口）
        if (Platform.OS !== 'android') return undefined;
        let alive = true;
        const now = Date.now();
        if (now - lastUpdateCheck.current < 5 * 60 * 1000) return () => { alive = false; };
        lastUpdateCheck.current = now;
        (async () => {
            const info = await checkUpdate();
            if (alive) setUpdateInfo(info);
        })();
        return () => { alive = false; };
    }, []));

    const openUpdateModal = async () => {
        setUpdateMsg('');
        setUpdateProgress(0);
        setUpdateVisible(true);
        setUpdateChecking(true);
        const info = await checkUpdate();
        setUpdateInfo(info);
        setUpdateChecking(false);
    };

    const handleUpdateAction = async () => {
        if (!updateInfo) return;
        if (Platform.OS === 'ios') {
            if (UPDATE_CONFIG.iosAppStoreUrl) Linking.openURL(UPDATE_CONFIG.iosAppStoreUrl);
            else if (UPDATE_CONFIG.iosTestFlightUrl) Linking.openURL(UPDATE_CONFIG.iosTestFlightUrl);
            else setUpdateMsg('iOS 版暂未上架：可用 TestFlight 邀请链接，或用电脑重新安装');
            return;
        }
        // 以下仅 Android 执行
        setUpdateDownloading(true);
        setUpdateProgress(0);
        setUpdateMsg('');
        const r = await downloadAndInstallApk(updateInfo.apkUrl, p => setUpdateProgress(p));
        setUpdateDownloading(false);
        if (!r.ok) setUpdateMsg(r.message || '下载失败');
    };

    const renderCard = (icon, title, sub, onPress, showDot) => (
        <TouchableOpacity style={[styles.card, { backgroundColor: tc.cardBg }]} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.iconContainer}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
            <View style={styles.cardTextContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.cardTitle, { color: tc.textMain }]}>{title}</Text>
                    {showDot ? <View style={styles.updateDot} /> : null}
                </View>
                <Text style={[styles.cardSub, { color: tc.textSub }]}>{sub}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
    );

    const openPrefEditor = (key) => {
        setEditKey(key);
        setEditList(customOptions[key] || []);
        setNewItemText('');
        setRenameIndex(null);
        setRenameText('');
        setPrefsVisible(true);
    };

    const savePrefList = () => {
        if (editKey) {
            updateCustomOptionList(editKey, editList);
        }
    };

    const addPrefItem = () => {
        const text = newItemText.trim();
        if (text && !editList.includes(text)) {
            setEditList([...editList, text]);
            setNewItemText('');
            setTimeout(() => listRef.current && listRef.current.scrollToEnd({ animated: true }), 80);
        }
    };

    const deletePrefItem = (index) => {
        setDelPrefIndex(index); setDelPrefVisible(true);
    };

    const startRename = (index) => {
        setRenameIndex(index);
        setRenameText(editList[index]);
    };

    const confirmRename = () => {
        if (renameIndex !== null) {
            const text = renameText.trim();
            if (!text) { setTipMsg('请输入文字'); setTipVisible(true); return; }
            if (editList.some((t, i) => i !== renameIndex && t === text)) { setTipMsg('已存在同名标签'); setTipVisible(true); return; }
            const newList = [...editList];
            newList[renameIndex] = text;
            setEditList(newList);
            setRenameIndex(null);
        }
    };

    const getKeyTitle = (key) => {
        const map = {
            categories: '物品分类标签',
            itemUnits: '物品单位标签',
            medUnits: '药品单位标签',
            itemLocations: '物品存放位置',
            medLocations: '药品存放位置',
            medFrequencies: '药品打卡频次',
        };
        return map[key] || '偏好设置';
    };

    const onRowLayout = (e) => {
        if (!measuredRef.current) {
            measuredRef.current = true;
            rowHRef.current = e.nativeEvent.layout.height;
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: tc.bg }]}>
            <Text style={[styles.headerTitle, { color: tc.textMain }]}>我的</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* 昵称：最多 6 个字符，表情也算一个，实时写盘，首页立刻跟着变 */}
                <View style={[styles.card, { backgroundColor: tc.cardBg }]}>
                    <View style={styles.iconContainer}><Text style={{ fontSize: 20 }}>👤</Text></View>
                    <View style={styles.cardTextContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.cardTitle, { color: tc.textMain }]}>昵称</Text>
                            <Text style={{ fontSize: 12, color: tc.textSub, marginLeft: 8 }}>{Array.from(nickname || '').length}/6</Text>
                        </View>
                        <TextInput
                            style={[styles.nickInput, { color: tc.textMain }]}
                            value={nickname}
                            onChangeText={handleNickChange}
                            onEndEditing={normalizeNick}
                            onBlur={normalizeNick}
                            placeholder="最多 6 个字，可用表情"
                            placeholderTextColor={tc.textLight}
                            numberOfLines={1}
                        />
                    </View>
                </View>
                {renderCard('📤', '数据备份导出', '保存到本地文件夹，或分享给其他应用', () => setExportChoiceVisible(true))}
                {renderCard('📥', '数据恢复导入', '从本地文件恢复数据', importData)}
                {renderCard('📄', '导出调试日志', '导出用于排查问题的日志文件', exportLogs)}
                {renderCard('📋', '复制调试日志', '将日志复制到剪贴板', copyLogs)}
                {renderCard('🗂️', '清理本地存档', archiveFiles.length > 0 ? `已检测到 ${archiveFiles.length} 个存档文件，可勾选删除` : '导出生成的备份与日志文件', openArchive)}
                {renderCard('⚙️', '偏好设置', '标签管理、自定义偏好', () => setSettingsVisible(true))}
                {renderCard('🔔', '消息提醒', '打卡、临期、过期提醒开关', openNotifModal)}
                {Platform.OS === 'android' && renderCard('⬆️', '升级更新', updateInfo && updateInfo.hasUpdate ? `发现新版本 v${updateInfo.latest}` : '检查并安装新版本（不强制升级）', openUpdateModal, !!(updateInfo && updateInfo.hasUpdate))}
            </ScrollView>

            <Modal visible={updateVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setUpdateVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setUpdateVisible(false)}>
                    <View style={[styles.updateModal, { backgroundColor: tc.modalBg }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: tc.textMain }]}>升级更新</Text>
                            <TouchableOpacity onPress={() => setUpdateVisible(false)}><Text style={{ fontSize: 22, color: tc.textSub }}>✕</Text></TouchableOpacity>
                        </View>
                        {updateChecking ? <Text style={[styles.updateNotes, { color: tc.textSub }]}>正在检查更新…</Text> : null}
                        {!updateChecking && updateInfo && updateInfo.hasUpdate ? (
                            <>
                                <Text style={[styles.updateNotes, { color: tc.textMain, fontWeight: '600' }]}>新版本 v{updateInfo.latest}（当前 v{updateInfo.current}）</Text>
                                {updateInfo.notes ? (
                                    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260, marginTop: 6 }} showsVerticalScrollIndicator={true}>
                                        {parseReleaseNotes(updateInfo.notes).map((line, i) => (
                                            <Text
                                                key={i}
                                                style={[styles.updateNotes, { color: line.heading ? tc.textMain : tc.textSub }, line.heading && { fontWeight: '600', marginTop: 8 }]}
                                            >{line.text}</Text>
                                        ))}
                                    </ScrollView>
                                ) : null}
                                {updateDownloading ? (
                                    <>
                                        <View style={[styles.updateProgressOuter, { backgroundColor: tc.cardSubBg }]}>
                                            <View style={[styles.updateProgressInner, { width: `${Math.round(updateProgress * 100)}%` }]} />
                                        </View>
                                        <Text style={[styles.updateNotes, { color: tc.textSub }]}>下载中 {Math.round(updateProgress * 100)}%</Text>
                                    </>
                                ) : null}
                                {updateMsg ? <Text style={{ color: COLORS.orange, fontSize: 12, marginTop: 6 }}>{updateMsg}</Text> : null}
                                <TouchableOpacity disabled={updateDownloading} style={[styles.saveBtn, { backgroundColor: tc.accent, marginTop: 14, opacity: updateDownloading ? 0.6 : 1 }]} onPress={handleUpdateAction}>
                                    <Text style={{ color: '#fff', fontWeight: '600' }}>{Platform.OS === 'ios' ? (UPDATE_CONFIG.iosAppStoreUrl || UPDATE_CONFIG.iosTestFlightUrl ? '前往商店更新' : 'iOS 暂不支持应用内安装') : '下载并安装'}</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                        {!updateChecking && updateInfo && !updateInfo.hasUpdate ? (
                            <Text style={[styles.updateNotes, { color: tc.textSub }]}>
                                {updateInfo.configured === false ? '更新通道未配置（请先在 src/updater.js 填写 GitHub 仓库）' : (updateInfo.error ? ('检查失败：' + updateInfo.error) : '已是最新版本')}
                            </Text>
                        ) : null}
                    </View>
                </TouchableOpacity>
            </Modal>
            <Modal visible={notifVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setNotifVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNotifVisible(false)}>
                    <View style={[styles.updateModal, { backgroundColor: tc.modalBg }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: tc.textMain }]}>消息提醒</Text>
                            <TouchableOpacity onPress={() => setNotifVisible(false)}><Text style={{ fontSize: 22, color: tc.textSub }}>✕</Text></TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flexShrink: 1 }}>
                        {[
                            ['checkIn', '打卡提醒', '按条目里设置的提醒时间推送；App 里打过卡后当天不再提醒'],
                            ['expiring', '临期提醒', '到期前 N 天提醒，只提醒填了「临期提前提醒(天)」的条目'],
                            ['expired', '过期提醒', '到期当天上午 9:00 提醒'],
                        ].map(([key, title, sub]) => (
                            <TouchableOpacity key={key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tc.border }} onPress={() => toggleNotif(key)}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <Text style={{ color: tc.textMain, fontWeight: '600' }}>{title}</Text>
                                    <Text style={{ color: tc.textSub, fontSize: 12, marginTop: 4, lineHeight: 18 }}>{sub}</Text>
                                </View>
                                <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, backgroundColor: notifPrefs[key] ? tc.accent : tc.cardSubBg }}>
                                    <Text style={{ color: notifPrefs[key] ? tc.accentText : tc.textSub, fontSize: 13, fontWeight: '600' }}>{notifPrefs[key] ? '开' : '关'}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                        <Text style={{ color: tc.textSub, fontSize: 12, marginTop: 14, lineHeight: 19 }}>提醒是本地通知，不需要联网。若收不到：系统设置里允许「小家本」通知，并允许自启动、关闭电池优化限制。</Text>

                        <Text style={{ color: tc.textMain, fontWeight: '600', marginTop: 18, marginBottom: 4 }}>系统提醒设置</Text>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }} onPress={refreshNotifPerm}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, marginRight: 8, backgroundColor: notifPermStatus === 'granted' ? tc.accent : '#D9534F' }} />
                            <Text style={{ color: tc.textSub, fontSize: 12, flex: 1 }}>{notifPermStatus === 'granted' ? '通知权限：已允许' : '通知权限：未允许，系统会把提醒拦掉'}</Text>
                            <Text style={{ color: tc.accent, fontSize: 12, fontWeight: '600' }}>重新检测</Text>
                        </TouchableOpacity>
                        {[
                            ['通知', '允许通知、横幅、锁屏显示', openNotifSettings],
                            ['省电策略', '改成「无限制」，不要留「智能省电」', openBatterySettings],
                            ['自启动 / 后台弹出', '小米·红米在这一页把这两项都打开', openPermissionSettings],
                        ].map(([title, sub, fn]) => (
                            <TouchableOpacity key={title} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: tc.border }} onPress={() => gotoSystemSetting(fn)}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text style={{ color: tc.textMain, fontSize: 13, fontWeight: '600' }}>{title}</Text>
                                    <Text style={{ color: tc.textSub, fontSize: 11, marginTop: 3, lineHeight: 16 }}>{sub}</Text>
                                </View>
                                <Text style={{ color: tc.accent, fontSize: 12, fontWeight: '600' }}>去设置 ›</Text>
                            </TouchableOpacity>
                        ))}
                        <Text style={{ color: tc.textSub, fontSize: 11, marginTop: 10, lineHeight: 17 }}>手动路径：设置 → 应用设置 → 小家本 → 自启动 / 省电策略。部分机型操作步骤不一致，具体以官方设置为准，该路径仅供参考。</Text>
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
            <Modal visible={settingsVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSettingsVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSettingsVisible(false)}>
                    <View style={[styles.modalContent, { backgroundColor: tc.modalBg }]} {...settingsPan.panHandlers}>
                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} style={{ flexShrink: 1 }}>
                        <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: tc.textMain }]}>主题与偏好设置</Text><TouchableOpacity onPress={() => setSettingsVisible(false)}><Text style={{ fontSize: 24, color: tc.textSub }}>✕</Text></TouchableOpacity></View>

                        <Text style={[styles.settingLabel, { color: tc.textMain }]}>选择背景颜色</Text>
                        <View style={styles.colorPalette}>
                            {THEME_COLORS.map((color) => {
                                const cv = color.value;
                                return (
                                    <TouchableOpacity key={color.value} style={[styles.colorCircle, { backgroundColor: cv, borderColor: tc.border }, pendingBg === cv && styles.colorCircleActive]} onPress={() => setPendingBg(cv)}>
                                        {pendingBg === cv && <Text style={styles.checkMark}>✓</Text>}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={[styles.settingLabel, { color: tc.textSub, fontSize: 12, fontWeight: '500', marginLeft: 18, marginTop: 2, marginBottom: 8 }]}>自定义颜色（作为选择背景色的子选项）</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: colorMatches.length > 0 ? 8 : 20, marginLeft: 18 }}>
                            <View style={[styles.colorCircle, { width: 38, height: 38, borderRadius: 19, backgroundColor: colorPreview || 'transparent', borderColor: colorPreview ? tc.border : tc.textLight, borderStyle: colorPreview ? 'solid' : 'dashed' }]}>
                                {colorPreview
                                    ? (pendingBg === colorPreview && <Text style={[styles.checkMark, { fontSize: 16, color: contrastText(colorPreview) }]}>✓</Text>)
                                    : <Text style={{ color: tc.textLight, fontSize: 9 }}>未选</Text>}
                            </View>
                            <TextInput style={[styles.input, { flex: 1, backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain, fontSize: 13, paddingVertical: 8 }]} value={customColor} onChangeText={handleColorInput} placeholder="色值或颜色名，如 雾霾蓝" numberOfLines={1} placeholderTextColor={tc.textLight} />
                        </View>
                        {colorMatches.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 18, marginBottom: 16 }}>
                                {colorMatches.map(c => (
                                    <TouchableOpacity key={c.value} style={[styles.colorNameChip, { backgroundColor: c.value, borderColor: tc.border }, pendingBg === c.value && { borderWidth: 2, borderColor: tc.accent }]} onPress={() => applyColorName(c.value)}>
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: contrastText(c.value) }}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        <TouchableOpacity style={[styles.saveThemeBtn, { backgroundColor: tc.accent }]} onPress={() => { if (pendingBg && pendingBg !== themeBg) updateTheme(pendingBg); setSettingsVisible(false); }}>
                            <Text style={{ color: tc.accentText, fontWeight: '600', fontSize: 16 }}>保存</Text>
                        </TouchableOpacity>

                        <Text style={[styles.settingLabel, { color: tc.textMain }]}>偏好标签管理</Text>
                        {Object.keys(customOptions).map(key => (
                            <TouchableOpacity key={key} style={styles.prefItem} onPress={() => openPrefEditor(key)}>
                                <Text style={[styles.prefItemText, { color: tc.textMain }]}>{getKeyTitle(key)}</Text>
                                <Text style={{ color: tc.textSub, fontSize: 12 }}>当前 {customOptions[key].length} 项</Text>
                                <Text style={styles.arrow}>›</Text>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity style={[styles.settingItem, { borderBottomWidth: 0 }]} onPress={() => setClearConfirmVisible(true)}>
                            <Text style={[styles.settingText, { color: COLORS.pink }]}>清除所有数据（出厂设置）</Text>
                            <Text style={styles.settingValue}>⚠️</Text>
                        </TouchableOpacity>
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={prefsVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { endDrag(); setPrefsExitVisible(true); }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '70%', backgroundColor: tc.modalBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: tc.textMain }]}>{getKeyTitle(editKey)}</Text>
                            <TouchableOpacity onPress={() => { endDrag(); setPrefsExitVisible(true); }}><Text style={{ fontSize: 24, color: tc.textSub }}>✕</Text></TouchableOpacity>
                        </View>

                        <View style={{ flex: 1 }} ref={listWrapRef} onLayout={measureListRect}>
                            <FlatList
                                ref={listRef}
                                data={editList}
                                keyExtractor={(item) => item}
                                style={{ flex: 1 }}
                                scrollEnabled={dragIndex === null}
                                removeClippedSubviews={false} // 防止安卓端拖出边界时被系统回收引发空白
                                contentContainerStyle={{ paddingBottom: 10 }}
                                scrollEventThrottle={16}
                                onScroll={e => { listOffsetRef.current = e.nativeEvent.contentOffset.y; }}
                                onContentSizeChange={(w, h) => { listContentRef.current = h; }}
                                renderItem={({ item, index }) => {
                                    const isDragging = dragIndex === index;
                                    return (
                                        <PrefRow
                                            key={item}
                                            item={item}
                                            index={index}
                                            isDragging={isDragging}
                                            renameIndex={renameIndex}
                                            renameText={renameText}
                                            setRenameText={setRenameText}
                                            startRename={startRename}
                                            deletePrefItem={deletePrefItem}
                                            confirmRename={confirmRename}
                                            handleResponder={makeHandleResponder(item)}
                                            onRowLayout={onRowLayout}
                                            registerAnim={registerAnim}
                                        />
                                    );
                                }}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, borderTopWidth: 1, borderColor: tc.border, paddingTop: 15 }}>
                            <TextInput
                                style={[styles.input, { flex: 1, padding: 10, backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]}
                                placeholder="新增标签"
                                placeholderTextColor={tc.textSub}
                                value={newItemText}
                                onChangeText={setNewItemText}
                            />
                            <TouchableOpacity style={[styles.prefBtn, { flex: 1, backgroundColor: tc.accent }]} onPress={addPrefItem}>
                                <Text style={{ color: tc.accentText, fontWeight: '600' }}>新增</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={[styles.saveBtn, { marginTop: 15, backgroundColor: tc.accent }]} onPress={() => { endDrag(); savePrefList(); setPrefsVisible(false); }}>
                            <Text style={{ color: tc.accentText, fontWeight: '600', fontSize: 16 }}>保存设置</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 标签弹窗退出确认：仅退出 / 保存并退出 */}
            <Modal visible={prefsExitVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPrefsExitVisible(false)}>
                <View style={styles.dialogOverlay}>
                    <View style={[styles.dialogContent, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: tc.textMain, textAlign: 'center' }]}>退出标签编辑</Text>
                        <Text style={{ fontSize: 14, color: tc.textSub, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>未保存的调整会丢失，请选择退出方式</Text>
                        <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: tc.cardSubBg, marginBottom: 10 }]} onPress={() => { setPrefsExitVisible(false); setPrefsVisible(false); }}>
                            <Text style={{ color: tc.textMain, fontWeight: '600' }}>仅退出</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: tc.accent }]} onPress={() => { endDrag(); savePrefList(); setPrefsExitVisible(false); setPrefsVisible(false); }}>
                            <Text style={{ color: tc.accentText, fontWeight: '600' }}>保存并退出</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setPrefsExitVisible(false)}><Text style={{ color: tc.labelText, textAlign: 'center', marginTop: 12 }}>取消</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 删除标签确认 */}
            <Modal visible={delPrefVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDelPrefVisible(false)}>
                <View style={styles.dialogOverlay}>
                    <View style={[styles.dialogContent, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: tc.textMain, textAlign: 'center' }]}>确认删除</Text>
                        <Text style={{ fontSize: 14, color: tc.textSub, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>确定要删除“{delPrefIndex !== null ? editList[delPrefIndex] : ''}”吗？</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.dialogBtn, { flex: 1, backgroundColor: tc.cardSubBg }]} onPress={() => setDelPrefVisible(false)}>
                                <Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dialogBtn, { flex: 1, backgroundColor: COLORS.pink }]} onPress={() => { if (delPrefIndex !== null) { const newList = [...editList]; newList.splice(delPrefIndex, 1); setEditList(newList); } setDelPrefVisible(false); }}>
                                <Text style={{ color: '#fff', fontWeight: '600' }}>删除</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 导出方式选择 */}
            <Modal visible={exportChoiceVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setExportChoiceVisible(false)}>
                <View style={styles.dialogOverlay}>
                    <View style={[styles.dialogContent, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: tc.textMain, textAlign: 'center' }]}>导出数据备份</Text>
                        <Text style={{ fontSize: 14, color: tc.textSub, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>保存到手机文件夹，或通过其他应用分享</Text>
                        <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: tc.accent }]} onPress={() => { setExportChoiceVisible(false); exportData('save'); }}>
                            <Text style={{ color: tc.accentText, fontWeight: '600' }}>保存到本地</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: tc.cardSubBg, marginTop: 10 }]} onPress={() => { setExportChoiceVisible(false); exportData('share'); }}>
                            <Text style={{ color: tc.textMain, fontWeight: '600' }}>分享导出</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: tc.cardSubBg, marginTop: 10 }]} onPress={() => setExportChoiceVisible(false)}>
                            <Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 统一提示弹窗（替代 Alert） */}
            <Modal visible={tipVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTipVisible(false)}>
                <View style={styles.dialogOverlay}>
                    <View style={[styles.dialogContent, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: tc.textMain, textAlign: 'center' }]}>提示</Text>
                        <Text style={{ fontSize: 14, color: tc.textSub, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>{tipMsg}</Text>
                        <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: tc.accent }]} onPress={() => setTipVisible(false)}>
                            <Text style={{ color: tc.accentText, fontWeight: '600' }}>确定</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 清除数据二次确认 */}
            <Modal visible={clearConfirmVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setClearConfirmVisible(false)}>
                <View style={styles.dialogOverlay}>
                    <View style={[styles.dialogContent, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: tc.textMain, textAlign: 'center' }]}>确认清除</Text>
                        <Text style={{ fontSize: 14, color: tc.textSub, marginTop: 8, marginBottom: 20, textAlign: 'center' }}>将删除所有物品、记录与设置，且无法恢复。确定继续吗？</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.dialogBtn, { flex: 1, backgroundColor: tc.cardSubBg }]} onPress={() => setClearConfirmVisible(false)}>
                                <Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dialogBtn, { flex: 1, backgroundColor: COLORS.pink }]} onPress={() => { clearAllData(); setClearConfirmVisible(false); setSettingsVisible(false); }}>
                                <Text style={{ color: '#fff', fontWeight: '600' }}>确认清除</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 本地存档清理：列出检测到的文件，手动勾选后删除 */}
            <Modal visible={archiveVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setArchiveVisible(false)}>
                <View style={styles.dialogOverlay}>
                    <View style={[styles.dialogContent, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: tc.textMain, textAlign: 'center' }]}>清理本地存档</Text>
                        <Text style={{ fontSize: 13, color: tc.textSub, marginTop: 8, textAlign: 'center' }}>
                            {archiveFiles.length > 0 ? `检测到 ${archiveFiles.length} 个文件，勾选后删除` : '没有检测到存档文件'}
                        </Text>
                        {archiveFiles.length > 0 ? (
                            <ScrollView style={{ maxHeight: 250, marginTop: 10 }} showsVerticalScrollIndicator={true}>
                                {archiveFiles.map(f => {
                                    const picked = !!archivePick[f.uri];
                                    return (
                                        <TouchableOpacity
                                            key={f.uri}
                                            activeOpacity={0.8}
                                            onPress={() => toggleArchivePick(f.uri)}
                                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                                        >
                                            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: picked ? tc.accent : tc.textLight, backgroundColor: picked ? tc.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                                {picked ? <Text style={{ fontSize: 11, color: tc.accentText }}>✓</Text> : null}
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text numberOfLines={1} style={{ fontSize: 13, color: tc.textMain }}>{f.name}</Text>
                                                <Text style={{ fontSize: 11, color: tc.textLight, marginTop: 2 }}>
                                                    {[formatArchiveTime(f.mtime), f.where === 'saved' ? '本地保存目录' : '应用沙盒', f.size > 0 ? formatSize(f.size) : ''].filter(Boolean).join(' · ')}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        ) : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                            <TouchableOpacity onPress={() => {
                                if (archiveFiles.length === 0) return;
                                if (archivePickedCount === archiveFiles.length) { setArchivePick({}); return; }
                                const all = {};
                                archiveFiles.forEach(f => { all[f.uri] = true; });
                                setArchivePick(all);
                            }}>
                                <Text style={{ fontSize: 13, color: tc.accent }}>{archiveFiles.length > 0 && archivePickedCount === archiveFiles.length ? '取消全选' : '全选'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={chooseArchiveDir}>
                                <Text style={{ fontSize: 13, color: tc.textSub }}>换一个目录</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                            <TouchableOpacity style={[styles.dialogBtn, { flex: 1, marginTop: 0, backgroundColor: tc.cardSubBg }]} onPress={() => setArchiveVisible(false)}>
                                <Text style={{ color: tc.labelText, fontWeight: '600' }}>关闭</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.dialogBtn, { flex: 1, marginTop: 0, backgroundColor: archivePickedCount > 0 ? COLORS.pink : tc.cardSubBg }]}
                                onPress={async () => {
                                    if (archivePickedCount === 0) return;
                                    const uris = archiveFiles.filter(f => archivePick[f.uri]).map(f => f.uri);
                                    const n = await deleteArchiveFiles(uris);
                                    setArchivePick({});
                                    try {
                                        const r = await collectArchiveFiles();
                                        setArchiveFiles((r && r.list) || []);
                                    } catch (e) { }
                                    setTipMsg(n > 0 ? `已删除 ${n} 个文件` : '删除失败，可能缺少目录权限');
                                    setTipVisible(true);
                                }}
                            >
                                <Text style={{ color: archivePickedCount > 0 ? '#fff' : tc.labelText, fontWeight: '600' }}>删除选中{archivePickedCount > 0 ? `（${archivePickedCount}）` : ''}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// 把 GitHub Release 的 Markdown 说明转成 App 内可读的纯文本行：去掉 #、**、` 等标记，
// 记录哪些行原本是小标题，渲染时单独加粗，避免弹窗里出现一堆语法符号
const parseReleaseNotes = (raw) => {
    const lines = String(raw || '').replace(/\r/g, '').split('\n');
    const out = [];
    lines.forEach(line => {
        const heading = /^#{1,6}\s+/.test(line);
        const text = line
            .replace(/^#{1,6}\s+/, '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/^\s*[-*]\s+/, '· ')
            .replace(/^\s*>\s*/, '')
            .trim();
        if (text) out.push({ text, heading });
    });
    // 首行通常就是「小家本 vX.Y.Z 更新说明」，弹窗顶部已经写了版本号，这里跳过
    if (out.length && out[0].heading) out.shift();
    return out;
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60 },
    headerTitle: { fontSize: 24, fontWeight: '600', color: COLORS.textMain, paddingHorizontal: SIZES.padding, marginBottom: 20 },
    nickInput: { fontSize: 14, color: COLORS.textSub, padding: 0, paddingTop: 3 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, marginHorizontal: SIZES.padding, padding: 16, borderRadius: SIZES.radius, marginBottom: 16, ...SHADOWS.card },
    iconContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.lightGreen, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    cardTextContainer: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
    cardSub: { fontSize: 12, color: COLORS.textSub },
    arrow: { fontSize: 20, color: COLORS.textLight, marginLeft: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.padding, paddingTop: 46, paddingBottom: 40, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain },
    settingLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, marginTop: 15, marginBottom: 10 },
    colorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 20 },
    colorCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
    colorCircleActive: { borderColor: COLORS.primaryGreen },
    colorNameChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
    checkMark: { color: COLORS.primaryGreen, fontWeight: 'bold' },
    settingItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    settingText: { fontSize: 15, color: COLORS.textMain },
    settingValue: { fontSize: 14, color: COLORS.textSub },
    input: { backgroundColor: '#fff', borderRadius: 10, padding: 10, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },

    prefItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    prefItemText: { flex: 1, fontSize: 15, color: COLORS.textMain },
    prefEditRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', backgroundColor: 'transparent' },

    prefBtn: { padding: 8, backgroundColor: COLORS.primaryGreen, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 30 },
    prefConfirmBtn: { padding: 5, minWidth: 26, backgroundColor: COLORS.primaryGreen, borderRadius: 6, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    prefIconBtn: { padding: 4 },
    prefIconBtnText: { fontSize: 18, color: COLORS.orange, fontWeight: '600' },
    dragHandle: { padding: 6, alignItems: 'center', justifyContent: 'center' },
    dragHandleActive: { backgroundColor: COLORS.lightGreen, borderRadius: 6 },
    dragBars: { width: 14, gap: 2 },
    dragBar: { height: 2, backgroundColor: COLORS.textSub, borderRadius: 1 },
    saveBtn: { backgroundColor: COLORS.primaryGreen, padding: 16, borderRadius: 14, alignItems: 'center' },
    saveThemeBtn: { backgroundColor: COLORS.primaryGreen, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', alignSelf: 'center', width: '60%', marginBottom: 8 },
    dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    dialogContent: { width: '82%', backgroundColor: '#fff', borderRadius: 18, padding: 22 },
    dialogBtn: { padding: 12, borderRadius: 12, alignItems: 'center' },
    updateDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.pink, marginLeft: 6, marginTop: -2 },
    updateModal: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.padding, marginTop: 'auto', maxHeight: '80%' },
    updateNotes: { fontSize: 13, lineHeight: 20, marginTop: 4 },
    updateProgressOuter: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12 },
    updateProgressInner: { height: 6, borderRadius: 3, backgroundColor: COLORS.primaryGreen },
});