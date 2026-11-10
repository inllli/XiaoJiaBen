import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Image, KeyboardAvoidingView, Platform, FlatList, PanResponder, Animated, unstable_batchedUpdates } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Swipeable } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';
import AddItemModal from '../components/AddItemModal';
import { localDateStr } from '../dateUtils';

// 排序行高（首次测量前的默认值）：行高 + 8px 行间距
const ORDER_ROW_H = 62;

// 排序行：与偏好设置标签一致的拖动手柄 + 让位动画（仅可排序，无改名/删除）
const OrderRow = ({ item, isDragging, handleResponder, onRowLayout, registerAnim, tc }) => {
    const animY = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        registerAnim(item.id, animY);
        return () => registerAnim(item.id, null);
    }, [item.id, registerAnim]);
    return (
        <Animated.View
            onLayout={onRowLayout}
            style={[
                styles.orderRow,
                {
                    borderColor: isDragging ? 'transparent' : tc.border,
                    backgroundColor: isDragging ? 'rgba(142,170,139,0.22)' : tc.cardBg,
                },
                { transform: [{ translateY: animY }], zIndex: isDragging ? 10 : 1 },
            ]}
        >
            <View style={{ flex: 1, marginRight: 8, zIndex: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tc.textMain }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ fontSize: 11, color: tc.textSub }}>{item.__type === 'medicine' ? '药品' : (item.__type === 'habit' ? '习惯' : '物品')}</Text>
            </View>
            <View style={[styles.dragHandle, isDragging && styles.dragHandleActive]} {...handleResponder.panHandlers}>
                <View style={styles.dragBars}>
                    <View style={styles.dragBar} />
                    <View style={styles.dragBar} />
                    <View style={styles.dragBar} />
                </View>
            </View>
        </Animated.View>
    );
};

export default function LifeScreen() {
    const { habits, inventory, addHabitRecord, addMedicineCheckInRecord, addItemCheckInRecord, deleteRecordWithStockRestore, calendarData, themeBg, themeColors: tc, showToast, editItem: updateItem } = useContext(AppContext);

    const [tagModalVisible, setTagModalVisible] = useState(false);
    const [currentHabit, setCurrentHabit] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]);
    const [periodModalVisible, setPeriodModalVisible] = useState(false);
    const [periodFlow, setPeriodFlow] = useState('');
    const [periodColor, setPeriodColor] = useState('');
    const [periodSymptoms, setPeriodSymptoms] = useState([]);
    const [editHabitModalVisible, setEditHabitModalVisible] = useState(false);
    const [habitToEdit, setHabitToEdit] = useState(null);
    const [editMedModalVisible, setEditMedModalVisible] = useState(false);
    const [medToEdit, setMedToEdit] = useState(null);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [backfillModalVisible, setBackfillModalVisible] = useState(false);
    const [backfillTarget, setBackfillTarget] = useState(null);
    const [backfillTime, setBackfillTime] = useState(new Date());
    const [backfillNote, setBackfillNote] = useState('');
    const [backfillTags, setBackfillTags] = useState([]);
    const [backfillAssociate, setBackfillAssociate] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // 生活记录页专属排序：仅影响本页显示顺序，不写回 inventory/habits（首页顺序不受影响）
    const LIFE_ORDER_KEY = 'lifeOrder';
    const [lifeOrder, setLifeOrder] = useState([]);
    const [orderModalVisible, setOrderModalVisible] = useState(false);
    const [orderDraft, setOrderDraft] = useState([]);
    useEffect(() => {
        AsyncStorage.getItem(LIFE_ORDER_KEY).then(v => {
            if (!v) return;
            try { const arr = JSON.parse(v); if (Array.isArray(arr)) setLifeOrder(arr); } catch (e) { }
        });
    }, []);

    const checkInMedicines = useMemo(() => inventory.filter(item => item.category === '药品' && item.enableCheckIn), [inventory]);

    // 需求1：开启了打卡的“物品”也要出现在生活记录今日待打卡中（原来只筛选了药品）
    const checkInItems = useMemo(() => inventory.filter(item => item.category !== '药品' && item.enableCheckIn), [inventory]);

    // 药品 / 物品 / 习惯混排成一个列表，顺序由「排序」弹窗保存的 lifeOrder 决定；未排过的按添加时间倒序追加
    const checkInList = useMemo(() => {
        const list = [
            ...checkInMedicines.map(x => ({ ...x, __type: 'medicine' })),
            ...checkInItems.map(x => ({ ...x, __type: 'item' })),
            ...habits.map(x => ({ ...x, __type: 'habit' })),
        ];
        const idxOf = (id) => { const i = lifeOrder.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
        return list.sort((a, b) => {
            const ia = idxOf(a.id), ib = idxOf(b.id);
            if (ia !== ib) return ia - ib;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
    }, [checkInMedicines, checkInItems, habits, lifeOrder]);

    // 排序弹窗：只能拖拽调顺序（不提供改名 / 删除 / 新增），手势实现与偏好设置标签一致
    const orderDraftRef = useRef([]);
    const rowHRef = useRef(ORDER_ROW_H);
    const measuredRef = useRef(false);
    const rowAnimRefs = useRef({});
    const listRef = useRef(null);
    const listWrapRef = useRef(null);
    const listScreenRef = useRef({ y: 0, height: 0 });
    const listOffsetRef = useRef(0);
    const listContentRef = useRef(0);
    const autoScrollRef = useRef(null);
    const dragRef = useRef({ index: null, from: null, target: null, list: [], touchDy: 0, scrollAcc: 0 });
    const [dragIndex, setDragIndex] = useState(null);

    useEffect(() => { orderDraftRef.current = orderDraft; }, [orderDraft]);

    const registerAnim = (id, anim) => { if (anim) rowAnimRefs.current[id] = anim; else delete rowAnimRefs.current[id]; };
    const measureListRect = () => {
        if (listWrapRef.current && listWrapRef.current.measureInWindow) {
            listWrapRef.current.measureInWindow((x, y, w, h) => { listScreenRef.current = { y, height: h }; });
        }
    };
    const onRowLayout = (e) => {
        // 加 8px：orderRow 的 marginBottom 不计入 layout 高度，但拖动让位需要按行距计算
        if (!measuredRef.current) { measuredRef.current = true; rowHRef.current = e.nativeEvent.layout.height + 8; }
    };
    const stopAutoScroll = () => { if (autoScrollRef.current) { clearInterval(autoScrollRef.current.timer); autoScrollRef.current = null; } };
    const resetDragState = () => { dragRef.current = { index: null, from: null, target: null, list: [], touchDy: 0, scrollAcc: 0 }; setDragIndex(null); };
    const endDrag = () => { stopAutoScroll(); resetDragState(); };

    const applyDragDy = () => {
        const d = dragRef.current;
        if (d.index === null) return;
        const rh = rowHRef.current || ORDER_ROW_H;
        const totalDy = d.touchDy + d.scrollAcc;
        const selfAnim = rowAnimRefs.current[d.list[d.from]];
        if (selfAnim) selfAnim.setValue(totalDy);
        const maxTarget = d.list.length - 1;
        let target = d.from + Math.floor(totalDy / rh + 0.5);
        target = Math.max(0, Math.min(maxTarget, target));
        // 只有跨过别的行中心才让位，避免拖动中反复重排
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
                const ids = [...d.list];
                const movedId = ids.splice(d.from, 1)[0];
                ids.splice(d.target, 0, movedId);
                const byId = {};
                orderDraftRef.current.forEach(r => { byId[r.id] = r; });
                const next = ids.map(id => byId[id]).filter(Boolean);
                orderDraftRef.current = next;
                setOrderDraft(next);
            }
            stopAutoScroll();
            dragRef.current = { index: null, from: null, target: null, list: [], touchDy: 0, scrollAcc: 0 };
            setDragIndex(null);
        });
        requestAnimationFrame(() => { Object.values(rowAnimRefs.current).forEach(a => { if (a) a.setValue(0); }); });
    };

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

    const makeOrderResponder = (row) => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // capture 阶段抢响应权：列表可滚时也能按住手柄稳定拖拽
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 3 || Math.abs(g.dx) > 3,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
            const ids = orderDraftRef.current.map(r => r.id);
            const idx = ids.indexOf(row.id);
            if (idx < 0) return;
            measureListRect();
            dragRef.current = { index: idx, from: idx, target: idx, list: ids, touchDy: 0, scrollAcc: 0 };
            setDragIndex(idx);
            const selfAnim = rowAnimRefs.current[row.id];
            if (selfAnim) selfAnim.setValue(0);
        },
        onPanResponderMove: (_, g) => { dragRef.current.touchDy = g.dy; applyDragDy(); updateAutoScroll(g); },
        onPanResponderRelease: commitDrag,
        onPanResponderTerminate: commitDrag,
    });

    const openOrderModal = () => {
        endDrag();
        setOrderDraft(checkInList.map(x => ({ id: x.id, name: x.name, __type: x.__type })));
        setOrderModalVisible(true);
    };
    const saveOrder = async () => {
        endDrag();
        const ids = orderDraft.map(x => x.id);
        setLifeOrder(ids);
        try { await AsyncStorage.setItem(LIFE_ORDER_KEY, JSON.stringify(ids)); } catch (e) { }
        setOrderModalVisible(false);
        if (showToast) showToast('排序已保存');
    };

    // ★ 修正后的时间轴逻辑：仅展示近7天记录，严格按时间戳降序排序
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentLogs = useMemo(() => {
        let allLogs = [];
        Object.keys(calendarData).forEach(date => {
            calendarData[date].forEach(record => {
                if (record.category === 'habit' || record.category === 'medicine' || (record.category === 'inventory' && record.checkIn)) {
                    allLogs.push({ ...record, dateStr: date });
                }
            });
        });

        // 辅助函数：确保时间格式统一为 HH:mm:ss
        const formatTime = (t) => {
            if (!t) return '00:00:00';
            const parts = t.split(':');
            const h = parts[0] ? parts[0].padStart(2, '0') : '00';
            const m = parts[1] ? parts[1].padStart(2, '0') : '00';
            const s = parts[2] ? parts[2].padStart(2, '0') : '00';
            return `${h}:${m}:${s}`;
        };

        // 过滤近7天记录
        const now = new Date();
        const filteredLogs = allLogs.filter(log => {
            const logDate = new Date(`${log.dateStr}T${formatTime(log.time)}`);
            return logDate <= now && logDate >= sevenDaysAgo;
        });

        // 严格按时间戳从新到旧（降序）排序
        return filteredLogs.sort((a, b) => {
            const timeA = new Date(`${a.dateStr}T${formatTime(a.time)}`).getTime() || 0;
            const timeB = new Date(`${b.dateStr}T${formatTime(b.time)}`).getTime() || 0;
            return timeB - timeA;
        }).slice(0, 10);
    }, [calendarData]);

    const handleMedicineCheckIn = (med) => { addMedicineCheckInRecord(med.name, med.dose, med.unit || '粒'); };
    // 需求1：物品打卡（默认每次 1 个单位，开启关联库存时才扣减）
    const handleItemCheckIn = (item) => { addItemCheckInRecord(item.name, item.checkInAmount || 1, item.unit || '件'); };
    const handleCheckIn = (habit) => {
        if (habit.quickCheckIn || !habit.tags || habit.tags.length === 0) { addHabitRecord(habit.name); }
        else { setCurrentHabit(habit); setSelectedTags([]); setTagModalVisible(true); }
    };
    const handleTagSubmit = () => { addHabitRecord(currentHabit.name, selectedTags.join(', ')); setTagModalVisible(false); };
    const handlePeriodSubmit = () => {
        let desc = `血量: ${periodFlow || '未填'}, 颜色: ${periodColor || '未填'}`;
        if (periodSymptoms.length > 0) desc += `, 症状: ${periodSymptoms.join(',')}`;
        addHabitRecord('经期记录', desc); setPeriodModalVisible(false);
    };
    const handleDeleteLastRecord = (targetName, recordCategory = 'habit') => {
        const today = localDateStr();
        const todayRecords = calendarData[today] || [];
        // 修复：按列表展示的时间（记录产生时间 time）倒序取最近一条，而不是按入库顺序（操作时间）
        // 补打卡记录的入库时间晚但产生时间可能更早，数组头部是操作时间最新的，删它会删错记录
        const targetRecord = todayRecords
            .filter(r => r.item === targetName && r.category === recordCategory && (recordCategory !== 'inventory' || r.checkIn))
            .sort((a, b) => (b.time || '').localeCompare(a.time || ''))[0];
        const typeName = recordCategory === 'medicine' ? '药品' : (recordCategory === 'inventory' ? '物品' : '习惯');
        if (targetRecord) { setDeleteTarget({ targetName, recordId: targetRecord.id, date: today, isMedicine: recordCategory === 'medicine', typeName }); setDeleteConfirmVisible(true); }
        else { showToast('今天没有该' + typeName + '的打卡记录'); }
    };
    const confirmDelete = () => {
        if (deleteTarget) {
            // 需求14: 使用 deleteRecordWithStockRestore 恢复药品库存
            const todayRecords = calendarData[deleteTarget.date] || [];
            const targetRecord = todayRecords.find(r => r.id === deleteTarget.recordId);
            deleteRecordWithStockRestore(deleteTarget.date, deleteTarget.recordId, targetRecord);
            setDeleteConfirmVisible(false);
            setDeleteTarget(null);
        }
    };
    const handleBackfill = (item, recordCategory = 'habit') => {
        setBackfillTarget({ name: item.name, category: recordCategory, dose: item.dose || item.checkInAmount || '1', unit: item.unit || '件', tags: item.tags || [], associateInventory: item.associateInventory || false });
        setBackfillAssociate(!!item.associateInventory);
        setBackfillTime(new Date()); setBackfillNote(''); setBackfillTags([]); setBackfillModalVisible(true);
    };
    const submitBackfill = () => {
        const timeStr = `${String(backfillTime.getHours()).padStart(2, '0')}:${String(backfillTime.getMinutes()).padStart(2, '0')}:${String(backfillTime.getSeconds()).padStart(2, '0')}`;
        const dateStr = localDateStr(backfillTime);
        if (backfillTarget.category === 'medicine') { addMedicineCheckInRecord(backfillTarget.name, backfillTarget.dose, backfillTarget.unit, timeStr, backfillNote, dateStr, backfillAssociate); }
        else if (backfillTarget.category === 'inventory') { addItemCheckInRecord(backfillTarget.name, backfillTarget.dose, backfillTarget.unit, timeStr, backfillNote, dateStr, backfillAssociate); }
        else { addHabitRecord(backfillTarget.name, backfillTags.join(', ') || backfillNote || '补打卡', timeStr, dateStr); }
        setBackfillModalVisible(false);
    };
    const togglePeriodSymptom = (sym) => { setPeriodSymptoms(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]); };
    const toggleBackfillTag = (tag) => { setBackfillTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]); };
    const handleDisableCheckIn = (item) => {
        updateItem(item.id, { ...item, enableCheckIn: false });
        showToast(`已关闭「${item.name}」的打卡项`);
    };

    const renderRightActions = (item, recordCategory = 'habit') => (
        <View style={styles.swipeActions}>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: COLORS.orange }]} onPress={() => handleBackfill(item, recordCategory)}><Text style={styles.swipeBtnText}>补打卡</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: COLORS.pink }]} onPress={() => handleDeleteLastRecord(item.name, recordCategory)}><Text style={styles.swipeBtnText}>删除</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: '#888' }]} onPress={() => handleDisableCheckIn(item)}><Text style={styles.swipeBtnText}>关闭打卡项</Text></TouchableOpacity>
        </View>
    );

    // 弹窗内的标签块与主按钮统一跟随主题：未选中用 chipBg + 主文字色，选中用 accent
    const tagBase = { backgroundColor: tc.chipBg, borderColor: tc.border };
    const tagBaseText = { color: tc.textMain };
    const tagSel = { backgroundColor: tc.accent, borderColor: tc.accent };
    const tagSelText = { color: tc.accentText, fontWeight: '600' };
    const primaryBtn = { backgroundColor: tc.accent };
    const primaryBtnText = { color: tc.accentText, fontWeight: '600' };

    return (
        <View style={[styles.container, { backgroundColor: tc.bg }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                <View style={styles.headerRow}>
                    <Text style={[styles.headerTitle, { color: tc.textMain }]}>生活记录</Text>
                    <TouchableOpacity style={[styles.orderEntry, { backgroundColor: tc.cardBg, borderColor: tc.border }]} onPress={openOrderModal}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: tc.labelText }}>排序</Text>
                    </TouchableOpacity>
                </View>
                <Text style={[styles.sectionTitle, { color: tc.textMain }]}>今日待打卡</Text>

                <View style={[styles.card, { backgroundColor: tc.cardBg }]}>
                    <View style={styles.cardInfo}><View style={[styles.iconBg, { backgroundColor: COLORS.lightPink }]}><Text style={{ fontSize: 20 }}>🩸</Text></View><View><Text style={[styles.cardTitle, { color: tc.textMain }]}>经期记录</Text><Text style={[styles.cardSub, { color: tc.textSub }]}>血量、颜色、症状</Text></View></View>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: tc.accent }]} onPress={() => { setPeriodFlow(''); setPeriodColor(''); setPeriodSymptoms([]); setPeriodModalVisible(true); }}><Text style={[styles.btnText, { color: tc.accentText }]}>记一下</Text></TouchableOpacity>
                </View>

                {checkInList.map(row => {
                    const today = localDateStr();
                    const isMed = row.__type === 'medicine';
                    const isHabit = row.__type === 'habit';
                    const isItem = row.__type === 'item';
                    const cat = isMed ? 'medicine' : (isHabit ? 'habit' : 'inventory');
                    const count = (calendarData[today] || []).filter(r => r.item === row.name && r.category === cat && (!isItem || r.checkIn)).length;
                    const iconBgColor = isMed ? COLORS.lightOrange : (isHabit ? COLORS.lightBlue : COLORS.lightPurple);
                    const openCard = isHabit
                        ? () => { setHabitToEdit(row); setEditHabitModalVisible(true); }
                        : (isMed ? () => { setMedToEdit(row); setEditMedModalVisible(true); } : undefined);
                    const onCheckIn = isHabit ? () => handleCheckIn(row) : (isMed ? () => handleMedicineCheckIn(row) : () => handleItemCheckIn(row));
                    return (
                        <Swipeable key={row.id} renderRightActions={() => renderRightActions(row, cat)}>
                            <View style={[styles.card, { backgroundColor: tc.cardBg }]}>
                                <TouchableOpacity style={styles.cardInfo} onPress={openCard}>
                                    <View style={[styles.iconBg, { backgroundColor: iconBgColor }]}>
                                        {isHabit
                                            ? <Text style={{ fontSize: 20 }}>{row.icon || '⭐'}</Text>
                                            : (row.covers?.[0]?.startsWith('file')
                                                ? <Image source={{ uri: row.covers[0] }} style={{ width: 40, height: 40, borderRadius: 20 }} resizeMode="cover" />
                                                : <Text style={{ fontSize: 20 }}>{row.covers?.[0] || (isMed ? '💊' : '📦')}</Text>)}
                                    </View>
                                    <View style={{ flex: 1, marginRight: 8 }}><Text style={[styles.cardTitle, { color: tc.textMain }]} numberOfLines={1}>{row.name} {count > 0 ? <Text style={{ fontSize: 12, color: COLORS.primaryGreen }}>({count}次)</Text> : null}</Text><Text style={[styles.cardSub, { color: tc.textSub }]} numberOfLines={1}>
                                        {isMed && <>剂量: {row.dose}{row.unit} · <Text style={{ color: row.stock <= 0 ? '#e74c3c' : tc.textSub, fontWeight: row.stock <= 0 ? '700' : '400' }}>库存: {row.stock}</Text></>}
                                        {isItem && <><Text style={{ color: row.stock <= 0 ? '#e74c3c' : tc.textSub, fontWeight: row.stock <= 0 ? '700' : '400' }}>库存: {row.stock}{row.unit || '件'}</Text>{row.purpose ? ' · ' + row.purpose : ''}</>}
                                        {isHabit && <>{row.frequency || '未设置频次'} {row.tags?.length > 0 ? ` · ${row.tags.join('/')}` : ''}</>}
                                    </Text></View>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: tc.accent }]} onPress={onCheckIn}><Text style={[styles.btnText, { color: tc.accentText }]}>打卡</Text></TouchableOpacity>
                            </View>
                        </Swipeable>
                    );
                })}

                {habits.length === 0 && checkInMedicines.length === 0 && checkInItems.length === 0 && <View style={styles.emptyView}><Text style={[styles.emptyText, { color: tc.textSub }]}>暂无打卡项，点击底部 + 配置习惯、药品，或给物品开启打卡</Text></View>}

                <Text style={[styles.sectionTitle, { color: tc.textMain, marginTop: 20 }]}>近期操作记录</Text>
                <View style={[styles.timelineBox, { backgroundColor: tc.cardBg }]}>
                    {recentLogs.length === 0 ? <Text style={[styles.emptyText, { color: tc.textSub }]}>暂无记录</Text> : recentLogs.map((log, idx) => (
                        <View key={idx} style={styles.timelineItem}>
                            <View style={[styles.timelineDot, { backgroundColor: log.category === 'medicine' ? COLORS.dotMed : (log.category === 'inventory' ? COLORS.dotInv : COLORS.dotHab) }]} />
                            <View style={[styles.timelineContent, { backgroundColor: 'transparent' }]}>
                                <Text style={[styles.timelineTime, { color: tc.textSub }]}>{log.dateStr} {log.time}</Text>
                                <Text style={[styles.timelineText, { color: tc.textMain }]}>{log.text}</Text>
                                {(() => {
                                    // 仅当记录产生时是关联库存的打卡，才展示剂量/用量消耗信息（旧记录无标记则回退当前配置）
                                    if ((log.category === 'medicine' || log.category === 'inventory') && log.item) {
                                        const targetItem = log.category === 'inventory' ? inventory.find(i => i.name === log.item && i.category !== '药品') : inventory.find(i => i.name === log.item && i.category === '药品');
                                        const associated = log.isAssociatedAtCheckIn !== undefined ? log.isAssociatedAtCheckIn : (targetItem ? targetItem.associateInventory : false);
                                        if (!associated) {
                                            return null;
                                        }
                                    }
                                    return log.sub ? <Text style={[styles.timelineSub, { color: tc.textSub }]}>{log.sub}</Text> : null;
                                })()}
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* 生活记录排序：只能调顺序，不提供改名 / 删除 / 新增 */}
            <Modal visible={orderModalVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { endDrag(); setOrderModalVisible(false); }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.orderModalContent, { backgroundColor: tc.modalBg }]}>
                        <View style={styles.orderHeader}>
                            <Text style={[styles.orderTitle, { color: tc.textMain }]}>打卡排序</Text>
                            <TouchableOpacity onPress={() => { endDrag(); setOrderModalVisible(false); }}><Text style={{ fontSize: 22, color: tc.textSub }}>✕</Text></TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 12, color: tc.textSub, marginBottom: 10 }}>按住右侧手柄上下拖动即可调序，只影响生活记录页显示，不影响首页。</Text>
                        <View style={{ maxHeight: SIZES.screenHeight * 0.5 }} ref={listWrapRef} onLayout={measureListRect}>
                            <FlatList
                                ref={listRef}
                                data={orderDraft}
                                keyExtractor={(item) => item.id}
                                style={{ maxHeight: SIZES.screenHeight * 0.5 }}
                                scrollEnabled={dragIndex === null}
                                removeClippedSubviews={false}
                                contentContainerStyle={{ paddingBottom: 10 }}
                                scrollEventThrottle={16}
                                onScroll={e => { listOffsetRef.current = e.nativeEvent.contentOffset.y; }}
                                onContentSizeChange={(w, h) => { listContentRef.current = h; }}
                                renderItem={({ item, index }) => (
                                    <OrderRow
                                        item={item}
                                        isDragging={dragIndex === index}
                                        handleResponder={makeOrderResponder(item)}
                                        onRowLayout={onRowLayout}
                                        registerAnim={registerAnim}
                                        tc={tc}
                                    />
                                )}
                                ListEmptyComponent={<Text style={[styles.emptyText, { color: tc.textSub, marginTop: 20 }]}>暂无打卡项</Text>}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => { endDrag(); setOrderModalVisible(false); }}><Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.saveBtn, primaryBtn]} onPress={saveOrder}><Text style={primaryBtnText}>保存排序</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={tagModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTagModalVisible(false)}>
                <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: tc.modalBg }]}>
                    <Text style={[styles.modalTitle, { color: tc.textMain }]}>选择 {currentHabit?.name} 标签</Text>
                    <View style={styles.tagGroup}>{currentHabit?.tags.map(tag => (<TouchableOpacity key={tag} style={[styles.tag, tagBase, selectedTags.includes(tag) && tagSel]} onPress={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}><Text style={[styles.tagText, tagBaseText, selectedTags.includes(tag) && tagSelText]}>{tag}</Text></TouchableOpacity>))}</View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}><TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setTagModalVisible(false)}><Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.saveBtn, primaryBtn]} onPress={handleTagSubmit}><Text style={primaryBtnText}>确定</Text></TouchableOpacity></View>
                </View></View>
            </Modal>

            <Modal visible={periodModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPeriodModalVisible(false)}>
                <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: tc.modalBg }]}>
                    <Text style={[styles.modalTitle, { color: tc.textMain }]}>经期记录</Text>
                    <Text style={[styles.label, { color: tc.textMain }]}>血量</Text><View style={styles.tagGroup}>{['少', '中', '多'].map(f => <TouchableOpacity key={f} style={[styles.tag, tagBase, periodFlow === f && tagSel]} onPress={() => setPeriodFlow(f)}><Text style={[styles.tagText, tagBaseText, periodFlow === f && tagSelText]}>{f}</Text></TouchableOpacity>)}</View>
                    <Text style={[styles.label, { color: tc.textMain }]}>颜色</Text><View style={styles.tagGroup}>{['鲜红', '暗红', '褐色'].map(c => <TouchableOpacity key={c} style={[styles.tag, tagBase, periodColor === c && tagSel]} onPress={() => setPeriodColor(c)}><Text style={[styles.tagText, tagBaseText, periodColor === c && tagSelText]}>{c}</Text></TouchableOpacity>)}</View>
                    <Text style={[styles.label, { color: tc.textMain }]}>伴随症状</Text><View style={styles.tagGroup}>{['痛经', '腰酸', '情绪低落', '无'].map(s => <TouchableOpacity key={s} style={[styles.tag, tagBase, periodSymptoms.includes(s) && tagSel]} onPress={() => togglePeriodSymptom(s)}><Text style={[styles.tagText, tagBaseText, periodSymptoms.includes(s) && tagSelText]}>{s}</Text></TouchableOpacity>)}</View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}><TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setPeriodModalVisible(false)}><Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.saveBtn, primaryBtn]} onPress={handlePeriodSubmit}><Text style={primaryBtnText}>保存</Text></TouchableOpacity></View>
                </View></View>
            </Modal>

            <Modal visible={deleteConfirmVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDeleteConfirmVisible(false)}>
                <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: tc.modalBg }]}>
                    <Text style={[styles.modalTitle, { color: tc.textMain }]}>删除记录</Text>
                    <Text style={{ fontSize: 14, color: tc.textSub, marginBottom: 20, textAlign: 'center' }}>确定要删除最近一条【{deleteTarget?.targetName}】{deleteTarget?.typeName || '习惯'}打卡记录吗？{deleteTarget?.isMedicine ? '\n删除后库存将自动恢复。' : ''}</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}><TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setDeleteConfirmVisible(false)}><Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.pink }]} onPress={confirmDelete}><Text style={{ color: '#fff', fontWeight: '600' }}>删除</Text></TouchableOpacity></View>
                </View></View>
            </Modal>

            <Modal visible={backfillModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setBackfillModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: tc.textMain }]}>补打卡 - {backfillTarget?.name}</Text>
                        <Text style={[styles.label, { color: tc.textMain }]}>打卡日期</Text>
                        <TouchableOpacity style={[styles.timeBtn, { backgroundColor: tc.inputBg }]} onPress={() => setShowDatePicker(true)}><Text style={styles.timeText}>{backfillTime.toLocaleDateString('zh-CN')}</Text></TouchableOpacity>
                        {showDatePicker && <DateTimePicker value={backfillTime} mode="date" display="spinner" themeVariant="light" onChange={(event, selectedDate) => { setShowDatePicker(false); if (selectedDate) setBackfillTime(selectedDate); }} />}
                        <Text style={[styles.label, { color: tc.textMain }]}>打卡时间</Text>
                        <TouchableOpacity style={[styles.timeBtn, { backgroundColor: tc.inputBg }]} onPress={() => setShowTimePicker(true)}><Text style={styles.timeText}>{String(backfillTime.getHours()).padStart(2, '0')}:{String(backfillTime.getMinutes()).padStart(2, '0')}</Text></TouchableOpacity>
                        {showTimePicker && <DateTimePicker value={backfillTime} mode="time" is24Hour={true} display="spinner" themeVariant="light" onChange={(event, selectedDate) => { setShowTimePicker(false); if (selectedDate) setBackfillTime(selectedDate); }} />}
                        {(backfillTarget?.category === 'medicine' || backfillTarget?.category === 'inventory') && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: tc.textMain }}>关联库存（打卡扣库存/删记录还原）</Text>
                                <TouchableOpacity style={[styles.tag, { paddingVertical: 1 }, tagBase, backfillAssociate && tagSel]} onPress={() => setBackfillAssociate(!backfillAssociate)}><Text style={[styles.tagText, { fontSize: 14 }, tagBaseText, backfillAssociate && tagSelText]}>{backfillAssociate ? '已关联' : '未关联'}</Text></TouchableOpacity>
                            </View>
                        )}
                        {backfillTarget?.category === 'medicine' ? (
                            <><Text style={[styles.label, { color: tc.textMain }]}>备注</Text><TextInput placeholderTextColor={tc.textSub} style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} value={backfillNote} onChangeText={setBackfillNote} placeholder="例如：补录、饭后服用" /><Text style={[styles.subText, { color: COLORS.orange, fontWeight: '600' }]}>确认后将自动扣减库存：{backfillTarget.dose}{backfillTarget.unit}</Text></>
                        ) : (
                            <>{backfillTarget?.tags && backfillTarget.tags.length > 0 && (<><Text style={[styles.label, { color: tc.textMain }]}>选择标签（可选）</Text><View style={styles.tagGroup}>{backfillTarget.tags.map(tag => (<TouchableOpacity key={tag} style={[styles.tag, tagBase, backfillTags.includes(tag) && tagSel]} onPress={() => toggleBackfillTag(tag)}><Text style={[styles.tagText, tagBaseText, backfillTags.includes(tag) && tagSelText]}>{tag}</Text></TouchableOpacity>))}</View></>)}<Text style={[styles.label, { color: tc.textMain }]}>备注</Text><TextInput placeholderTextColor={tc.textSub} style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} value={backfillNote} onChangeText={setBackfillNote} placeholder="例如：补录、忘记打卡" /></>
                        )}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}><TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setBackfillModalVisible(false)}><Text style={{ color: tc.textMain, fontSize: 15, fontWeight: '600', color: tc.labelText }}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.saveBtn, primaryBtn]} onPress={submitBackfill}><Text style={[primaryBtnText, { fontSize: 15 }]}>确定</Text></TouchableOpacity></View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <AddItemModal visible={editHabitModalVisible} onClose={() => setEditHabitModalVisible(false)} editHabit={habitToEdit} />
            <AddItemModal visible={editMedModalVisible} onClose={() => setEditMedModalVisible(false)} editItem={medToEdit} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60 },
    headerTitle: { fontSize: 24, fontWeight: '600', color: COLORS.textMain },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SIZES.padding, marginBottom: 15 },
    orderEntry: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
    orderModalContent: { borderRadius: 20, padding: 20, width: '90%' },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    orderTitle: { fontSize: 18, fontWeight: '600' },
    orderRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 8 },
    dragHandle: { padding: 6, alignItems: 'center', justifyContent: 'center' },
    dragHandleActive: { backgroundColor: COLORS.lightGreen, borderRadius: 6 },
    dragBars: { width: 14, gap: 2 },
    dragBar: { height: 2, backgroundColor: COLORS.textSub, borderRadius: 1 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textMain, paddingHorizontal: SIZES.padding, marginBottom: 12 },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.cardBg, marginHorizontal: SIZES.padding, padding: 16, borderRadius: SIZES.radius, marginBottom: 12, ...SHADOWS.card },
    cardInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
    cardSub: { fontSize: 12, color: COLORS.textSub },
    btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    emptyView: { justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    emptyText: { color: COLORS.textSub, fontSize: 14, textAlign: 'center' },
    swipeActions: { flexDirection: 'row', alignItems: 'center', marginRight: SIZES.padding, marginBottom: 12, zIndex: 10 },
    swipeBtn: { width: 70, height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginLeft: 4 },
    swipeBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    timelineBox: { backgroundColor: '#fff', marginHorizontal: SIZES.padding, borderRadius: SIZES.radius, padding: 16, ...SHADOWS.card },
    timelineItem: { flexDirection: 'row', marginBottom: 12 },
    timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 10 },
    timelineContent: { flex: 1 },
    timelineTime: { fontSize: 11, color: COLORS.textSub, marginBottom: 2 },
    timelineText: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
    timelineSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%' },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain, marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, marginTop: 15, marginBottom: 8 },
    input: { backgroundColor: '#f0f0f0', borderRadius: 10, padding: 12, fontSize: 15 },
    subText: { fontSize: 12, color: COLORS.textSub, marginTop: 10, textAlign: 'center' },
    timeBtn: { backgroundColor: '#f0f0f0', borderRadius: 10, padding: 15, alignItems: 'center', marginBottom: 5 },
    timeText: { fontSize: 18, fontWeight: '600', color: COLORS.primaryGreen },
    tagGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tag: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'transparent', borderRadius: 20 },
    tagActive: { backgroundColor: COLORS.lightGreen, borderWidth: 1, borderColor: COLORS.primaryGreen },
    tagText: { fontSize: 14, color: COLORS.textSub },
    tagTextActive: { color: COLORS.primaryGreen, fontWeight: '600' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.primaryGreen, alignItems: 'center' },
});