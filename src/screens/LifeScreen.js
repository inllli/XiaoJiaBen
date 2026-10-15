import React, { useContext, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';
import AddItemModal from '../components/AddItemModal';

export default function LifeScreen() {
    const { habits, inventory, addHabitRecord, addMedicineCheckInRecord, removeLog, calendarData } = useContext(AppContext);

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

    // 补打卡弹窗状态
    const [backfillModalVisible, setBackfillModalVisible] = useState(false);
    const [backfillTarget, setBackfillTarget] = useState(null); // { name, category, dose, unit }
    const [backfillTime, setBackfillTime] = useState(new Date());
    const [backfillNote, setBackfillNote] = useState('');
    const [backfillTags, setBackfillTags] = useState([]);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const checkInMedicines = useMemo(() => {
        return inventory.filter(item => item.category === '药品' && item.enableCheckIn);
    }, [inventory]);

    const handleMedicineCheckIn = (med) => {
        addMedicineCheckInRecord(med.name, med.dose, med.unit || '粒');
    };

    const handleCheckIn = (habit) => {
        if (habit.quickCheckIn || !habit.tags || habit.tags.length === 0) {
            addHabitRecord(habit.name);
        } else {
            setCurrentHabit(habit);
            setSelectedTags([]);
            setTagModalVisible(true);
        }
    };

    const handleTagSubmit = () => {
        addHabitRecord(currentHabit.name, selectedTags.join(', '));
        setTagModalVisible(false);
    };

    const handlePeriodSubmit = () => {
        let desc = `血量: ${periodFlow || '未填'}, 颜色: ${periodColor || '未填'}`;
        if (periodSymptoms.length > 0) desc += `, 症状: ${periodSymptoms.join(',')}`;
        addHabitRecord('经期记录', desc);
        setPeriodModalVisible(false);
    };

    const handleDeleteLastRecord = (targetName, isMedicine = false) => {
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = calendarData[today] || [];
        const category = isMedicine ? 'medicine' : 'habit';
        const targetRecord = todayRecords.find(r => r.item === targetName && r.category === category);

        if (targetRecord) {
            setDeleteTarget({ targetName, recordId: targetRecord.id, date: today, isMedicine });
            setDeleteConfirmVisible(true);
        } else {
            alert(`今天没有该${isMedicine ? '药品' : '习惯'}的打卡记录`);
        }
    };

    const confirmDelete = () => {
        if (deleteTarget) {
            removeLog(deleteTarget.date, deleteTarget.recordId);
            setDeleteConfirmVisible(false);
            setDeleteTarget(null);
        }
    };

    // 触发补打卡弹窗
    const handleBackfill = (item, isMedicine = false) => {
        setBackfillTarget({
            name: item.name,
            category: isMedicine ? 'medicine' : 'habit',
            dose: item.dose || '1',
            unit: item.unit || '粒',
            tags: item.tags || []
        });
        setBackfillTime(new Date());
        setBackfillNote('');
        setBackfillTags([]);
        setBackfillModalVisible(true);
    };

    // 提交补打卡
    const submitBackfill = () => {
        const timeStr = `${String(backfillTime.getHours()).padStart(2, '0')}:${String(backfillTime.getMinutes()).padStart(2, '0')}:${String(backfillTime.getSeconds()).padStart(2, '0')}`;

        if (backfillTarget.category === 'medicine') {
            addMedicineCheckInRecord(backfillTarget.name, backfillTarget.dose, backfillTarget.unit, timeStr, backfillNote);
        } else {
            const finalTags = backfillTags.join(', ');
            addHabitRecord(backfillTarget.name, finalTags || backfillNote || '补打卡', timeStr);
        }
        setBackfillModalVisible(false);
    };

    const openEditHabit = (habit) => {
        setHabitToEdit(habit);
        setEditHabitModalVisible(true);
    };

    const openEditMedicine = (med) => {
        setMedToEdit(med);
        setEditMedModalVisible(true);
    };

    const togglePeriodSymptom = (sym) => {
        setPeriodSymptoms(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]);
    };

    const toggleBackfillTag = (tag) => {
        setBackfillTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const renderRightActions = (item, isMedicine = false) => (
        <View style={styles.swipeActions}>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: COLORS.orange }]} onPress={() => handleBackfill(item, isMedicine)}>
                <Text style={styles.swipeBtnText}>补打卡</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: COLORS.pink }]} onPress={() => handleDeleteLastRecord(item.name, isMedicine)}>
                <Text style={styles.swipeBtnText}>删除</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>生活记录</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                <Text style={styles.sectionTitle}>今日待打卡</Text>

                <View style={styles.card}>
                    <View style={styles.cardInfo}>
                        <View style={[styles.iconBg, { backgroundColor: COLORS.lightPink }]}><Text style={{ fontSize: 20 }}>🩸</Text></View>
                        <View><Text style={styles.cardTitle}>经期记录</Text><Text style={styles.cardSub}>血量、颜色、症状</Text></View>
                    </View>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.orange }]} onPress={() => { setPeriodFlow(''); setPeriodColor(''); setPeriodSymptoms([]); setPeriodModalVisible(true); }}>
                        <Text style={styles.btnText}>记一下</Text>
                    </TouchableOpacity>
                </View>

                {checkInMedicines.map(med => {
                    const today = new Date().toISOString().split('T')[0];
                    const todayRecords = calendarData[today] || [];
                    const count = todayRecords.filter(r => r.item === med.name && r.category === 'medicine').length;

                    return (
                        <Swipeable key={med.id} renderRightActions={() => renderRightActions(med, true)}>
                            <View style={styles.card}>
                                <TouchableOpacity style={styles.cardInfo} onPress={() => openEditMedicine(med)}>
                                    <View style={[styles.iconBg, { backgroundColor: COLORS.lightOrange }]}>
                                        {med.cover && (med.cover.startsWith('file') || med.cover.startsWith('content')) ? (
                                            <Image source={{ uri: med.cover }} style={{ width: 30, height: 30, borderRadius: 6 }} />
                                        ) : (
                                            <Text style={{ fontSize: 20 }}>{med.cover || '💊'}</Text>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={styles.cardTitle}>{med.name} {count > 0 ? <Text style={{ fontSize: 12, color: COLORS.primaryGreen }}>({count}次)</Text> : null}</Text>
                                        <Text style={styles.cardSub}>剂量: {med.dose}{med.unit || '粒'} · 库存: {med.stock}</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primaryGreen }]} onPress={() => handleMedicineCheckIn(med)}>
                                    <Text style={styles.btnText}>打卡</Text>
                                </TouchableOpacity>
                            </View>
                        </Swipeable>
                    );
                })}

                {habits.map(habit => {
                    const today = new Date().toISOString().split('T')[0];
                    const todayRecords = calendarData[today] || [];
                    const count = todayRecords.filter(r => r.item === habit.name && r.category === 'habit').length;

                    return (
                        <Swipeable key={habit.id} renderRightActions={() => renderRightActions(habit, false)}>
                            <View style={styles.card}>
                                <TouchableOpacity style={styles.cardInfo} onPress={() => openEditHabit(habit)}>
                                    <View style={[styles.iconBg, { backgroundColor: COLORS.lightBlue }]}><Text style={{ fontSize: 20 }}>{habit.icon || '⭐'}</Text></View>
                                    <View>
                                        <Text style={styles.cardTitle}>{habit.name} {count > 0 ? <Text style={{ fontSize: 12, color: COLORS.primaryGreen }}>({count}次)</Text> : null}</Text>
                                        <Text style={styles.cardSub}>{habit.frequency ? `${habit.frequency}` : '未设置频次'} {habit.tags?.length > 0 ? ` · ${habit.tags.join('/')}` : ''}</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primaryGreen }]} onPress={() => handleCheckIn(habit)}>
                                    <Text style={styles.btnText}>打卡</Text>
                                </TouchableOpacity>
                            </View>
                        </Swipeable>
                    );
                })}

                {habits.length === 0 && checkInMedicines.length === 0 && <View style={styles.emptyView}><Text style={styles.emptyText}>暂无打卡项，点击底部 + 配置习惯或药品</Text></View>}
            </ScrollView>

            {/* 习惯标签打卡弹窗 */}
            <Modal visible={tagModalVisible} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>选择 {currentHabit?.name} 标签</Text>
                        <View style={styles.tagGroup}>
                            {currentHabit?.tags.map(tag => (
                                <TouchableOpacity key={tag} style={[styles.tag, selectedTags.includes(tag) && styles.tagActive]} onPress={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}>
                                    <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextActive]}>{tag}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => setTagModalVisible(false)}><Text style={{ color: COLORS.textSub, fontWeight: '600' }}>取消</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleTagSubmit}><Text style={{ color: '#fff', fontWeight: '600' }}>确定</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 经期弹窗 */}
            <Modal visible={periodModalVisible} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>经期记录</Text>
                        <Text style={styles.label}>血量</Text>
                        <View style={styles.tagGroup}>{['少', '中', '多'].map(f => <TouchableOpacity key={f} style={[styles.tag, periodFlow === f && styles.tagActive]} onPress={() => setPeriodFlow(f)}><Text style={[styles.tagText, periodFlow === f && styles.tagTextActive]}>{f}</Text></TouchableOpacity>)}</View>
                        <Text style={styles.label}>颜色</Text>
                        <View style={styles.tagGroup}>{['鲜红', '暗红', '褐色'].map(c => <TouchableOpacity key={c} style={[styles.tag, periodColor === c && styles.tagActive]} onPress={() => setPeriodColor(c)}><Text style={[styles.tagText, periodColor === c && styles.tagTextActive]}>{c}</Text></TouchableOpacity>)}</View>
                        <Text style={styles.label}>伴随症状</Text>
                        <View style={styles.tagGroup}>{['痛经', '腰酸', '情绪低落', '无'].map(s => <TouchableOpacity key={s} style={[styles.tag, periodSymptoms.includes(s) && styles.tagActive]} onPress={() => togglePeriodSymptom(s)}><Text style={[styles.tagText, periodSymptoms.includes(s) && styles.tagTextActive]}>{s}</Text></TouchableOpacity>)}</View>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => setPeriodModalVisible(false)}><Text style={{ color: COLORS.textSub, fontWeight: '600' }}>取消</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handlePeriodSubmit}><Text style={{ color: '#fff', fontWeight: '600' }}>保存</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 删除确认弹窗 */}
            <Modal visible={deleteConfirmVisible} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>删除记录</Text>
                        <Text style={{ fontSize: 14, color: COLORS.textSub, marginBottom: 20, textAlign: 'center' }}>确定要删除最近一条【{deleteTarget?.targetName}】{deleteTarget?.isMedicine ? '药品' : '习惯'}打卡记录吗？{deleteTarget?.isMedicine ? '\n删除后库存将自动恢复。' : ''}</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => setDeleteConfirmVisible(false)}><Text style={{ color: COLORS.textSub, fontWeight: '600' }}>取消</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.pink }]} onPress={confirmDelete}><Text style={{ color: '#fff', fontWeight: '600' }}>删除</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 补打卡弹窗（全新实现） */}
            <Modal visible={backfillModalVisible} transparent animationType="fade" statusBarTranslucent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>补打卡 - {backfillTarget?.name}</Text>

                        <Text style={styles.label}>打卡时间</Text>
                        <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimePicker(true)}>
                            <Text style={styles.timeText}>
                                {String(backfillTime.getHours()).padStart(2, '0')}:{String(backfillTime.getMinutes()).padStart(2, '0')}
                            </Text>
                        </TouchableOpacity>

                        {showTimePicker && (
                            <DateTimePicker
                                value={backfillTime}
                                mode="time"
                                is24Hour={true}
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowTimePicker(false);
                                    if (selectedDate) setBackfillTime(selectedDate);
                                }}
                            />
                        )}

                        {backfillTarget?.category === 'medicine' ? (
                            <>
                                <Text style={styles.label}>备注</Text>
                                <TextInput style={styles.input} value={backfillNote} onChangeText={setBackfillNote} placeholder="例如：补录、饭后服用" />
                                <Text style={[styles.subText, { color: COLORS.orange, fontWeight: '600' }]}>
                                    确认后将自动扣减库存：{backfillTarget.dose}{backfillTarget.unit}
                                </Text>
                            </>
                        ) : (
                            <>
                                {backfillTarget?.tags && backfillTarget.tags.length > 0 && (
                                    <>
                                        <Text style={styles.label}>选择标签（可选）</Text>
                                        <View style={styles.tagGroup}>
                                            {backfillTarget.tags.map(tag => (
                                                <TouchableOpacity key={tag} style={[styles.tag, backfillTags.includes(tag) && styles.tagActive]} onPress={() => toggleBackfillTag(tag)}>
                                                    <Text style={[styles.tagText, backfillTags.includes(tag) && styles.tagTextActive]}>{tag}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}
                                <Text style={styles.label}>备注</Text>
                                <TextInput style={styles.input} value={backfillNote} onChangeText={setBackfillNote} placeholder="例如：补录、忘记打卡" />
                            </>
                        )}

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => setBackfillModalVisible(false)}><Text style={{ color: COLORS.textSub, fontWeight: '600' }}>取消</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={submitBackfill}><Text style={{ color: '#fff', fontWeight: '600' }}>确定</Text></TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <AddItemModal visible={editHabitModalVisible} onClose={() => setEditHabitModalVisible(false)} editHabit={habitToEdit} />
            <AddItemModal visible={editMedModalVisible} onClose={() => setEditMedModalVisible(false)} editItem={medToEdit} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60 },
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
    emptyText: { color: COLORS.textSub, fontSize: 14 },
    swipeActions: { flexDirection: 'row', alignItems: 'center', marginRight: SIZES.padding, marginBottom: 12 },
    swipeBtn: { width: 70, height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginLeft: 4 },
    swipeBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%' },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain, marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, marginTop: 15, marginBottom: 8 },
    input: { backgroundColor: '#f0f0f0', borderRadius: 10, padding: 12, fontSize: 15 },
    subText: { fontSize: 12, color: COLORS.textSub, marginTop: 10, textAlign: 'center' },
    timeBtn: { backgroundColor: '#f0f0f0', borderRadius: 10, padding: 15, alignItems: 'center', marginBottom: 5 },
    timeText: { fontSize: 18, fontWeight: '600', color: COLORS.primaryGreen },
    tagGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tag: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f0f0f0', borderRadius: 20 },
    tagActive: { backgroundColor: COLORS.lightGreen, borderWidth: 1, borderColor: COLORS.primaryGreen },
    tagText: { fontSize: 14, color: COLORS.textSub },
    tagTextActive: { color: COLORS.primaryGreen, fontWeight: '600' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.primaryGreen, alignItems: 'center' },
});