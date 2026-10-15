import React, { useContext, useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';

LocaleConfig.locales['zh'] = { monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'], monthNamesShort: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'], dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'], dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'], today: '今天' };
LocaleConfig.defaultLocale = 'zh';

export default function CalendarScreen({ route }) {
    const { calendarData, removeLog } = useContext(AppContext);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterItem, setFilterItem] = useState(null);
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    useEffect(() => {
        if (route.params) {
            if (route.params.filterItem) setFilterItem(route.params.filterItem);
            if (route.params.filterCategory) setFilterCategory(route.params.filterCategory);
        }
    }, [route.params]);

    const availableItems = useMemo(() => {
        if (filterCategory === 'all') return [];
        const items = new Set();
        Object.values(calendarData).forEach(records => {
            records.forEach(r => { if (r.category === filterCategory && r.item) items.add(r.item); });
        });
        return Array.from(items);
    }, [calendarData, filterCategory]);

    const getMarkedDates = () => {
        let marked = {};
        // 先处理数据记录点
        Object.keys(calendarData).forEach(date => {
            let dots = [];
            let hasInv = false, hasMed = false, hasHab = false;
            calendarData[date].forEach(r => {
                if ((filterCategory === 'all' || r.category === filterCategory) && (!filterItem || r.item === filterItem)) {
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

        // 关键修复：不管有没有记录，选中的日期必须高亮选中样式，并且持久保留
        if (marked[selectedDate]) {
            marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: COLORS.primaryGreen };
        } else {
            marked[selectedDate] = { selected: true, selectedColor: COLORS.primaryGreen };
        }
        return marked;
    };

    const currentRecords = calendarData[selectedDate] || [];
    const filteredRecords = currentRecords.filter(r => (filterCategory === 'all' || r.category === filterCategory) && (!filterItem || r.item === filterItem));

    const handleDeleteRecord = (record) => {
        Alert.alert('删除记录', `确定要删除这条记录吗？`, [
            { text: '取消', style: 'cancel' },
            { text: '删除', style: 'destructive', onPress: () => removeLog(selectedDate, record.id) }
        ]);
    };

    // 将记录文本拆解，突出主体
    const renderRecordText = (record) => {
        // 对于习惯打卡，文本一般为 "完成 [主体] 打卡"
        if (record.category === 'habit' && record.text.startsWith('完成') && record.text.endsWith('打卡')) {
            const subject = record.text.replace('完成 ', '').replace(' 打卡', '');
            return (
                <View style={styles.timelineRow}>
                    <Text style={styles.timelineAction}>完成</Text>
                    <Text style={styles.timelineSubject}>{subject}</Text>
                    <Text style={styles.timelineAction}>打卡</Text>
                </View>
            );
        }
        // 对于库存，文本一般为 "消耗了 1盒 纯牛奶"
        if (record.category === 'inventory') {
            const parts = record.text.split(' ');
            if (parts.length >= 3) {
                return (
                    <View style={styles.timelineRow}>
                        <Text style={styles.timelineAction}>{parts[0]}</Text>
                        <Text style={styles.timelineSubject}>{parts[2]}</Text>
                        <Text style={styles.timelineAction}>{parts[1]}</Text>
                    </View>
                );
            }
        }
        // 其他情况原样展示
        return <Text style={styles.timelineSubject}>{record.text}</Text>;
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>记录日历</Text>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}><Text style={styles.filterBtnText}>⚙️ 筛选</Text></TouchableOpacity>
            </View>

            {(filterCategory !== 'all' || filterItem) && (
                <View style={styles.filterBanner}>
                    <Text style={styles.filterBannerText}>正在筛选：{filterCategory === 'all' ? '全部' : (filterCategory === 'inventory' ? '库存' : (filterCategory === 'medicine' ? '药品' : '习惯'))}{filterItem ? ` · ${filterItem}` : ''}</Text>
                    <TouchableOpacity onPress={() => { setFilterCategory('all'); setFilterItem(null); }}><Text style={styles.clearFilterText}>清除</Text></TouchableOpacity>
                </View>
            )}

            <View style={{ height: SIZES.screenHeight * 0.4 }}>
                <Calendar
                    current={selectedDate}
                    onDayPress={day => setSelectedDate(day.dateString)}
                    markedDates={getMarkedDates()}
                    markingType={'multi-dot'}
                    monthFormat={'yyyy年MM月'}
                    theme={{
                        calendarBackground: COLORS.bg,
                        textSectionTitleColor: COLORS.textSub,
                        selectedDayBackgroundColor: COLORS.primaryGreen,
                        selectedDayTextColor: '#ffffff',
                        todayTextColor: COLORS.primaryGreen,
                        dayTextColor: COLORS.textMain,
                        textDisabledColor: COLORS.textLight,
                        dotColor: COLORS.primaryGreen,
                        selectedDotColor: '#ffffff',
                        arrowColor: COLORS.primaryGreen,
                        monthTextColor: COLORS.textMain,
                        textMonthFontWeight: 'bold',
                        textDayFontSize: 14,
                        textMonthFontSize: 16,
                    }}
                />
            </View>

            <View style={styles.legend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.dotInv }]} /><Text style={styles.legendText}>库存</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.dotMed }]} /><Text style={styles.legendText}>药品</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.dotHab }]} /><Text style={styles.legendText}>习惯</Text></View>
            </View>

            <ScrollView style={styles.timeline}>
                <Text style={styles.timelineTitle}>{selectedDate} 记录</Text>
                {filteredRecords.length === 0 ? <Text style={styles.emptyText}>当天暂无记录</Text> : filteredRecords.sort((a, b) => b.time.localeCompare(a.time)).map((record, index) => (
                    <View key={record.id || index} style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: record.category === 'inventory' ? COLORS.dotInv : (record.category === 'medicine' ? COLORS.dotMed : COLORS.dotHab) }]} />
                        <View style={styles.timelineContent}>
                            <View style={styles.timelineRow}>
                                <Text style={styles.timelineTime}>{record.time}</Text>
                                {renderRecordText(record)}
                            </View>
                            {record.sub ? <Text style={styles.timelineSub}>{record.sub}</Text> : null}
                        </View>
                        <TouchableOpacity style={styles.deleteRecordBtn} onPress={() => handleDeleteRecord(record)}>
                            <Text style={styles.deleteRecordText}>删除</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>

            <Modal visible={filterModalVisible} transparent animationType="slide" statusBarTranslucent>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>筛选记录</Text><TouchableOpacity onPress={() => setFilterModalVisible(false)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity></View>
                        <Text style={styles.filterLabel}>一级分类</Text>
                        <View style={styles.filterRow}>
                            {['all', 'inventory', 'medicine', 'habit'].map(cat => (
                                <TouchableOpacity key={cat} style={[styles.filterChip, filterCategory === cat && styles.filterChipActive]} onPress={() => { setFilterCategory(cat); setFilterItem(null); }}><Text style={[styles.filterChipText, filterCategory === cat && styles.filterChipTextActive]}>{cat === 'all' ? '全部' : (cat === 'inventory' ? '库存' : (cat === 'medicine' ? '药品' : '习惯'))}</Text></TouchableOpacity>
                            ))}
                        </View>
                        {filterCategory !== 'all' && availableItems.length > 0 && (
                            <><Text style={styles.filterLabel}>二级分类（具体物品）</Text><View style={styles.filterRow}><TouchableOpacity style={[styles.filterChip, !filterItem && styles.filterChipActive]} onPress={() => setFilterItem(null)}><Text style={[styles.filterChipText, !filterItem && styles.filterChipTextActive]}>全部</Text></TouchableOpacity>{availableItems.map(item => (<TouchableOpacity key={item} style={[styles.filterChip, filterItem === item && styles.filterChipActive]} onPress={() => setFilterItem(item)}><Text style={[styles.filterChipText, filterItem === item && styles.filterChipTextActive]}>{item}</Text></TouchableOpacity>))}</View></>
                        )}
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
    timelineAction: { fontSize: 13, color: COLORS.textSub },
    timelineSubject: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
    timelineSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
    deleteRecordBtn: { marginLeft: 8, padding: 6, backgroundColor: COLORS.lightPink, borderRadius: 6 },
    deleteRecordText: { color: COLORS.pink, fontSize: 11, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.padding, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain },
    filterLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, marginTop: 15, marginBottom: 10 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
    filterChipActive: { backgroundColor: COLORS.lightGreen, borderColor: COLORS.primaryGreen },
    filterChipText: { fontSize: 13, color: COLORS.textSub },
    filterChipTextActive: { color: COLORS.primaryGreen, fontWeight: '600' },
    applyBtn: { backgroundColor: COLORS.primaryGreen, padding: 15, borderRadius: 14, alignItems: 'center', marginTop: 30 },
    applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});