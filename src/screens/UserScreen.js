import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';

export default function UserScreen() {
    const { exportData, importData, clearAllData } = useContext(AppContext);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [defaultUnit, setDefaultUnit] = useState('盒');
    const [defaultTime, setDefaultTime] = useState('08:30');
    const [editingKey, setEditingKey] = useState(null);
    const [editValue, setEditValue] = useState('');

    const handleSaveEdit = () => {
        if (editingKey === 'unit') setDefaultUnit(editValue);
        if (editingKey === 'time') setDefaultTime(editValue);
        setEditingKey(null);
    };

    const renderCard = (icon, title, sub, onPress) => (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.iconContainer}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
            <View style={styles.cardTextContainer}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSub}>{sub}</Text></View>
            <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>我的</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {renderCard('📤', '数据备份导出', '将记录导出为本地文件', exportData)}
                {renderCard('📥', '数据恢复导入', '从本地文件恢复数据', importData)}
                {renderCard('⚙️', '偏好设置', '清除数据、默认单位等', () => setSettingsVisible(true))}
            </ScrollView>

            <Modal visible={settingsVisible} transparent animationType="slide" statusBarTranslucent>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSettingsVisible(false)}>
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>偏好设置</Text><TouchableOpacity onPress={() => setSettingsVisible(false)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity></View>
                        <TouchableOpacity style={styles.settingItem} onPress={() => { setEditingKey('unit'); setEditValue(defaultUnit); }}><Text style={styles.settingText}>默认单位</Text><Text style={styles.settingValue}>{defaultUnit}</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.settingItem} onPress={() => { setEditingKey('time'); setEditValue(defaultTime); }}><Text style={styles.settingText}>打卡提醒时间</Text><Text style={styles.settingValue}>{defaultTime}</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.settingItem, { borderBottomWidth: 0 }]} onPress={() => { clearAllData(); setSettingsVisible(false); }}><Text style={[styles.settingText, { color: COLORS.pink }]}>清除所有数据（出厂设置）</Text><Text style={styles.settingValue}>⚠️</Text></TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={editingKey !== null} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.editOverlay}>
                    <View style={styles.editContent}>
                        <Text style={styles.editTitle}>修改设置</Text>
                        <TextInput style={styles.editInput} value={editValue} onChangeText={setEditValue} autoFocus />
                        <View style={styles.editFooter}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingKey(null)}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveEdit}><Text style={styles.confirmText}>确定</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60 },
    headerTitle: { fontSize: 24, fontWeight: '600', color: COLORS.textMain, paddingHorizontal: SIZES.padding, marginBottom: 20 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, marginHorizontal: SIZES.padding, padding: 16, borderRadius: SIZES.radius, marginBottom: 16, ...SHADOWS.card },
    iconContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.lightGreen, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    cardTextContainer: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
    cardSub: { fontSize: 12, color: COLORS.textSub },
    arrow: { fontSize: 20, color: COLORS.textLight, marginLeft: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.padding, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain },
    settingItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    settingText: { fontSize: 15, color: COLORS.textMain },
    settingValue: { fontSize: 14, color: COLORS.textSub },
    editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    editContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '80%' },
    editTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
    editInput: { backgroundColor: '#f0f0f0', borderRadius: 10, padding: 12, fontSize: 16, textAlign: 'center', marginBottom: 20 },
    editFooter: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
    cancelText: { color: COLORS.textSub },
    confirmBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: COLORS.primaryGreen, alignItems: 'center' },
    confirmText: { color: '#fff', fontWeight: '600' },
});