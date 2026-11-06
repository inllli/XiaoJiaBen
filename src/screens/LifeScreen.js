import React, { useContext, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';
import AddItemModal from '../components/AddItemModal';

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

    const checkInMedicines = useMemo(() => inventory.filter(item => item.category === '药品' && item.enableCheckIn), [inventory]);

    // 需求1：开启了打卡的“物品”也要出现在生活记录今日待打卡中（原来只筛选了药品）
    const checkInItems = useMemo(() => inventory.filter(item => item.category !== '药品' && item.enableCheckIn), [inventory]);

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
        const today = new Date().toISOString().split('T')[0];
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
        const dateStr = backfillTime.toISOString().split('T')[0];
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

    return (
        <View style={[styles.container, { backgroundColor: tc.bg }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
                <Text style={[styles.headerTitle, { color: tc.textMain }]}>生活记录</Text>
                <Text style={[styles.sectionTitle, { color: tc.textMain }]}>今日待打卡</Text>

                <View style={[styles.card, { backgroundColor: tc.cardBg }]}>
                    <View style={styles.cardInfo}><View style={[styles.iconBg, { backgroundColor: COLORS.lightPink }]}><Text style={{ fontSize: 20 }}>🩸</Text></View><View><Text style={[styles.cardTitle, { color: tc.textMain }]}>经期记录</Text><Text style={[styles.cardSub, { color: tc.textSub }]}>血量、颜色、症状</Text></View></View>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.orange }]} onPress={() => { setPeriodFlow(''); setPeriodColor(''); setPeriodSymptoms([]); setPeriodModalVisible(true); }}><Text style={styles.btnText}>记一下</Text></TouchableOpacity>
                </View>

                {checkInMedicines.map(med => {
                    const today = new Date().toISOString().split('T')[0];
                    const count = (calendarData[today] || []).filter(r => r.item === med.name && r.category === 'medicine').length;
                    return (
                        <Swipeable key={med.id} renderRightActions={() => renderRightActions(med, 'medicine')}>
                            <View style={[styles.card, { backgroundColor: tc.cardBg }]}>
                                <TouchableOpacity style={styles.cardInfo} onPress={() => { setMedToEdit(med); setEditMedModalVisible(true); }}>
                                    <View style={[styles.iconBg, { backgroundColor: COLORS.lightOrange }]}>{med.covers?.[0]?.startsWith('file') ? <Image source={{ uri: med.covers[0] }} style={{ width: 40, height: 40, borderRadius: 20 }} resizeMode="cover" /> : <Text style={{ fontSize: 20 }}>{med.covers?.[0] || '💊'}</Text>}</View>
                                    <View><Text style={[styles.cardTitle, { color: tc.textMain }]}>{med.name} {count > 0 ? <Text style={{ fontSize: 12, color: COLORS.primaryGreen }}>({count}次)</Text> : null}</Text><Text style={[styles.cardSub, { color: tc.textSub }]}>剂量: {med.dose}{med.unit} · <Text style={{ color: med.stock <= 0 ? '#e74c3c' : tc.textSub, fontWeight: med.stock <= 0 ? '700' : '400' }}>库存: {med.stock}</Text></Text></View>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primaryGreen }]} onPress={() => handleMedicineCheckIn(med)}><Text style={styles.btnText}>打卡</Text></TouchableOpacity>
                            </View>
                        </Swipeable>
                    );
                })}

                {checkInItems.map(item => {
                    const today = new Date().toISOString().split('T')[0];
                    const count = (calendarData[today] || []).filter(r => r.item === item.name && r.category === 'inventory' && r.checkIn).length;
                    return (
                        <Swipeable key={item.id} renderRightActions={() => renderRightActions(item, 'inventory')}>
                            <View style={[styles.card, { backgroundColor: tc.cardBg }]}>
                                <TouchableOpacity style={styles.cardInfo}>
                                    <View style={[styles.iconBg, { backgroundColor: COLORS.lightPurple }]}>{item.covers?.[0]?.startsWith('file') ? <Image source={{ uri: item.covers[0] }} style={{ width: 40, height: 40, borderRadius: 20 }} resizeMode="cover" /> : <Text style={{ fontSize: 20 }}>{item.covers?.[0] || '📦'}</Text>}</View>
                                    <View><Text style={[styles.cardTitle, { color: tc.textMain }]}>{item.name} {count > 0 ? <Text style={{ fontSize: 12, color: COLORS.primaryGreen }}>({count}次)</Text> : null}</Text><Text style={[styles.cardSub, { color: tc.textSub }]}><Text style={{ color: item.stock <= 0 ? '#e74c3c' : tc.textSub, fontWeight: item.stock <= 0 ? '700' : '400' }}>库存: {item.stock}{item.unit || '件'}</Text>{item.purpose ? ' · ' + item.purpose : ''}</Text></View>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primaryGreen }]} onPress={() => handleItemCheckIn(item)}><Text style={styles.btnText}>打卡</Text></TouchableOpacity>
                            </View>
                        </Swipeable>
                    );
                })}

                {habits.map(habit => {
                    const today = new Date().toISOString().split('T')[0];
                    const count = (calendarData[today] || []).filter(r => r.item === habit.name && r.category === 'habit').length;
                    return (
                        <Swipeable key={habit.id} renderRightActions={() => renderRightActions(habit, 'habit')}>
                            <View style={[styles.card, { backgroundColor: tc.cardBg }]}>
                                <TouchableOpacity style={styles.cardInfo} onPress={() => { setHabitToEdit(habit); setEditHabitModalVisible(true); }}>
                                    <View style={[styles.iconBg, { backgroundColor: COLORS.lightBlue }]}><Text style={{ fontSize: 20 }}>{habit.icon || '⭐'}</Text></View>
                                    <View><Text style={[styles.cardTitle, { color: tc.textMain }]}>{habit.name} {count > 0 ? <Text style={{ fontSize: 12, color: COLORS.primaryGreen }}>({count}次)</Text> : null}</Text><Text style={[styles.cardSub, { color: tc.textSub }]}>{habit.frequency || '未设置频次'} {habit.tags?.length > 0 ? ` · ${habit.tags.join('/')}` : ''}</Text></View>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primaryGreen }]} onPress={() => handleCheckIn(habit)}><Text style={styles.btnText}>打卡</Text></TouchableOpacity>
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

            <Modal visible={tagModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTagModalVisible(false)}>
                <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: tc.modalBg }]}>
                    <Text style={[styles.modalTitle, { color: tc.textMain }]}>选择 {currentHabit?.name} 标签</Text>
                    <View style={styles.tagGroup}>{currentHabit?.tags.map(tag => (<TouchableOpacity key={tag} style={[styles.tag, selectedTags.includes(tag) && styles.tagActive]} onPress={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}><Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextActive]}>{tag}</Text></TouchableOpacity>))}</View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}><TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setTagModalVisible(false)}><Text style={{ color: tc.textSub, fontWeight: '600' }}>取消</Text></TouchableOpacity><TouchableOpacity style={styles.saveBtn} onPress={handleTagSubmit}><Text style={{ color: '#fff', fontWeight: '600' }}>确定</Text></TouchableOpacity></View>
                </View></View>
            </Modal>

            <Modal visible={periodModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPeriodModalVisible(false)}>
                <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: tc.modalBg }]}>
                    <Text style={[styles.modalTitle, { color: tc.textMain }]}>经期记录</Text>
                    <Text style={[styles.label, { color: tc.textMain }]}>血量</Text><View style={styles.tagGroup}>{['少', '中', '多'].map(f => <TouchableOpacity key={f} style={[styles.tag, periodFlow === f && styles.tagActive]} onPress={() => setPeriodFlow(f)}><Text style={[styles.tagText, periodFlow === f && styles.tagTextActive]}>{f}</Text></TouchableOpacity>)}</View>
                    <Text style={[styles.label, { color: tc.textMain }]}>颜色</Text><View style={styles.tagGroup}>{['鲜红', '暗红', '褐色'].map(c => <TouchableOpacity key={c} style={[styles.tag, periodColor === c && styles.tagActive]} onPress={() => setPeriodColor(c)}><Text style={[styles.tagText, periodColor === c && styles.tagTextActive]}>{c}</Text></TouchableOpacity>)}</View>
                    <Text style={[styles.label, { color: tc.textMain }]}>伴随症状</Text><View style={styles.tagGroup}>{['痛经', '腰酸', '情绪低落', '无'].map(s => <TouchableOpacity key={s} style={[styles.tag, periodSymptoms.includes(s) && styles.tagActive]} onPress={() => togglePeriodSymptom(s)}><Text style={[styles.tagText, periodSymptoms.includes(s) && styles.tagTextActive]}>{s}</Text></TouchableOpacity>)}</View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}><TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setPeriodModalVisible(false)}><Text style={{ color: tc.textSub, fontWeight: '600' }}>取消</Text></TouchableOpacity><TouchableOpacity style={styles.saveBtn} onPress={handlePeriodSubmit}><Text style={{ color: '#fff', fontWeight: '600' }}>保存</Text></TouchableOpacity></View>
                </View></View>
            </Modal>

            <Modal visible={deleteConfirmVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDeleteConfirmVisible(false)}>
                <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: tc.modalBg }]}>
                    <Text style={[styles.modalTitle, { color: tc.textMain }]}>删除记录</Text>
                    <Text style={{ fontSize: 14, color: tc.textSub, marginBottom: 20, textAlign: 'center' }}>确定要删除最近一条【{deleteTarget?.targetName}】{deleteTarget?.typeName || '习惯'}打卡记录吗？{deleteTarget?.isMedicine ? '\n删除后库存将自动恢复。' : ''}</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}><TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setDeleteConfirmVisible(false)}><Text style={{ color: tc.textSub, fontWeight: '600' }}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.pink }]} onPress={confirmDelete}><Text style={{ color: '#fff', fontWeight: '600' }}>删除</Text></TouchableOpacity></View>
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
                                <TouchableOpacity style={[styles.tag, { paddingVertical: 1 }, backfillAssociate && styles.tagActive]} onPress={() => setBackfillAssociate(!backfillAssociate)}><Text style={[styles.tagText, { fontSize: 14 }, backfillAssociate && styles.tagTextActive]}>{backfillAssociate ? '已关联' : '未关联'}</Text></TouchableOpacity>
                            </View>
                        )}
                        {backfillTarget?.category === 'medicine' ? (
                            <><Text style={[styles.label, { color: tc.textMain }]}>备注</Text><TextInput placeholderTextColor={tc.textSub} style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} value={backfillNote} onChangeText={setBackfillNote} placeholder="例如：补录、饭后服用" /><Text style={[styles.subText, { color: COLORS.orange, fontWeight: '600' }]}>确认后将自动扣减库存：{backfillTarget.dose}{backfillTarget.unit}</Text></>
                        ) : (
                            <>{backfillTarget?.tags && backfillTarget.tags.length > 0 && (<><Text style={[styles.label, { color: tc.textMain }]}>选择标签（可选）</Text><View style={styles.tagGroup}>{backfillTarget.tags.map(tag => (<TouchableOpacity key={tag} style={[styles.tag, backfillTags.includes(tag) && styles.tagActive]} onPress={() => toggleBackfillTag(tag)}><Text style={[styles.tagText, backfillTags.includes(tag) && styles.tagTextActive]}>{tag}</Text></TouchableOpacity>))}</View></>)}<Text style={[styles.label, { color: tc.textMain }]}>备注</Text><TextInput placeholderTextColor={tc.textSub} style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} value={backfillNote} onChangeText={setBackfillNote} placeholder="例如：补录、忘记打卡" /></>
                        )}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}><TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setBackfillModalVisible(false)}><Text style={{ color: tc.textSub, fontSize: 15, fontWeight: '600' }}>取消</Text></TouchableOpacity><TouchableOpacity style={styles.saveBtn} onPress={submitBackfill}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>确定</Text></TouchableOpacity></View>
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
    headerTitle: { fontSize: 24, fontWeight: '600', color: COLORS.textMain, paddingHorizontal: SIZES.padding, marginBottom: 15 },
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