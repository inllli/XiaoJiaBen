import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, ScrollView, Image, TextInput, Animated, PanResponder, Dimensions } from 'react-native';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';
import AddItemModal from '../components/AddItemModal';

// 封面轮播：多张封面时每 5 秒从右向左滑动切换一张，单张时静态显示
// 失效封面（加载报错的本地/网络路径）直接跳过，避免首页把失效项和正常封面混在一起轮播
function CoverCarousel({ covers, onError, bg }) {
    const [idx, setIdx] = useState(0);
    const [boxW, setBoxW] = useState(0);
    const [failedUris, setFailedUris] = useState([]);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const isUri = (c) => typeof c === 'string' && (c.startsWith('file') || c.startsWith('content') || c.startsWith('http') || c.startsWith('data:image'));
    const all = (covers && covers.length > 0) ? covers : [];
    // 模板 emoji 与上传的封面可以共存，一起参与轮播
    const base = all;
    const valid = base.filter(c => !failedUris.includes(c));
    const n = valid.length;
    // 数据变化（编辑保存后 covers 变了）时重置失败记录，重新尝试加载
    useEffect(() => { setFailedUris([]); setIdx(0); }, [all.join('|')]);
    useEffect(() => {
        if (n < 2) { setIdx(0); slideAnim.setValue(0); return; }
        const t = setInterval(() => {
            setIdx(i => (i + 1) % n);
            slideAnim.setValue(1);
            requestAnimationFrame(() => Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start());
        }, 5000);
        return () => clearInterval(t);
    }, [n]);
    if (n === 0) return <View style={{ height: 100, width: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: bg || '#ffffff' }}><Text style={{ fontSize: 40 }}>{'\uD83D\uDCE6'}</Text></View>;
    const current = valid[idx % n];
    const translateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, boxW] });
    return (
        <View style={{ height: 100, width: '100%', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: bg || '#ffffff' }} onLayout={e => setBoxW(e.nativeEvent.layout.width)}>
            <Animated.View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', transform: [{ translateX }] }}>
                {current && isUri(current) ? (
                    <Image source={{ uri: current }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => { onError && onError(current); setFailedUris(prev => prev.includes(current) ? prev : [...prev, current]); }} />
                ) : (
                    <Text style={{ fontSize: 40 }}>{current || '\uD83D\uDCE6'}</Text>
                )}
            </Animated.View>
            {n > 1 && (
                // 白点最多 5 个；点亮位规则：开头两张在第1/2位、结尾两张在第4/5位、中间统一第3位居中
                <View style={{ position: 'absolute', bottom: 6, left: 0, right: 0, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                    {(() => {
                        const dotCount = Math.min(n, 5);
                        const active = n <= 5 ? idx : (idx <= 1 ? idx : (idx >= n - 2 ? 5 - (n - idx) : 2));
                        return Array.from({ length: dotCount }).map((_, i) => (
                            <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: i === active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)' }} />
                        ));
                    })()}
                </View>
            )}
        </View>
    );
}

// 数量写法：支持 2 / 2.5 / 一 / 十二 / 二十五
function parseQtyText(s) {
    const t = String(s || '').trim();
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    const d = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (t === '十') return 10;
    if (t.length === 1) return d[t] || NaN;
    if (t.length === 2) {
        if (t[0] === '十') return 10 + (d[t[1]] || 0);
        if (t[1] === '十') return (d[t[0]] || 0) * 10;
    }
    if (t.length === 3 && t[1] === '十') return (d[t[0]] || 0) * 10 + (d[t[2]] || 0);
    return NaN;
}

export default function HomeScreen({ navigation }) {
    const { inventory, calendarData, updateStock, updateStockBatch, deleteItem, getItemStatus, themeBg, themeColors: tc, addLogEntry, customOptions, nickname } = useContext(AppContext);
    const [category, setCategory] = useState('全部');
    const [showAllCats, setShowAllCats] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [tempStock, setTempStock] = useState(0);
    const [quickConsumeVisible, setQuickConsumeVisible] = useState(false);
    const [quickConsumeItem, setQuickConsumeItem] = useState(null);
    const [quickConsumeQty, setQuickConsumeQty] = useState(1);
    const [searchText, setSearchText] = useState('');
    // 筛选区收起/展开：三行筛选放进列表头部，随手指滚动整体推上去/拉下来，天然平滑；
    // 按钮的行为取决于“筛选栏此刻看不看得见”：
    //   看得见（在顶部且没手动收起）→ 点一下收起；
    //   看不见（已随列表滚走，或已手动收起）→ 点一下展开并平滑滚回顶部，一次点击就能看到三行
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    const [filtersOnTop, setFiltersOnTop] = useState(true);
    const filtersCollapsedRef = useRef(false);
    const filtersOnTopRef = useRef(true);
    const lastScrollYRef = useRef(0);
    const listRef = useRef(null);
    const expandFilters = () => {
        filtersCollapsedRef.current = false;
        setFiltersCollapsed(false);
        if (listRef.current) listRef.current.scrollToOffset({ offset: 0, animated: true });
    };
    const toggleFilters = () => {
        if (filtersCollapsedRef.current || !filtersOnTopRef.current) expandFilters();
        else { filtersCollapsedRef.current = true; setFiltersCollapsed(true); }
    };
    const onListScroll = (e) => {
        const y = e.nativeEvent.contentOffset.y;
        lastScrollYRef.current = y;
        const onTop = y <= 12;
        if (onTop !== filtersOnTopRef.current) { filtersOnTopRef.current = onTop; setFiltersOnTop(onTop); }
        // 手动收起后往回拉到顶，自动恢复展开
        if (y <= 2 && filtersCollapsedRef.current) expandFilters();
    };
    const [catModalVisible, setCatModalVisible] = useState(false);
    const [quickStockVisible, setQuickStockVisible] = useState(false);
    const [quickStockText, setQuickStockText] = useState('');
    const [quickStockMsg, setQuickStockMsg] = useState('');
    const [previewCover, setPreviewCover] = useState(null);

    const [statusFilter, setStatusFilter] = useState(null);

    const filteredInventory = useMemo(() => {
        let result = category === '全部' ? inventory : inventory.filter(i => i.category === category);
        if (statusFilter) result = result.filter(i => getItemStatus(i) === statusFilter);
        if (searchText.trim()) {
            result = result.filter(i => i.name && i.name.toLowerCase().includes(searchText.toLowerCase()));
        }
        // 排序：已过期 / 已用完沉底，其余按添加时间倒序（id 为创建时的毫秒时间戳）
        const isBottom = (s) => (s === 'expired' || s === 'empty') ? 1 : 0;
        return [...result].sort((a, b) => {
            const ra = isBottom(getItemStatus(a));
            const rb = isBottom(getItemStatus(b));
            if (ra !== rb) return ra - rb;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
    }, [inventory, category, statusFilter, searchText]);

    // 修复：动态获取分类，去重并排序
    const categoryList = useMemo(() => {
        const custom = customOptions.categories || [];
        return ['全部', '药品', ...custom];
    }, [customOptions]);

    // 首页固定只展示排序前4个分类，其余通过“查看更多”弹窗选择
    const visibleCats = categoryList.slice(0, 4);

    // 提示计数：快用完/已用完计入补货，临期/已过期计入临期
    const warnCount = inventory.filter(i => ['warn', 'empty'].includes(getItemStatus(i))).length;
    const dangerCount = inventory.filter(i => ['danger', 'expired'].includes(getItemStatus(i))).length;

    const openDetail = (item) => { const latest = inventory.find(i => i.id === item.id) || item; setSelectedItem(latest); setTempStock(latest.stock || 0); setDetailVisible(true); };
    // 「查看更多」：跳到该物品/药品最近一次有记录的日期（无记录时回到今天）
    const openLatestRecord = () => {
        const name = selectedItem?.name;
        let latestDate = null;
        Object.keys(calendarData || {}).forEach(d => {
            const recs = calendarData[d] || [];
            if (recs.some(r => r && r.item === name)) {
                if (!latestDate || d > latestDate) latestDate = d;
            }
        });
        setDetailVisible(false);
        // filterCategory 用 all：物品的库存记录与药品打卡记录都能显示出来
        navigation.navigate('日历', { filterItem: name, filterCategory: 'all', date: latestDate || new Date().toISOString().split('T')[0] });
    };
    const handleConfirm = () => { if (selectedItem) { const delta = tempStock - selectedItem.stock; if (delta !== 0) updateStock(selectedItem.id, delta, selectedItem.name, selectedItem.unit); setDetailVisible(false); } };
    const openQuickConsume = (item) => { const latest = inventory.find(i => i.id === item.id) || item; setQuickConsumeItem(latest); setQuickConsumeQty(1); setQuickConsumeVisible(true); };
    const handleQuickConsumeConfirm = () => { if (quickConsumeItem) { updateStock(quickConsumeItem.id, -quickConsumeQty, quickConsumeItem.name, quickConsumeItem.unit); setQuickConsumeVisible(false); } };

    // 悬浮「文字记库存」球：可上下拖动，松手按所在侧自动吸附到左右边缘
    const ballWin = Dimensions.get('window');
    const BALL_SIZE = 38;
    const BALL_EDGE = 10;
    const ballStartY = Math.round(ballWin.height * 0.55);
    const ballPos = useRef(new Animated.ValueXY({ x: ballWin.width - BALL_SIZE - BALL_EDGE, y: ballStartY })).current;
    const ballBase = useRef({ x: ballWin.width - BALL_SIZE - BALL_EDGE, y: ballStartY });
    const ballMoved = useRef(false);
    const ballPan = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { ballMoved.current = false; },
        onPanResponderMove: (_, g) => {
            const nx = Math.min(Math.max(0, ballBase.current.x + g.dx), ballWin.width - BALL_SIZE);
            const ny = Math.min(Math.max(70, ballBase.current.y + g.dy), ballWin.height - 190);
            ballPos.setValue({ x: nx, y: ny });
            if (Math.abs(g.dx) + Math.abs(g.dy) > 8) ballMoved.current = true;
        },
        onPanResponderRelease: (_, g) => {
            const nx = Math.min(Math.max(0, ballBase.current.x + g.dx), ballWin.width - BALL_SIZE);
            const ny = Math.min(Math.max(70, ballBase.current.y + g.dy), ballWin.height - 190);
            ballBase.current = { x: nx, y: ny };
            if (!ballMoved.current) { setQuickStockMsg(''); setQuickStockVisible(true); return; }
            const snapX = nx + BALL_SIZE / 2 < ballWin.width / 2 ? BALL_EDGE : ballWin.width - BALL_SIZE - BALL_EDGE;
            ballBase.current.x = snapX;
            Animated.spring(ballPos, { toValue: { x: snapX, y: ny }, useNativeDriver: false, friction: 7 }).start();
        },
    })).current;

    // 解析「土豆减2 / 玉米+1 / 土豆加一」，多条用逗号、顿号或换行分隔
    const [quickPending, setQuickPending] = useState(null); // { pending:[{nameRaw,isAdd,qty,candidates}], ready:[changes], failed:[] }

    const commitQuick = (ready, failed) => {
        if (ready.length > 0) updateStockBatch(ready);
        if (failed.length > 0) setQuickStockMsg('未处理：' + failed.join('；'));
        else { setQuickStockText(''); setQuickStockMsg(''); setQuickStockVisible(false); }
        setQuickPending(null);
    };

    const handleQuickStockConfirm = () => {
        const raw = (quickStockText || '').trim();
        if (!raw) { setQuickStockMsg('请输入内容，例如「土豆减2」'); return; }
        const parts = raw.split(/[\n，,、；;]+/).map(s => s.trim()).filter(Boolean);
        const ready = [];
        const failed = [];
        const ambiguous = [];
        parts.forEach(part => {
            const m = part.match(/^(.+?)\s*(加|增加|补货|进货|买|增|多|\+|＋|➕|减|消耗|用|吃|喝|少|扣|-|−)\s*(\d+(?:\.\d+)?|[一二三四五六七八九十两]+)\s*[^\d]*$/);
            if (!m) { failed.push(part + '（没看懂）'); return; }
            const nameRaw = m[1].trim();
            const op = m[2];
            const qty = parseQtyText(m[3]);
            if (!qty || qty <= 0 || isNaN(qty)) { failed.push(part + '（数量无效）'); return; }
            const isAdd = ['加', '增加', '补货', '进货', '买', '增', '多', '+', '＋', '➕'].includes(op);
            const exact = inventory.filter(i => i.name === nameRaw);
            const candidates = exact.length > 0
                ? exact
                : inventory.filter(i => i.name && (i.name.includes(nameRaw) || nameRaw.includes(i.name)));
            if (candidates.length === 0) { failed.push(nameRaw + '（未找到该物品）'); return; }
            if (candidates.length > 1) { ambiguous.push({ part, nameRaw, isAdd, qty, candidates }); return; }
            ready.push({ itemId: candidates[0].id, amount: isAdd ? qty : -qty, itemName: candidates[0].name, unit: candidates[0].unit });
        });
        if (ambiguous.length > 0) {
            setQuickStockMsg('');
            setQuickPending({ pending: ambiguous, ready, failed });
            return;
        }
        commitQuick(ready, failed);
    };

    // 名称匹配到多个物品时，由用户点选具体是哪一个
    const handleQuickPick = (item) => {
        if (!quickPending || !quickPending.pending.length) return;
        const [first, ...rest] = quickPending.pending;
        const nextReady = [...quickPending.ready, { itemId: item.id, amount: first.isAdd ? first.qty : -first.qty, itemName: item.name, unit: item.unit }];
        if (rest.length === 0) commitQuick(nextReady, quickPending.failed);
        else setQuickPending({ pending: rest, ready: nextReady, failed: quickPending.failed });
    };

    const closeQuickStock = () => {
        setQuickStockVisible(false);
        setQuickPending(null);
        setQuickStockMsg('');
    };

    const itemRecords = useMemo(() => {
        if (!selectedItem) return [];
        let records = [];
        // 遍历时带上日期 key：记录 time 只有时分秒，跨天排序必须结合日期（否则昨天的 15:40 会排到今天 08:43 前面）
        Object.entries(calendarData).forEach(([date, dayRecords]) => {
            dayRecords.forEach(r => {
                if (r.item === selectedItem.name && (r.category === 'inventory' || r.category === 'medicine')) {
                    records.push({ ...r, sortKey: `${date} ${r.time || ''}` });
                }
            });
        });
        // 展示最新三条，无时间限制
        return records.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, 3);
    }, [calendarData, selectedItem]);

    const renderItem = ({ item }) => {
        try {
            const status = getItemStatus(item);
            const covers = (item.covers && Array.isArray(item.covers) && item.covers.length > 0) ? item.covers : [item.cover || '\uD83D\uDCE6'];
            const itemName = item.name ? String(item.name) : '未命名物品';
            const itemStock = typeof item.stock === 'number' ? item.stock : (parseFloat(item.stock) || 0);
            const itemUnit = item.unit ? String(item.unit) : '件';

            return (
                <View style={[styles.card, { borderColor: tc.border }, status === 'warn' && styles.cardWarn, status === 'danger' && styles.cardDanger, status === 'empty' && styles.cardEmpty, status === 'expired' && styles.cardExpired, { backgroundColor: status === 'warn' ? tc.warnBg : status === 'danger' ? tc.dangerBg : status === 'empty' ? tc.emptyBg : status === 'expired' ? tc.dangerBg : tc.homeCardBg }]}>
                    <TouchableOpacity style={styles.itemImage} onPress={() => openDetail(item)}>
                        <CoverCarousel covers={covers} bg={tc.coverBg} onError={(c) => addLogEntry('ImageError', `图片加载失败: ${c}`)} />
                    </TouchableOpacity>
                    <Text style={[styles.itemTitle, { color: tc.textMain }]}>{itemName}</Text>
                    <View style={styles.itemSub}>
                        <View style={styles.stockInfo}>
                            <View style={[styles.statusDot, { backgroundColor: status === 'ok' ? COLORS.primaryGreen : (status === 'warn' ? COLORS.orange : (status === 'danger' ? COLORS.pink : (status === 'empty' ? '#9e9e9e' : '#c0392b'))) }]} />
                            <Text style={[styles.itemStock, { color: tc.textSub }]}>剩 {itemStock} {itemUnit}</Text>
                        </View>
                        <TouchableOpacity style={[styles.quickConsumeBtn, { backgroundColor: tc.accent }]} onPress={() => openQuickConsume(item)}>
                            <Text style={[styles.quickConsumeBtnText, { color: tc.accentText }]}>记一下</Text>
                        </TouchableOpacity>
                    </View>
                    {item.purpose && <Text style={{ fontSize: 11, color: tc.textSub, marginTop: 2, marginBottom: 2 }}>{item.purpose}</Text>}
                    {status === 'warn' && <View style={styles.badge}><Text style={styles.badgeText}>快用完了</Text></View>}
                    {status === 'danger' && <View style={[styles.badge, { backgroundColor: COLORS.pink }]}><Text style={styles.badgeText}>临期</Text></View>}
                    {status === 'empty' && <View style={[styles.badge, { backgroundColor: '#9e9e9e' }]}><Text style={styles.badgeText}>已用完</Text></View>}
                    {status === 'expired' && <View style={[styles.badge, { backgroundColor: '#c0392b' }]}><Text style={styles.badgeText}>已过期</Text></View>}
                </View>
            );
        } catch (e) {
            addLogEntry('RenderError', `渲染物品卡片失败: ${item.id}, 错误: ${e.message}`);
            return (
                <View style={[styles.card, { justifyContent: 'center', alignItems: 'center', height: 140 }]}>
                    <Text style={{ color: COLORS.pink, fontWeight: 'bold' }}>数据异常</Text>
                    <Text style={{ color: COLORS.textSub, fontSize: 10 }}>{item.name || '未知'}</Text>
                </View>
            );
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: tc.bg }]}>
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: tc.textMain, marginBottom: 0 }]} numberOfLines={1}>下午好{nickname ? '，' + nickname : ''}</Text>
                    <Text style={[styles.headerSub, { color: tc.textMain }]}>家里有 {inventory.length} 件物品</Text>
                </View>
                <TouchableOpacity style={[styles.filterToggle, { backgroundColor: tc.chipBg, borderColor: tc.border }]} onPress={toggleFilters}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 12, color: tc.textSub, includeFontPadding: false }}>筛选</Text>
                        {/* 用 View 画三角取代 ⌃/⌄ 字符：字符本身基线偏移，跟文字对不齐 */}
                        {(filtersCollapsed || !filtersOnTop) ? (
                            <View style={{ width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: tc.textSub }} />
                        ) : (
                            <View style={{ width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: tc.textSub }} />
                        )}
                    </View>
                </TouchableOpacity>
            </View>
            {warnCount + dangerCount > 0 && (
                <View style={[styles.alertBanner, { backgroundColor: tc.warnBg }]}><Text style={styles.alertText}>{'\u26A0\uFE0F'} 有 {warnCount + dangerCount} 件物品需要补货或临期</Text></View>
            )}
            <FlatList
                ref={listRef}
                data={filteredInventory}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={{ paddingBottom: 100 }}
                onScroll={onListScroll}
                scrollEventThrottle={16}
                ListHeaderComponent={filtersCollapsed ? null : (
                    <View>
                        <View style={styles.categoryRow}>
                            {visibleCats.map(cat => (
                                <TouchableOpacity key={cat} onPress={() => setCategory(cat)} style={[styles.catChip, { flex: 1, paddingHorizontal: 8, alignItems: 'center', backgroundColor: tc.chipBg, borderColor: tc.border }, category === cat && { backgroundColor: tc.accent, borderColor: tc.accent }]}>
                                    <Text numberOfLines={1} style={[styles.catText, { color: tc.textSub }, category === cat && { color: tc.accentText, fontWeight: '600' }]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                            {categoryList.length > 4 && (
                                <TouchableOpacity style={[styles.catChip, { flex: 1, paddingHorizontal: 8, alignItems: 'center', backgroundColor: tc.chipBg, borderColor: tc.border }]} onPress={() => setCatModalVisible(true)}>
                                    <Text numberOfLines={1} style={[styles.catText, { color: tc.textSub }]}>更多...</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow} contentContainerStyle={styles.statusRowContent}>
                            {[['expired', '已过期'], ['danger', '临期'], ['empty', '已用完'], ['warn', '快用完了']].map(([key, label]) => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => setStatusFilter(statusFilter === key ? null : key)}
                                    style={[styles.statusChip, { backgroundColor: statusFilter === key ? tc.accent : tc.chipBg, borderColor: statusFilter === key ? tc.accent : tc.border }]}
                                >
                                    <Text numberOfLines={1} style={[styles.statusChipText, { color: statusFilter === key ? tc.accentText : tc.textSub }]}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <View style={styles.searchRow}>
                            <TextInput
                                style={[styles.searchInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]}
                                placeholder="搜索名称..."
                                placeholderTextColor={tc.textLight}
                                value={searchText}
                                onChangeText={setSearchText}
                            />
                        </View>
                        {category !== '全部' && !visibleCats.includes(category) && (
                            <View style={[styles.filterBanner, { backgroundColor: tc.okBg }]}>
                                <Text style={styles.filterBannerText}>{'当前筛选：' + category}</Text>
                                <TouchableOpacity onPress={() => setCategory('全部')}><Text style={styles.clearFilterText}>清除</Text></TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={<View style={styles.emptyView}><Text style={[styles.emptyText, { color: tc.textSub }]}>{(category !== '全部' || statusFilter || searchText.trim()) ? '没有符合筛选条件的物品' : '暂无物品，点击底部 + 添加'}</Text></View>}
            />

            <Modal visible={detailVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setDetailVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailVisible(false)}>
                    <View style={[styles.modalContent, { backgroundColor: tc.modalBg }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <View><Text style={[styles.modalTitle, { color: tc.textMain }]}>{selectedItem?.name}</Text><Text style={[styles.modalSub, { color: tc.textSub }]}>{(() => { const cat = (selectedItem?.category || '').replace('未指定', '').trim(); const loc = ((selectedItem?.locations || selectedItem?.location || '')).replace('未指定', '').trim(); return cat + (loc ? ` · ${loc}` : ''); })()}</Text></View>
                            <TouchableOpacity onPress={() => setDetailVisible(false)}><Text style={{ fontSize: 20, color: tc.textSub }}>✕</Text></TouchableOpacity>
                        </View>
                        {(() => {
                            const covers = ((selectedItem?.covers && selectedItem.covers.length > 0) ? selectedItem.covers : [selectedItem?.cover || '📦']).filter(Boolean);
                            if (covers.length === 0) return null;
                            const isUri = (c) => typeof c === 'string' && (c.startsWith('file') || c.startsWith('content') || c.startsWith('http') || c.startsWith('data:image'));
                            return (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} style={{ marginBottom: 12 }}>
                                    {covers.map((c, i) => (
                                        <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setPreviewCover(c)}>
                                            {isUri(c)
                                                ? <Image source={{ uri: c }} style={[styles.detailCover, { borderColor: tc.border, backgroundColor: tc.cardSubBg }]} resizeMode="cover" />
                                                : <View style={[styles.detailCover, { borderColor: tc.border, backgroundColor: tc.cardSubBg, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 30 }}>{c}</Text></View>}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            );
                        })()}
                        <View style={[styles.stockControl, { backgroundColor: tc.cardSubBg }]}>
                            <Text style={[styles.stockText, { color: tc.textMain }]}>剩 {(tempStock || 0).toFixed(1)} {selectedItem?.unit}</Text>
                            <View style={styles.stockInputWrap}>
                                <TextInput
                                    style={[styles.stockValueInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]}
                                    keyboardType="decimal-pad"
                                    value={isNaN(parseFloat(tempStock)) ? '' : String(tempStock)}
                                    onChangeText={(text) => {
                                        if (text === '') { setTempStock(0); return; }
                                        const num = parseFloat(text);
                                        if (!isNaN(num) && num >= 0) setTempStock(num);
                                    }}
                                />
                            </View>
                            <View style={styles.btnGroup}>
                                <TouchableOpacity style={[styles.glassBtn, { backgroundColor: tc.inputBg }]} onPress={() => setTempStock(prev => Math.max(0, prev - 0.5))}><Text style={{ color: tc.textMain }}>-0.5</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.glassBtn, { backgroundColor: tc.inputBg }]} onPress={() => setTempStock(prev => Math.max(0, prev - 1))}><Text style={{ color: tc.textMain }}>-1</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.glassBtn, { backgroundColor: tc.inputBg }]} onPress={() => setTempStock(prev => prev + 1)}><Text style={{ color: tc.textMain }}>+1</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.glassBtn, { backgroundColor: tc.inputBg }]} onPress={() => setTempStock(prev => prev + 0.5)}><Text style={{ color: tc.textMain }}>+0.5</Text></TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ marginTop: 12 }}>
                            <Text style={[styles.recordTitle, { color: tc.textMain }]}>操作记录</Text>
                            <ScrollView keyboardShouldPersistTaps="handled" style={styles.recordBox} scrollEnabled={false}>
                                {itemRecords.length === 0 ? <Text style={[styles.emptyText, { color: tc.textSub }]}>暂无记录</Text> : itemRecords.map((r, i) => (
                                    <View key={i} style={styles.recordItem}><View style={[styles.recordDot, { backgroundColor: COLORS.primaryGreen }]} /><View style={{ flex: 1 }}><Text style={[styles.recordTime, { color: tc.textSub }]}>{r.time}</Text><Text style={[styles.recordText, { color: tc.textMain }]}>{r.text}</Text><Text style={[styles.recordSub, { color: tc.textSub }]}>{r.sub}</Text></View></View>
                                ))}
                            </ScrollView>
                            <TouchableOpacity style={styles.viewMoreBtn} onPress={openLatestRecord}><Text style={styles.viewMoreText}>查看更多</Text></TouchableOpacity>
                        </View>
                        <View style={styles.footer}>
                            <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: tc.dangerBg }]} onPress={() => { deleteItem(selectedItem.id); setDetailVisible(false); }}><Text style={styles.deleteBtnText}>删除</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.editBtn} onPress={() => { setEditItem(selectedItem); setDetailVisible(false); setModalVisible(true); }}><Text style={styles.editBtnText}>编辑</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}><Text style={styles.confirmBtnText}>确认</Text></TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
            <Modal visible={!!previewCover} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPreviewCover(null)}>
                <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewCover(null)}>
                    {previewCover && /^(file|content|http|data:image)/.test(previewCover)
                        ? <Image source={{ uri: previewCover }} style={styles.previewImage} resizeMode="contain" />
                        : <Text style={{ fontSize: 120 }}>{previewCover}</Text>}
                </TouchableOpacity>
            </Modal>
            <Modal visible={quickConsumeVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setQuickConsumeVisible(false)}>
                <TouchableOpacity style={styles.centerOverlay} activeOpacity={1} onPress={() => setQuickConsumeVisible(false)}>
                    <View style={[styles.quickConsumeModal, { backgroundColor: tc.modalBg }]} onStartShouldSetResponder={() => true}>
                        <Text style={[styles.modalTitle, { color: tc.textMain }]}>消耗 {quickConsumeItem?.name}</Text>
                        <View style={[styles.stockControl, { marginTop: 16, backgroundColor: tc.cardSubBg }]}>
                            <View style={{ alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: tc.textMain, marginBottom: 6 }}>消耗数量</Text>
                                <TextInput
                                    style={[styles.consumeNumberInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]}
                                    value={String(quickConsumeQty)}
                                    onChangeText={(text) => {
                                        const num = parseFloat(text);
                                        if (!isNaN(num) && num >= 0) setQuickConsumeQty(num);
                                        else if (text === '') setQuickConsumeQty(0);
                                    }}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                            <View style={styles.btnGroup}>
                                <TouchableOpacity style={[styles.glassBtn, { backgroundColor: tc.inputBg }]} onPress={() => setQuickConsumeQty(prev => prev + 0.5)}><Text style={{ color: tc.textMain }}>+0.5</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.glassBtn, { backgroundColor: tc.inputBg }]} onPress={() => setQuickConsumeQty(prev => prev + 1)}><Text style={{ color: tc.textMain }}>+1</Text></TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => setQuickConsumeVisible(false)}><Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.accent }]} onPress={handleQuickConsumeConfirm}><Text style={{ color: tc.accentText, fontWeight: '600' }}>确认消耗</Text></TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
            <Modal visible={catModalVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setCatModalVisible(false)}>
                <TouchableOpacity style={styles.centerOverlay} activeOpacity={1} onPress={() => setCatModalVisible(false)}>
                    <View style={[styles.catModal, { backgroundColor: tc.modalBg }]} onStartShouldSetResponder={() => true}>
                        <Text style={[styles.catModalTitle, { color: tc.textMain }]}>全部分类</Text>
                        <ScrollView keyboardShouldPersistTaps="handled" style={styles.catModalScroll} contentContainerStyle={styles.catModalGrid}>
                            {categoryList.map(cat => (
                                <TouchableOpacity key={cat} onPress={() => { setCategory(cat); setCatModalVisible(false); }} style={[styles.catChip, { width: '31.5%', paddingHorizontal: 14, alignItems: 'center', backgroundColor: tc.chipBg, borderColor: tc.border }, category === cat && styles.catChipActive]}>
                                    <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.catText, { color: tc.textSub, textAlign: 'center' }, category === cat && styles.catTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setCatModalVisible(false)} style={styles.catModalClose}><Text style={styles.catModalCloseText}>关闭</Text></TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            <Animated.View style={[styles.quickStockBall, { backgroundColor: tc.accent }, { transform: [{ translateX: ballPos.x }, { translateY: ballPos.y }] }]} {...ballPan.panHandlers}>
                <Text style={{ fontSize: 15, color: '#fff' }}>{'\uD83D\uDCAC'}</Text>
            </Animated.View>
            <Modal visible={quickStockVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={closeQuickStock}>
                <TouchableOpacity style={styles.centerOverlay} activeOpacity={1} onPress={closeQuickStock}>
                    <View style={[styles.quickConsumeModal, { backgroundColor: tc.modalBg }]} onStartShouldSetResponder={() => true}>
                        <Text style={[styles.modalTitle, { color: tc.textMain }]}>文字记库存</Text>
                        <Text style={[styles.quickStockHint, { color: tc.textSub }]}>例如：土豆减2、玉米加1；多条用逗号或换行分隔</Text>
                        <TextInput
                            style={[styles.quickStockInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]}
                            placeholder="土豆减2"
                            placeholderTextColor={tc.textSub}
                            value={quickStockText}
                            onChangeText={(t) => { setQuickStockText(t); if (quickPending) setQuickPending(null); }}
                            autoFocus
                            multiline
                        />
                        {quickPending ? (
                            <View style={{ marginTop: 10 }}>
                                <Text style={{ color: tc.textMain, fontSize: 13, marginBottom: 6 }}>
                                    {'「' + quickPending.pending[0].nameRaw + '」匹配到多个物品，请选择：'}
                                </Text>
                                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 200 }}>
                                    {quickPending.pending[0].candidates.map(c => (
                                        <TouchableOpacity key={c.id} style={[styles.quickPickRow, { backgroundColor: tc.cardSubBg, borderColor: tc.border }]} onPress={() => handleQuickPick(c)}>
                                            <Text style={{ color: tc.textMain, fontSize: 14, flex: 1 }} numberOfLines={1}>{c.name}</Text>
                                            <Text style={{ color: tc.textSub, fontSize: 12 }}>剩 {c.stock} {c.unit}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        ) : null}
                        {quickStockMsg ? <Text style={{ color: COLORS.orange, fontSize: 12, marginTop: 8 }}>{quickStockMsg}</Text> : null}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.cardSubBg }]} onPress={closeQuickStock}><Text style={{ color: tc.labelText, fontWeight: '600' }}>取消</Text></TouchableOpacity>
                            {!quickPending && (
                                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.accent }]} onPress={handleQuickStockConfirm}><Text style={{ color: tc.accentText, fontWeight: '600' }}>记录</Text></TouchableOpacity>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
            <AddItemModal visible={modalVisible} onClose={() => { setModalVisible(false); setEditItem(null); }} editItem={editItem} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: SIZES.padding, marginBottom: 12 },
    headerSub: { fontSize: 24, fontWeight: '600', color: COLORS.textMain, paddingHorizontal: SIZES.padding, marginTop: 2 },
    filterToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: '600', color: COLORS.textMain, paddingHorizontal: SIZES.padding, marginBottom: 15 },
    alertBanner: { backgroundColor: COLORS.lightOrange, marginHorizontal: SIZES.padding, padding: 12, borderRadius: 12, marginBottom: 15 },
    alertText: { color: COLORS.orange, fontSize: 13, fontWeight: '600' },
    categoryRow: { flexDirection: 'row', paddingHorizontal: SIZES.padding, marginBottom: 5, flexWrap: 'wrap', gap: 8 },
    statusRow: { height: 34, flexGrow: 0, flexShrink: 0, marginBottom: 5 },
    statusRowContent: { paddingHorizontal: SIZES.padding, gap: 8, alignItems: 'center' },
    statusChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    statusChipText: { fontSize: 13 },
    searchRow: { flexDirection: 'row', paddingHorizontal: SIZES.padding, marginBottom: 20 },
    catChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
    catChipActive: { backgroundColor: COLORS.primaryGreen, borderColor: COLORS.primaryGreen },
    filterBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.lightGreen, marginHorizontal: SIZES.padding, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginBottom: 10 },
    filterBannerText: { fontSize: 13, color: COLORS.primaryGreen, fontWeight: '600' },
    clearFilterText: { fontSize: 12, color: COLORS.textSub, textDecorationLine: 'underline' },
    catText: { fontSize: 13, color: COLORS.textSub },
    catTextActive: { color: '#fff', fontWeight: '600' },
    row: { justifyContent: 'space-between', paddingHorizontal: SIZES.padding },
    card: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: SIZES.radius, padding: 12, marginBottom: 16, ...SHADOWS.card, overflow: 'hidden', borderWidth: 1, borderColor: '#e8e8e8' },
    cardWarn: { borderColor: COLORS.orange, borderWidth: 1, backgroundColor: '#fffaf5' },
    cardDanger: { borderColor: COLORS.pink, borderWidth: 1, backgroundColor: '#fff7f7' },
    cardEmpty: { borderColor: '#bdbdbd', borderWidth: 1, backgroundColor: '#fafafa' },
    cardExpired: { borderColor: '#c0392b', borderWidth: 1, backgroundColor: '#fdf3f3' },
    itemImage: { height: 100, width: '100%', marginBottom: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: 'transparent' },
    itemTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginBottom: 6 },
    itemSub: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    stockInfo: { flexDirection: 'row', alignItems: 'center' },
    itemStock: { fontSize: 12, color: COLORS.textSub },
    quickConsumeBtn: { backgroundColor: COLORS.primaryGreen, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    quickConsumeBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    badge: { position: 'absolute', top: 16, right: 16, backgroundColor: COLORS.orange, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    emptyText: { color: COLORS.textSub, fontSize: 14, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
    centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.padding, minHeight: 400, maxHeight: SIZES.screenHeight * 0.85 },
    quickConsumeModal: { backgroundColor: COLORS.bg, borderRadius: 16, marginHorizontal: 20, padding: SIZES.padding * 0.8, width: '75%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain },
    modalSub: { fontSize: 12, color: COLORS.textSub, marginTop: 4 },
    stockControl: { backgroundColor: '#fff', padding: 16, borderRadius: SIZES.radius, ...SHADOWS.card },
    stockText: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginBottom: 8 },
    stockInputWrap: { alignItems: 'center', marginBottom: 12 },
    stockValueInput: { width: 120, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, backgroundColor: COLORS.bg, paddingVertical: 6, paddingHorizontal: 8, fontSize: 15, fontWeight: '600', color: COLORS.primaryGreen, textAlign: 'center' },
    btnGroup: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    glassBtn: { flex: 1, padding: 6, backgroundColor: COLORS.bg, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    recordTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textMain, marginBottom: 6 },
    recordBox: { maxHeight: 190 },
    recordItem: { flexDirection: 'row', marginBottom: 10 },
    recordDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 10 },
    recordTime: { fontSize: 12, color: COLORS.textSub, marginBottom: 2 },
    recordText: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
    recordSub: { fontSize: 12, color: COLORS.textSub },
    viewMoreBtn: { alignItems: 'center', paddingVertical: 8 },
    viewMoreText: { fontSize: 13, color: COLORS.primaryGreen, fontWeight: '600' },
    footer: { flexDirection: 'row', gap: 8, marginTop: 10 },
    deleteBtn: { flex: 0.6, padding: 14, borderRadius: 14, backgroundColor: COLORS.lightPink, alignItems: 'center' },
    deleteBtnText: { color: COLORS.pink, fontSize: 15, fontWeight: '600' },
    editBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.orange, alignItems: 'center' },
    editBtnText: { color: COLORS.orange, fontSize: 15, fontWeight: '600' },
    confirmBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.primaryGreen, alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    saveBtn: { flex: 1, padding: 10, borderRadius: 14, alignItems: 'center' },
    searchInput: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fff', fontSize: 13, color: COLORS.textMain, flex: 1 },
    consumeNumberInput: { fontSize: 14, fontWeight: '600', color: COLORS.primaryGreen, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2, width: 32, textAlign: 'center' },
    catModal: { backgroundColor: COLORS.bg, borderRadius: 16, marginHorizontal: 12, padding: SIZES.padding, width: '90%', maxHeight: '60%' },
    catModalTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textMain, textAlign: 'center', marginBottom: 14 },
    catModalScroll: { flexShrink: 1, maxHeight: 320 },
    catModalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', paddingBottom: 4 },
    catModalClose: { marginTop: 14, alignItems: 'center' },
    catModalCloseText: { color: COLORS.primaryGreen, fontSize: 14, fontWeight: '600' },
    quickStockBall: { position: 'absolute', left: 0, top: 0, width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', zIndex: 999, elevation: 8, ...SHADOWS.card },
    quickStockHint: { fontSize: 12, marginTop: 6, marginBottom: 8 },
    quickPickRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
    quickStockInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 52 },
    detailCover: { width: 60, height: 60, borderRadius: 12, borderWidth: 1 },
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
    previewImage: { width: '100%', height: '80%' },
});
