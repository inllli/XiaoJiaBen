


import React, { useContext, useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';

LocaleConfig.locales['zh'] = { monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'], monthNamesShort: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'], dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'], dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'], today: '今天' };
LocaleConfig.defaultLocale = 'zh';

export default function CalendarScreen({ route }) {
    const { calendarData, inventory, removeLog, themeBg, themeColors: tc } = useContext(AppContext);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterItem, setFilterItem] = useState(null);
    const [filterGroup, setFilterGroup] = useState('all');   // 需求6：二级分组
    const [itemSearch, setItemSearch] = useState('');      // 需求6：三级物品搜索
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        if (route.params) {
            if (route.params.filterItem) setFilterItem(route.params.filterItem);
            if (route.params.filterCategory) setFilterCategory(route.params.filterCategory);
            // 从首页"查看更多"进入：始终回到当日
            if (route.params.date) setSelectedDate(route.params.date);
        }
    }, [route.params]);

    // ===== 需求6：筛选重构为「一级 记录类型 → 二级 分组 → 三级 具体物品」 =====
    const categoryLabel = (cat) => (cat === 'all' ? '全部' : (cat === 'inventory' ? '库存' : (cat === 'medicine' ? '药品' : '习惯')));

    // 该记录类型下，每个物品的历史记录条数（用于排序与条数展示）
    const recordCount = useMemo(() => {
        const map = {};
        Object.values(calendarData).forEach(records => {
            records.forEach(r => { if (r.category === filterCategory && r.item) map[r.item] = (map[r.item] || 0) + 1; });
        });
        return map;
    }, [calendarData, filterCategory]);

    const availableItems = useMemo(() => Object.keys(recordCount), [recordCount]);

    // 分组归属：库存按物品自身分类，药品/习惯按归属大类
    const groupOf = (name) => {
        const found = inventory.find(i => i.name === name);
        if (filterCategory === 'inventory') return (found && found.category) ? found.category : '未分类';
        if (filterCategory === 'medicine') return '药品';
        if (filterCategory === 'habit') return '习惯';
        return (found && found.category) ? found.category : '未分类';
    };

    const availableGroups = useMemo(() => {
        const set = new Set();
        availableItems.forEach(n => set.add(groupOf(n)));
        return Array.from(set);
    }, [availableItems, inventory, filterCategory]);

    const filteredItems = useMemo(() => {
        const kw = itemSearch.trim().toLowerCase();
        return availableItems
            .filter(n => filterGroup === 'all' || groupOf(n) === filterGroup)
            .filter(n => !kw || String(n).toLowerCase().includes(kw))
            .sort((a, b) => (recordCount[b] || 0) - (recordCount[a] || 0));
    }, [availableItems, filterGroup, itemSearch, recordCount, inventory]);

    // 统一筛选判定：一级（类型）+ 二级（分组）+ 三级（物品）
    const matchFilter = (r) => {
        if (filterCategory !== 'all' && r.category !== filterCategory) return false;
        if (filterItem) return r.item === filterItem;
        if (filterGroup !== 'all') return !!r.item && groupOf(r.item) === filterGroup;
        return true;
    };

    const getMarkedDates = () => {
        let marked = {};
        Object.keys(calendarData).forEach(date => {
            let dots = [];
            let hasInv = false, hasMed = false, hasHab = false;
            calendarData[date].forEach(r => {
                if (matchFilter(r)) {
                    if (r.category === 'inventory') hasInv = true;
                    if (r.category === 'medicine') hasMed = true;
                    if (r.category === 'habit') hasHab = true;
                }
            });
            if (hasInv) dots.push({ key: 'inv', color: COLORS.dotInv });
            if (hasMed) dots.push({ key: 'med', color: COLORS.dotMed });
            if (hasHab) dots.push({ key: 'hab', color: COLORS.dotHab });
            if (dots.length > 0) marked[date] = { dots };
        });
        if (marked[selectedDate]) marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: COLORS.primaryGreen };
        else marked[selectedDate] = { selected: true, selectedColor: COLORS.primaryGreen };
        return marked;
    };

    const currentRecords = calendarData[selectedDate] || [];
    const filteredRecords = currentRecords.filter(matchFilter);

    const handleDeleteRecord = (record) => {
        setDeleteTarget(record);
        setDeleteConfirmVisible(true);
    };

    const confirmDelete = () => {
        if (deleteTarget) {
            removeLog(selectedDate, deleteTarget.id);
            setDeleteConfirmVisible(false);
            setDeleteTarget(null);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: tc.bg }]}>
            <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, { color: tc.textMain }]}>记录日历</Text>
                <TouchableOpacity style={[styles.filterBtn, { backgroundColor: tc.chipBg }]} onPress={() => setFilterModalVisible(true)}><Text style={[styles.filterBtnText, { color: tc.textMain }]}>⚙️ 筛选</Text></TouchableOpacity>
            </View>
            {(filterCategory !== 'all' || filterItem) && (
                <View style={styles.filterBanner}>
                    <Text style={styles.filterBannerText}>{'正在筛选：' + categoryLabel(filterCategory) + (filterGroup !== 'all' ? ' · ' + filterGroup : '') + (filterItem ? ' · ' + filterItem : '')}</Text>
                    <TouchableOpacity onPress={() => { setFilterCategory('all'); setFilterItem(null); setFilterGroup('all'); setItemSearch(''); }}><Text style={[styles.clearFilterText, { color: tc.textSub }]}>清除</Text></TouchableOpacity>
                </View>
            )}
            {/* 日历组件 + 图例 高度自适应内容（压缩行距后约屏高 40%），操作记录占剩余空间；weekVerticalMargin 控制行距 */}
            <View style={{ overflow: 'hidden' }}>
                <Calendar key={themeBg + '-' + selectedDate.slice(0, 7)} current={selectedDate} onDayPress={day => setSelectedDate(day.dateString)} markedDates={getMarkedDates()} markingType={'multi-dot'} monthFormat={'yyyy年MM月'}
                    theme={{ calendarBackground: tc.bg, textSectionTitleColor: tc.textSub, selectedDayBackgroundColor: COLORS.primaryGreen, selectedDayTextColor: '#ffffff', todayBackgroundColor: 'rgba(142,170,139,0.28)', todayTextColor: COLORS.primaryGreen, dayTextColor: tc.textMain, textDisabledColor: tc.textLight, dotColor: COLORS.primaryGreen, selectedDotColor: '#ffffff', arrowColor: COLORS.primaryGreen, monthTextColor: tc.textMain, textMonthFontWeight: 'bold', textDayFontSize: 14, textMonthFontSize: 16, weekVerticalMargin: 2 }} />
                <View style={[styles.legend, { backgroundColor: tc.bg }]}>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.dotInv }]} /><Text style={[styles.legendText, { color: tc.textSub }]}>库存</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.dotMed }]} /><Text style={[styles.legendText, { color: tc.textSub }]}>药品</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.dotHab }]} /><Text style={[styles.legendText, { color: tc.textSub }]}>习惯</Text></View>
                </View>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={[styles.timeline, { flex: 1, backgroundColor: tc.cardBg }]} contentContainerStyle={{ paddingBottom: 80 }}>
                <Text style={[styles.timelineTitle, { color: tc.textMain }]}>{selectedDate} 记录</Text>
                {filteredRecords.length === 0 ? <Text style={[styles.emptyText, { color: tc.textSub }]}>当天暂无记录</Text> : filteredRecords.sort((a, b) => b.time.localeCompare(a.time)).map((record, index) => (
                    <View key={record.id || index} style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: record.category === 'inventory' ? COLORS.dotInv : (record.category === 'medicine' ? COLORS.dotMed : COLORS.dotHab) }]} />
                        <View style={[styles.timelineContent, { backgroundColor: tc.cardSubBg }]}>
                            <View style={styles.timelineRow}><Text style={[styles.timelineTime, { color: tc.textSub }]}>{record.time}</Text><Text style={[styles.timelineText, { color: tc.textMain }]}>{record.text}</Text></View>
                            {record.sub ? <Text style={[styles.timelineSub, { color: tc.textSub }]}>{record.sub}</Text> : null}
                        </View>
                        <TouchableOpacity style={[styles.deleteRecordBtn, { backgroundColor: tc.dangerBg }]} onPress={() => handleDeleteRecord(record)}><Text style={styles.deleteRecordText}>删除</Text></TouchableOpacity>
                    </View>
                ))}
            </ScrollView>

            <Modal visible={deleteConfirmVisible} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: tc.textMain }]}>删除记录</Text>
                        <Text style={{ fontSize: 14, color: tc.textSub, marginBottom: 20, textAlign: 'center' }}>确定要删除这条记录吗？</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setDeleteConfirmVisible(false)}><Text style={{ color: tc.textSub, fontWeight: '600' }}>取消</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.pink }]} onPress={confirmDelete}><Text style={{ color: '#fff', fontWeight: '600' }}>删除</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={filterModalVisible} transparent animationType="slide" statusBarTranslucent>
                <TouchableOpacity style={styles.filterModalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
                    <View style={[styles.filterModalContent, { backgroundColor: tc.modalBg }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: tc.textMain }]}>筛选记录</Text><TouchableOpacity onPress={() => setFilterModalVisible(false)}><Text style={{ fontSize: 24, color: tc.textSub }}>✕</Text></TouchableOpacity></View>
                        <ScrollView keyboardShouldPersistTaps="handled" style={styles.filterScroll} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.filterLabel, { color: tc.textMain }]}>一级 · 记录类型</Text>
                            <View style={styles.filterRow}>
                                {['all', 'inventory', 'medicine', 'habit'].map(cat => (
                                    <TouchableOpacity key={cat} style={[styles.filterChip, { backgroundColor: tc.chipBg, borderColor: tc.border }, filterCategory === cat && styles.filterChipActive]} onPress={() => { setFilterCategory(cat); setFilterItem(null); setFilterGroup('all'); setItemSearch(''); }}>
                                        <Text style={[styles.filterChipText, { color: tc.textSub }, filterCategory === cat && styles.filterChipTextActive]}>{categoryLabel(cat)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {filterCategory !== 'all' && availableGroups.length > 1 && (<>
                                <Text style={[styles.filterLabel, { color: tc.textMain }]}>二级 · 分组（{filterCategory === 'inventory' ? '物品分类' : '归属'}）</Text>
                                <View style={styles.filterRow}>
                                    <TouchableOpacity style={[styles.filterChip, { backgroundColor: tc.chipBg, borderColor: tc.border }, filterGroup === 'all' && styles.filterChipActive]} onPress={() => { setFilterGroup('all'); setFilterItem(null); }}>
                                        <Text style={[styles.filterChipText, { color: tc.textSub }, filterGroup === 'all' && styles.filterChipTextActive]}>全部</Text>
                                    </TouchableOpacity>
                                    {availableGroups.map(g => (
                                        <TouchableOpacity key={g} style={[styles.filterChip, { backgroundColor: tc.chipBg, borderColor: tc.border }, filterGroup === g && styles.filterChipActive]} onPress={() => { setFilterGroup(g); setFilterItem(null); }}>
                                            <Text style={[styles.filterChipText, { color: tc.textSub }, filterGroup === g && styles.filterChipTextActive]}>{g}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>)}

                            {filterCategory !== 'all' && availableItems.length > 0 && (<>
                                <Text style={[styles.filterLabel, { color: tc.textMain }]}>三级 · 具体物品（共 {availableItems.length} 项，按记录条数排序）</Text>
                                <TextInput style={[styles.filterSearch, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} placeholder="输入物品名称搜索" placeholderTextColor={tc.textLight} value={itemSearch} onChangeText={setItemSearch} />
                                <ScrollView keyboardShouldPersistTaps="handled" style={styles.filterItemScroll} showsVerticalScrollIndicator={true}>
                                    <View style={styles.filterRow}>
                                        <TouchableOpacity style={[styles.filterChip, { backgroundColor: tc.chipBg, borderColor: tc.border }, !filterItem && styles.filterChipActive]} onPress={() => setFilterItem(null)}>
                                            <Text style={[styles.filterChipText, { color: tc.textSub }, !filterItem && styles.filterChipTextActive]}>全部</Text>
                                        </TouchableOpacity>
                                        {filteredItems.map(name => (
                                            <TouchableOpacity key={name} style={[styles.filterChip, { backgroundColor: tc.chipBg, borderColor: tc.border }, filterItem === name && styles.filterChipActive]} onPress={() => setFilterItem(name)}>
                                                <Text style={[styles.filterChipText, { color: tc.textSub }, filterItem === name && styles.filterChipTextActive]}>{name} · {recordCount[name] || 0}条</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {filteredItems.length === 0 && <Text style={[styles.filterEmpty, { color: tc.textSub }]}>没有匹配的物品，换个关键词试试</Text>}
                                </ScrollView>
                            </>)}
                        </ScrollView>
                        <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterModalVisible(false)}><Text style={styles.applyBtnText}>确定</Text></TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SIZES.padding, marginBottom: 10 },
    headerTitle: { fontSize: 24, fontWeight: '600', color: COLORS.textMain },
    filterBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, ...SHADOWS.card },
    filterBtnText: { fontSize: 13, color: COLORS.textMain, fontWeight: '600' },
    filterBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.lightGreen, marginHorizontal: SIZES.padding, padding: 12, borderRadius: 12, marginBottom: 10 },
    filterBannerText: { fontSize: 13, color: COLORS.primaryGreen, fontWeight: '600' },
    clearFilterText: { fontSize: 12, color: COLORS.textSub, textDecorationLine: 'underline' },
    legend: { flexDirection: 'row', justifyContent: 'center', marginVertical: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
    legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
    legendText: { fontSize: 12, color: COLORS.textSub },
    timeline: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.padding, ...SHADOWS.card },
    timelineTitle: { fontSize: 16, fontWeight: '600', marginBottom: 15 },
    emptyText: { textAlign: 'center', color: COLORS.textSub, marginTop: 20 },
    timelineItem: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, marginRight: 10 },
    timelineContent: { flex: 1, backgroundColor: COLORS.bg, padding: 8, borderRadius: 8 },
    timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
    timelineTime: { fontSize: 12, color: COLORS.textSub, fontWeight: '600', marginRight: 4 },
    timelineText: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
    timelineSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
    deleteRecordBtn: { marginLeft: 8, padding: 6, backgroundColor: COLORS.lightPink, borderRadius: 6 },
    deleteRecordText: { color: COLORS.pink, fontSize: 11, fontWeight: '600' },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain },
    saveBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.primaryGreen, alignItems: 'center' },
    filterModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
    filterModalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.padding, paddingBottom: 30, maxHeight: '82%' },
    filterScroll: { maxHeight: SIZES.screenHeight * 0.5 },
    filterSearch: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: COLORS.textMain, marginTop: 4, marginBottom: 8 },
    filterItemScroll: { maxHeight: 210, marginBottom: 4 },
    filterEmpty: { fontSize: 12, color: COLORS.textSub, textAlign: 'center', paddingVertical: 10 },
    filterLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, marginTop: 15, marginBottom: 10 },
    filterHint: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
    filterChipActive: { backgroundColor: COLORS.lightGreen, borderColor: COLORS.primaryGreen },
    filterChipText: { fontSize: 13, color: COLORS.textSub },
    filterChipTextActive: { color: COLORS.primaryGreen, fontWeight: '600' },
    applyBtn: { backgroundColor: COLORS.primaryGreen, padding: 15, borderRadius: 14, alignItems: 'center', marginTop: 16 },
    applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
CalendarScreen