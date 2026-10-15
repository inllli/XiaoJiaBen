import React, { useContext, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, ScrollView, Image } from 'react-native';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';
import AddItemModal from '../components/AddItemModal';

export default function HomeScreen({ navigation }) {
    const { inventory, calendarData, updateStock, deleteItem, getItemStatus } = useContext(AppContext);
    const [category, setCategory] = useState('全部');
    const [modalVisible, setModalVisible] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [tempStock, setTempStock] = useState(0);

    const filteredInventory = useMemo(() => {
        if (category === '全部') return inventory;
        return inventory.filter(i => i.category === category);
    }, [inventory, category]);

    const openDetail = (item) => {
        setSelectedItem(item);
        setTempStock(item.stock);
        setDetailVisible(true);
    };

    const handleConfirm = () => {
        if (selectedItem) {
            const delta = tempStock - selectedItem.stock;
            if (delta !== 0) updateStock(selectedItem.id, delta, selectedItem.name, selectedItem.unit);
            setDetailVisible(false);
        }
    };

    const itemRecords = useMemo(() => {
        if (!selectedItem) return [];
        let records = [];
        Object.values(calendarData).forEach(dayRecords => {
            dayRecords.forEach(r => { if (r.item === selectedItem.name && r.category === 'inventory') records.push(r); });
        });
        return records.sort((a, b) => b.time.localeCompare(a.time));
    }, [calendarData, selectedItem]);

    const renderItem = ({ item }) => {
        const status = getItemStatus(item);
        return (
            <TouchableOpacity
                style={[styles.card, status === 'warn' && styles.cardWarn, status === 'danger' && styles.cardDanger]}
                onPress={() => openDetail(item)}
            >
                <View style={styles.itemImage}>
                    {item.cover && (item.cover.startsWith('file') || item.cover.startsWith('content')) ? (
                        <Image source={{ uri: item.cover }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" />
                    ) : (
                        <Text style={{ fontSize: 40 }}>{item.cover || '📦'}</Text>
                    )}
                </View>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <View style={styles.itemSub}>
                    <View style={[styles.statusDot, { backgroundColor: status === 'ok' ? COLORS.primaryGreen : (status === 'warn' ? COLORS.orange : COLORS.pink) }]} />
                    <Text style={styles.itemStock}>剩{item.stock}{item.unit}</Text>
                </View>
                {status === 'warn' && <View style={styles.badge}><Text style={styles.badgeText}>快用完了</Text></View>}
                {status === 'danger' && <View style={[styles.badge, { backgroundColor: COLORS.pink }]}><Text style={styles.badgeText}>临期</Text></View>}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>下午好，家里有{inventory.length}件物品</Text>

            {inventory.some(i => getItemStatus(i) !== 'ok') && (
                <View style={styles.alertBanner}><Text style={styles.alertText}>⚠️ 有物品需要补货或临期，请留意</Text></View>
            )}

            <View style={styles.categoryRow}>
                {['全部', '食品', '日用品', '洗护', '药品', '其他'].map(cat => (
                    <TouchableOpacity key={cat} onPress={() => setCategory(cat)} style={[styles.catChip, category === cat && styles.catChipActive]}>
                        <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {filteredInventory.length === 0 ? (
                <View style={styles.emptyView}><Text style={styles.emptyText}>暂无物品，点击底部 + 添加</Text></View>
            ) : (
                <FlatList data={filteredInventory} renderItem={renderItem} keyExtractor={item => item.id} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={{ paddingBottom: 100 }} />
            )}

            <Modal visible={detailVisible} transparent animationType="slide" statusBarTranslucent>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailVisible(false)}>
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{selectedItem?.name}</Text>
                                <Text style={styles.modalSub}>{selectedItem?.category} · {selectedItem?.location}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDetailVisible(false)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity>
                        </View>

                        <View style={styles.stockControl}>
                            <Text style={styles.stockText}>剩 {tempStock.toFixed(1)} {selectedItem?.unit}</Text>
                            <View style={styles.btnGroup}>
                                <TouchableOpacity style={styles.glassBtn} onPress={() => setTempStock(prev => Math.max(0, prev - 0.5))}><Text>-0.5</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.glassBtn} onPress={() => setTempStock(prev => Math.max(0, prev - 1))}><Text>-1</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.glassBtn} onPress={() => setTempStock(prev => prev + 1)}><Text>+1</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.glassBtn} onPress={() => setTempStock(prev => prev + 0.5)}><Text>+0.5</Text></TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ marginTop: 20 }}>
                            <Text style={styles.recordTitle}>操作记录</Text>
                            <ScrollView style={{ maxHeight: 150 }}>
                                {itemRecords.length === 0 ? <Text style={styles.emptyText}>暂无记录</Text> : itemRecords.map((r, i) => (
                                    <View key={i} style={styles.recordItem}>
                                        <View style={[styles.recordDot, { backgroundColor: COLORS.primaryGreen }]} />
                                        <View><Text style={styles.recordTime}>{r.time}</Text><Text style={styles.recordText}>{r.text}</Text><Text style={styles.recordSub}>{r.sub}</Text></View>
                                    </View>
                                ))}
                            </ScrollView>
                            <TouchableOpacity style={styles.viewMoreBtn} onPress={() => { setDetailVisible(false); navigation.navigate('日历', { filterItem: selectedItem.name, filterCategory: 'inventory' }); }}>
                                <Text style={styles.viewMoreText}>查看更多</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => { deleteItem(selectedItem.id); setDetailVisible(false); }}><Text style={styles.deleteBtnText}>删除</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.editBtn} onPress={() => { setEditItem(selectedItem); setDetailVisible(false); setModalVisible(true); }}><Text style={styles.editBtnText}>编辑</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}><Text style={styles.confirmBtnText}>确认</Text></TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            <AddItemModal visible={modalVisible} onClose={() => { setModalVisible(false); setEditItem(null); }} editItem={editItem} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60 },
    headerTitle: { fontSize: 24, fontWeight: '600', color: COLORS.textMain, paddingHorizontal: SIZES.padding, marginBottom: 15 },
    alertBanner: { backgroundColor: COLORS.lightOrange, marginHorizontal: SIZES.padding, padding: 12, borderRadius: 12, marginBottom: 15 },
    alertText: { color: COLORS.orange, fontSize: 13, fontWeight: '600' },
    categoryRow: { flexDirection: 'row', paddingHorizontal: SIZES.padding, marginBottom: 20, flexWrap: 'wrap', gap: 8 },
    catChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
    catChipActive: { backgroundColor: COLORS.primaryGreen, borderColor: COLORS.primaryGreen },
    catText: { fontSize: 13, color: COLORS.textSub },
    catTextActive: { color: '#fff', fontWeight: '600' },
    row: { justifyContent: 'space-between', paddingHorizontal: SIZES.padding },
    card: { width: '48%', backgroundColor: COLORS.cardBg, borderRadius: SIZES.radius, padding: 12, marginBottom: 16, ...SHADOWS.card },
    cardWarn: { borderColor: COLORS.orange, borderWidth: 1, backgroundColor: '#fffaf5' },
    cardDanger: { borderColor: COLORS.pink, borderWidth: 1, backgroundColor: '#fff7f7' },
    itemImage: { height: 100, backgroundColor: COLORS.bg, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden' },
    itemTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginBottom: 6 },
    itemSub: { flexDirection: 'row', alignItems: 'center' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    itemStock: { fontSize: 12, color: COLORS.textSub },
    badge: { position: 'absolute', top: 16, right: 16, backgroundColor: COLORS.orange, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    emptyText: { color: COLORS.textSub, fontSize: 14, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.padding, minHeight: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain },
    modalSub: { fontSize: 12, color: COLORS.textSub, marginTop: 4 },
    stockControl: { backgroundColor: '#fff', padding: 16, borderRadius: SIZES.radius, ...SHADOWS.card },
    stockText: { fontSize: 22, fontWeight: '600', color: COLORS.textMain, marginBottom: 12 },
    btnGroup: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    glassBtn: { flex: 1, padding: 10, backgroundColor: COLORS.bg, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    recordTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textMain, marginBottom: 10 },
    recordItem: { flexDirection: 'row', marginBottom: 12 },
    recordDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 10 },
    recordTime: { fontSize: 12, color: COLORS.textSub, marginBottom: 2 },
    recordText: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
    recordSub: { fontSize: 12, color: COLORS.textSub },
    viewMoreBtn: { alignItems: 'center', paddingVertical: 10 },
    viewMoreText: { fontSize: 13, color: COLORS.primaryGreen, fontWeight: '600' },
    footer: { flexDirection: 'row', gap: 8, marginTop: 10 },
    deleteBtn: { flex: 0.6, padding: 14, borderRadius: 14, backgroundColor: COLORS.lightPink, alignItems: 'center' },
    deleteBtnText: { color: COLORS.pink, fontSize: 15, fontWeight: '600' },
    editBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.orange, alignItems: 'center' },
    editBtnText: { color: COLORS.orange, fontSize: 15, fontWeight: '600' },
    confirmBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.primaryGreen, alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});