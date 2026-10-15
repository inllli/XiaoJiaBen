import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';

export default function AddItemModal({ visible, onClose, editItem, editHabit }) {
    const { addItem, editItem: updateItem, addHabit, editHabit: updateHabit, deleteHabit, customOptions, addCustomOption } = useContext(AppContext);

    const [isEditMode, setIsEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState('item');

    const [itemForm, setItemForm] = useState({ name: '', stock: '1.0', unit: '盒', category: '食品', location: '冰箱', threshold: '2', expireDays: '5', noExpire: true, expireDate: '' });
    const [medForm, setMedForm] = useState({ name: '', dose: '1', freq: '', time: '08:30', stock: '30', remark: '', noExpire: true, expireDate: '', cover: '💊', enableCheckIn: false });
    const [habitForm, setHabitForm] = useState({ name: '', quickCheckIn: false, tags: '', icon: '⭐', frequency: '', startDate: '', endDate: '' });

    const [showCustomCategory, setShowCustomCategory] = useState(false);
    const [customCategory, setCustomCategory] = useState('');
    const [showCustomUnit, setShowCustomUnit] = useState(false);
    const [customUnit, setCustomUnit] = useState('');
    const [showCustomLocation, setShowCustomLocation] = useState(false);
    const [customLocation, setCustomLocation] = useState('');

    const [selectedCover, setSelectedCover] = useState('🥛');

    const fullItemTemplates = [
        '🥛', '🧴', '🧻', '🍚', '💊', '📦', '🧼', '🍎', '🥩', '🥬', '🍞', '🥚',
        '🧂', '🧃', '🍬', '🥤', '🧀', '🥫', '🍌', '🥕', '🍇', '🍉', '🍓', '🍒',
        '🍑', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔', '🌽', '🥦', '🥒', '🥬',
        '🧄', '🧅', '🍄', '🥜', '🌰', '🥐', '🥖', '🥨', '🍳', '🥞', '🧇', '🥓',
        '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘',
        '🍝', '🍜', '🍲', '🍛', '🍣', '🍤', '🍙', '🍘', '🍥', '🥠', '🍢', '🍡',
        '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍫', '🍿', '🍩',
        '🍪', '🍯', '🍼', '☕', '🍵', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸',
        '🍹', '🧉', '🧊', '🥄', '🍴', '🍽️', '🥢', '🧈', '🍠', '🥟'
    ];

    const habitIcons = [
        '⭐', '💧', '🏃', '📖', '🍎', '🚽', '🩸', '💊', '🧘', '🥗',
        '😴', '🦷', '🧴', '🌞', '🏋️', '🧠', '📝', '🍵', '🚶', '🧹',
        '🍳', '🚴', '🧺', '🍽️', '📱', '✍️', '🎯', '🌙', '🧊', '🥑'
    ];

    const medTemplates = ['💊', '💉', '🩹', '🧴', '🍶', '🧪', '🏥', '🩺', '🌡️', '🧬', '🩸', '💊'];
    const habitTemplates = ['喝水', '如厕', '运动', '早睡', '阅读', '冥想'];

    const [showAllItemTemplates, setShowAllItemTemplates] = useState(false);

    const [showCustomMedFreq, setShowCustomMedFreq] = useState(false);
    const [customMedFreq, setCustomMedFreq] = useState('');
    const [showCustomHabitFreq, setShowCustomHabitFreq] = useState(false);
    const [customHabitFreq, setCustomHabitFreq] = useState('');

    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    useEffect(() => {
        if (visible) {
            if (editItem) {
                setIsEditMode(true);
                if (editItem.category === '药品') {
                    setActiveTab('medicine');
                    setMedForm({
                        name: editItem.name,
                        dose: editItem.dose || '1',
                        freq: editItem.freq || '',
                        time: editItem.time || '08:30',
                        stock: editItem.stock.toString(),
                        remark: editItem.remark || '',
                        noExpire: editItem.noExpire !== undefined ? editItem.noExpire : true,
                        expireDate: editItem.expireDate || '',
                        cover: editItem.cover || '💊',
                        enableCheckIn: editItem.enableCheckIn || false
                    });
                } else {
                    setActiveTab('item');
                    setItemForm({
                        name: editItem.name,
                        stock: editItem.stock.toString(),
                        unit: editItem.unit,
                        category: editItem.category,
                        location: editItem.location,
                        threshold: editItem.threshold || '2',
                        expireDays: editItem.expireDays || '5',
                        noExpire: editItem.noExpire !== undefined ? editItem.noExpire : true,
                        expireDate: editItem.expireDate || ''
                    });
                    setSelectedCover(editItem.cover || '🥛');
                }
            } else if (editHabit) {
                setIsEditMode(true);
                setActiveTab('habit');
                setHabitForm({ name: editHabit.name, quickCheckIn: editHabit.quickCheckIn, tags: editHabit.tags.join(','), icon: editHabit.icon || '⭐', frequency: editHabit.frequency || '', startDate: editHabit.startDate || '', endDate: editHabit.endDate || '' });
            } else {
                setIsEditMode(false);
                setActiveTab('item');
                setItemForm({ name: '', stock: '1.0', unit: '盒', category: '食品', location: '冰箱', threshold: '2', expireDays: '5', noExpire: true, expireDate: '' });
                setMedForm({ name: '', dose: '1', freq: '', time: '08:30', stock: '30', remark: '', noExpire: true, expireDate: '', cover: '💊', enableCheckIn: false });
                setHabitForm({ name: '', quickCheckIn: false, tags: '', icon: '⭐', frequency: '', startDate: '', endDate: '' });
                setSelectedCover('🥛');
                setShowCustomCategory(false); setCustomCategory('');
                setShowCustomUnit(false); setCustomUnit('');
                setShowCustomLocation(false); setCustomLocation('');
                setShowAllItemTemplates(false);
                setShowCustomMedFreq(false); setCustomMedFreq('');
                setShowCustomHabitFreq(false); setCustomHabitFreq('');
            }
        }
    }, [visible, editItem, editHabit]);

    const handleSave = () => {
        if (activeTab === 'item') {
            if (!itemForm.name) return alert('请输入物品名称');
            const finalUnit = showCustomUnit && customUnit ? customUnit : itemForm.unit;
            const finalLocation = showCustomLocation && customLocation ? customLocation : itemForm.location;
            const finalCategory = showCustomCategory && customCategory ? customCategory : itemForm.category;
            if (showCustomUnit && customUnit) addCustomOption('units', customUnit);
            if (showCustomLocation && customLocation) addCustomOption('locations', customLocation);
            if (showCustomCategory && customCategory) addCustomOption('categories', customCategory);
            const finalData = { ...itemForm, stock: parseFloat(itemForm.stock) || 1, unit: finalUnit, location: finalLocation, category: finalCategory, cover: selectedCover };
            if (editItem) updateItem(editItem.id, finalData);
            else addItem(finalData);
        } else if (activeTab === 'medicine') {
            if (!medForm.name) return alert('请输入药品名称');
            const finalFreq = showCustomMedFreq && customMedFreq ? customMedFreq : medForm.freq;
            const finalData = { ...medForm, freq: finalFreq, stock: parseFloat(medForm.stock) || 30, unit: '粒', category: '药品', location: '药箱', cover: medForm.cover };
            if (editItem) updateItem(editItem.id, finalData);
            else addItem(finalData);
        } else if (activeTab === 'habit') {
            if (!habitForm.name) return alert('请输入习惯名称');
            const finalFreq = showCustomHabitFreq && customHabitFreq ? customHabitFreq : habitForm.frequency;
            const finalData = { ...habitForm, frequency: finalFreq, tags: habitForm.tags.split(',').map(t => t.trim()).filter(Boolean) };
            if (editHabit) updateHabit(editHabit.id, finalData);
            else addHabit(finalData);
        }
        onClose();
    };

    const handleDeleteHabit = () => { if (editHabit) { deleteHabit(editHabit.id); onClose(); } };

    const updateStock = (delta, isMed = false) => {
        const form = isMed ? medForm : itemForm;
        const setter = isMed ? setMedForm : setItemForm;
        const current = parseFloat(form.stock) || 0;
        setter({ ...form, stock: Math.max(0, current + delta).toString() });
    };

    const pickImage = async (isMed = false) => {
        let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1 });
        if (!result.canceled) {
            if (isMed) setMedForm(prev => ({ ...prev, cover: result.assets[0].uri }));
            else setSelectedCover(result.assets[0].uri);
        }
    };

    const renderTagGroup = (options, selected, onSelect, isCustom, onCustomSelect, showCustomInput, customValue, setCustomValue) => (
        <View>
            <View style={styles.tagGroup}>
                {options.map(opt => (
                    <TouchableOpacity key={opt} style={[styles.tag, selected === opt && !isCustom && styles.tagActive]} onPress={() => onSelect(opt)}>
                        <Text style={[styles.tagText, selected === opt && !isCustom && styles.tagTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                ))}
                {onCustomSelect && (
                    <TouchableOpacity style={[styles.tag, isCustom && styles.tagActive]} onPress={onCustomSelect}>
                        <Text style={[styles.tagText, isCustom && styles.tagTextActive]}>+ 自定义</Text>
                    </TouchableOpacity>
                )}
            </View>
            {showCustomInput && (
                <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="输入自定义内容" value={customValue} onChangeText={setCustomValue} />
            )}
        </View>
    );

    const renderAllTemplatesModal = () => (
        <Modal visible={showAllItemTemplates} transparent animationType="slide" statusBarTranslucent>
            <View style={styles.fullTemplateOverlay}>
                <View style={styles.fullTemplateContent}>
                    <View style={styles.fullTemplateHeader}>
                        <Text style={styles.fullTemplateTitle}>选择物品封面</Text>
                        <TouchableOpacity onPress={() => setShowAllItemTemplates(false)}><Text style={{ fontSize: 24, color: COLORS.textSub }}>✕</Text></TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 40 }}>
                        {fullItemTemplates.map((emoji, i) => (
                            <TouchableOpacity key={i} style={[styles.fullTemplateItem, selectedCover === emoji && styles.templateItemActive]} onPress={() => { setSelectedCover(emoji); setShowAllItemTemplates(false); }}>
                                <Text style={{ fontSize: 28 }}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        {isEditMode ? (
                            <Text style={styles.modalTitle}>
                                {activeTab === 'item' ? '编辑物品' : activeTab === 'medicine' ? '编辑药品' : '编辑习惯'}
                            </Text>
                        ) : (
                            <View style={styles.tabs}>
                                <TouchableOpacity onPress={() => setActiveTab('item')}><Text style={[styles.tabText, activeTab === 'item' && styles.tabActive]}>添加物品</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setActiveTab('medicine')}><Text style={[styles.tabText, activeTab === 'medicine' && styles.tabActive]}>添加药品</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setActiveTab('habit')}><Text style={[styles.tabText, activeTab === 'habit' && styles.tabActive]}>配置习惯</Text></TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
                    </View>

                    <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 60 }}>
                        {activeTab === 'item' && (
                            <View>
                                <Text style={styles.label}>物品封面</Text>
                                <View style={styles.coverRow}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                                        {fullItemTemplates.slice(0, 12).map((emoji, i) => (
                                            <TouchableOpacity key={i} style={[styles.templateItem, selectedCover === emoji && styles.templateItemActive]} onPress={() => setSelectedCover(emoji)}>
                                                <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                                {selectedCover === emoji && <View style={styles.checkMark}><Text style={{ color: '#fff', fontSize: 10 }}>✓</Text></View>}
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                                <TouchableOpacity style={styles.viewMoreBtn} onPress={() => setShowAllItemTemplates(true)}>
                                    <Text style={styles.viewMoreText}>查看更多模板 ({fullItemTemplates.length})</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(false)}>
                                    <Text style={styles.uploadBtnText}>📷 拍摄/相册上传自定义封面</Text>
                                </TouchableOpacity>
                                {selectedCover.startsWith('file') || selectedCover.startsWith('content') ? (
                                    <View style={{ alignSelf: 'center', marginTop: 10 }}>
                                        <Image source={{ uri: selectedCover }} style={[styles.customCoverPreview, styles.templateItemActive]} resizeMode="cover" />
                                        <View style={styles.checkMark}><Text style={{ color: '#fff', fontSize: 10 }}>✓</Text></View>
                                    </View>
                                ) : null}

                                <Text style={styles.label}>物品名称</Text>
                                <TextInput style={styles.input} placeholder="例如：纯牛奶" value={itemForm.name} onChangeText={t => setItemForm({ ...itemForm, name: t })} />

                                <Text style={styles.label}>分类</Text>
                                {renderTagGroup(customOptions.categories, itemForm.category, t => setItemForm({ ...itemForm, category: t }), showCustomCategory, () => setShowCustomCategory(!showCustomCategory), showCustomCategory, customCategory, setCustomCategory)}

                                <Text style={styles.label}>库存数量</Text>
                                <View style={styles.stockControl}>
                                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(-0.5)}><Text>-0.5</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(-1)}><Text>-1</Text></TouchableOpacity>
                                    <TextInput style={styles.stockInput} keyboardType="decimal-pad" value={itemForm.stock} onChangeText={t => setItemForm({ ...itemForm, stock: t })} />
                                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(1)}><Text>+1</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(0.5)}><Text>+0.5</Text></TouchableOpacity>
                                </View>

                                <Text style={styles.label}>单位</Text>
                                {renderTagGroup(customOptions.units, showCustomUnit ? 'custom' : itemForm.unit, t => { if (t !== 'custom') { setShowCustomUnit(false); setItemForm({ ...itemForm, unit: t }); } }, showCustomUnit, () => setShowCustomUnit(!showCustomUnit), showCustomUnit, customUnit, setCustomUnit)}

                                <Text style={styles.label}>存放位置</Text>
                                {renderTagGroup(customOptions.locations, showCustomLocation ? 'custom' : itemForm.location, t => { if (t !== 'custom') { setShowCustomLocation(false); setItemForm({ ...itemForm, location: t }); } }, showCustomLocation, () => setShowCustomLocation(!showCustomLocation), showCustomLocation, customLocation, setCustomLocation)}

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                                    <View style={{ width: '48%' }}><Text style={styles.label}>低库存预警值</Text><TextInput style={styles.input} value={itemForm.threshold} keyboardType="numeric" onChangeText={t => setItemForm({ ...itemForm, threshold: t })} /></View>
                                    <View style={{ width: '48%' }}><Text style={styles.label}>临期提前提醒(天)</Text><TextInput style={styles.input} value={itemForm.expireDays} keyboardType="numeric" onChangeText={t => setItemForm({ ...itemForm, expireDays: t })} /></View>
                                </View>

                                <Text style={styles.label}>过期时间</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <TouchableOpacity style={[styles.tag, itemForm.noExpire && styles.tagActive]} onPress={() => setItemForm({ ...itemForm, noExpire: true })}><Text style={[styles.tagText, itemForm.noExpire && styles.tagTextActive]}>无期限</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.tag, !itemForm.noExpire && styles.tagActive]} onPress={() => setItemForm({ ...itemForm, noExpire: false, expireDate: new Date().toISOString().split('T')[0] })}><Text style={[styles.tagText, !itemForm.noExpire && styles.tagTextActive]}>指定日期</Text></TouchableOpacity>
                                </View>
                                {!itemForm.noExpire && <TextInput style={styles.input} placeholder="格式：2026-12-31" value={itemForm.expireDate} onChangeText={t => setItemForm({ ...itemForm, expireDate: t })} />}
                            </View>
                        )}

                        {activeTab === 'medicine' && (
                            <View>
                                <Text style={styles.label}>药品封面</Text>
                                <View style={styles.coverRow}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                                        {medTemplates.map((emoji, i) => (
                                            <TouchableOpacity key={i} style={[styles.templateItem, medForm.cover === emoji && styles.templateItemActive]} onPress={() => setMedForm({ ...medForm, cover: emoji })}>
                                                <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                                {medForm.cover === emoji && <View style={styles.checkMark}><Text style={{ color: '#fff', fontSize: 10 }}>✓</Text></View>}
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(true)}>
                                    <Text style={styles.uploadBtnText}>📷 拍摄/相册上传自定义封面</Text>
                                </TouchableOpacity>
                                {medForm.cover.startsWith('file') || medForm.cover.startsWith('content') ? (
                                    <View style={{ alignSelf: 'center', marginTop: 10 }}>
                                        <Image source={{ uri: medForm.cover }} style={[styles.customCoverPreview, styles.templateItemActive]} resizeMode="cover" />
                                        <View style={styles.checkMark}><Text style={{ color: '#fff', fontSize: 10 }}>✓</Text></View>
                                    </View>
                                ) : null}

                                <Text style={styles.label}>药品名称</Text>
                                <TextInput style={styles.input} placeholder="例如：维生素D" value={medForm.name} onChangeText={t => setMedForm({ ...medForm, name: t })} />
                                <Text style={styles.label}>每次剂量</Text>
                                <TextInput style={styles.input} placeholder="例如：1粒" value={medForm.dose} onChangeText={t => setMedForm({ ...medForm, dose: t })} />

                                <Text style={styles.label}>服用频数（非必选）</Text>
                                {renderTagGroup(['每日1次', '每日2次', '隔日', '每周几次'], showCustomMedFreq ? 'custom' : medForm.freq, t => { if (t !== 'custom') { setShowCustomMedFreq(false); setMedForm({ ...medForm, freq: t }); } }, showCustomMedFreq, () => setShowCustomMedFreq(!showCustomMedFreq), showCustomMedFreq, customMedFreq, setCustomMedFreq)}

                                <Text style={styles.label}>服用时机</Text>
                                {renderTagGroup(['饭前', '饭后', '随餐', '睡前', '不限'], medForm.time, t => setMedForm({ ...medForm, time: t }), false, null, false, '', () => { })}

                                <View style={[styles.row, { marginTop: 20 }]}>
                                    <Text style={styles.label}>开启打卡</Text>
                                    <Switch
                                        trackColor={{ false: "#767577", true: COLORS.primaryGreen }}
                                        thumbColor={medForm.enableCheckIn ? "#fff" : "#f4f3f4"}
                                        onValueChange={() => setMedForm({ ...medForm, enableCheckIn: !medForm.enableCheckIn })}
                                        value={medForm.enableCheckIn}
                                    />
                                </View>
                                <Text style={styles.subText}>开启后，该药品将出现在生活记录页，打卡自动扣减库存。</Text>

                                <Text style={styles.label}>库存数量</Text>
                                <View style={styles.stockControl}>
                                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(-0.5, true)}><Text>-0.5</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(-1, true)}><Text>-1</Text></TouchableOpacity>
                                    <TextInput style={styles.stockInput} keyboardType="decimal-pad" value={medForm.stock} onChangeText={t => setMedForm({ ...medForm, stock: t })} />
                                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(1, true)}><Text>+1</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.stockBtn} onPress={() => updateStock(0.5, true)}><Text>+0.5</Text></TouchableOpacity>
                                </View>

                                <Text style={styles.label}>过期时间</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <TouchableOpacity style={[styles.tag, medForm.noExpire && styles.tagActive]} onPress={() => setMedForm({ ...medForm, noExpire: true })}><Text style={[styles.tagText, medForm.noExpire && styles.tagTextActive]}>无期限</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.tag, !medForm.noExpire && styles.tagActive]} onPress={() => setMedForm({ ...medForm, noExpire: false, expireDate: new Date().toISOString().split('T')[0] })}><Text style={[styles.tagText, !medForm.noExpire && styles.tagTextActive]}>指定日期</Text></TouchableOpacity>
                                </View>
                                {!medForm.noExpire && <TextInput style={styles.input} placeholder="格式：2026-12-31" value={medForm.expireDate} onChangeText={t => setMedForm({ ...medForm, expireDate: t })} />}

                                <Text style={styles.label}>备注</Text>
                                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="例如：钙片要配水吃" value={medForm.remark} onChangeText={t => setMedForm({ ...medForm, remark: t })} multiline />
                            </View>
                        )}

                        {activeTab === 'habit' && (
                            <View>
                                <Text style={styles.label}>选择常用模板</Text>
                                <View style={styles.tagGroup}>{habitTemplates.map(h => <TouchableOpacity key={h} style={[styles.tag, habitForm.name === h && styles.tagActive]} onPress={() => setHabitForm({ ...habitForm, name: h })}><Text style={[styles.tagText, habitForm.name === h && styles.tagTextActive]}>{h}</Text></TouchableOpacity>)}</View>
                                <Text style={styles.label}>习惯名称</Text>
                                <TextInput style={styles.input} placeholder="例如：喝水、如厕" value={habitForm.name} onChangeText={t => setHabitForm({ ...habitForm, name: t })} />

                                <Text style={styles.label}>选择图标（30个）</Text>
                                <View style={styles.iconGrid}>{habitIcons.map(icon => <TouchableOpacity key={icon} style={[styles.iconItem, habitForm.icon === icon && styles.iconItemActive]} onPress={() => setHabitForm({ ...habitForm, icon })}><Text style={{ fontSize: 22 }}>{icon}</Text></TouchableOpacity>)}</View>

                                <Text style={styles.label}>打卡频次</Text>
                                {renderTagGroup(['每日1次', '每日2次', '隔日', '每周几次', '每天多次'], showCustomHabitFreq ? 'custom' : habitForm.frequency, t => { if (t !== 'custom') { setShowCustomHabitFreq(false); setHabitForm({ ...habitForm, frequency: t }); } }, showCustomHabitFreq, () => setShowCustomHabitFreq(!showCustomHabitFreq), showCustomHabitFreq, customHabitFreq, setCustomHabitFreq)}

                                <Text style={styles.label}>打卡期限（点击选择日期）</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => setShowStartDatePicker(true)}>
                                        <Text style={{ color: habitForm.startDate ? COLORS.textMain : COLORS.textLight }}>{habitForm.startDate || '开始日期'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => setShowEndDatePicker(true)}>
                                        <Text style={{ color: habitForm.endDate ? COLORS.textMain : COLORS.textLight }}>{habitForm.endDate || '结束日期'}</Text>
                                    </TouchableOpacity>
                                </View>

                                {showStartDatePicker && (
                                    <DateTimePicker
                                        value={habitForm.startDate ? new Date(habitForm.startDate) : new Date()}
                                        mode="date"
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            setShowStartDatePicker(false);
                                            if (selectedDate) setHabitForm({ ...habitForm, startDate: selectedDate.toISOString().split('T')[0] });
                                        }}
                                    />
                                )}
                                {showEndDatePicker && (
                                    <DateTimePicker
                                        value={habitForm.endDate ? new Date(habitForm.endDate) : new Date(new Date().setDate(new Date().getDate() + 7))}
                                        mode="date"
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            setShowEndDatePicker(false);
                                            if (selectedDate) setHabitForm({ ...habitForm, endDate: selectedDate.toISOString().split('T')[0] });
                                        }}
                                    />
                                )}

                                <Text style={styles.label}>打卡标签（用逗号分隔，可不填）</Text>
                                <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} placeholder="如：大便, 小便, 拉肚子" value={habitForm.tags} onChangeText={t => setHabitForm({ ...habitForm, tags: t })} multiline />

                                <View style={[styles.row, { marginTop: 20 }]}>
                                    <Text style={styles.label}>开启快速打卡</Text>
                                    <TouchableOpacity style={[styles.tag, habitForm.quickCheckIn && styles.tagActive]} onPress={() => setHabitForm({ ...habitForm, quickCheckIn: !habitForm.quickCheckIn })}><Text style={[styles.tagText, habitForm.quickCheckIn && styles.tagTextActive]}>{habitForm.quickCheckIn ? '已开启' : '未开启'}</Text></TouchableOpacity>
                                </View>
                                <Text style={styles.subText}>开启后，在生活页打卡将跳过标签填写，只记录次数和时间。</Text>

                                {editHabit && (
                                    <TouchableOpacity style={styles.deleteHabitBtn} onPress={handleDeleteHabit}>
                                        <Text style={styles.deleteHabitBtnText}>删除该习惯</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>保存</Text>
                    </TouchableOpacity>
                </View>
                {renderAllTemplatesModal()}
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
    content: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
    tabs: { flexDirection: 'row', gap: 20 },
    tabText: { fontSize: 15, color: COLORS.textSub, paddingBottom: 5 },
    tabActive: { color: COLORS.primaryGreen, fontWeight: '600', borderBottomWidth: 2, borderBottomColor: COLORS.primaryGreen },
    modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain },
    closeBtn: { fontSize: 24, color: COLORS.textSub },
    formScroll: { paddingHorizontal: 20 },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, marginTop: 15, marginBottom: 8 },
    subText: { fontSize: 12, color: COLORS.textSub, marginTop: 5 },
    input: { backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },
    coverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    templateScroll: { flexDirection: 'row', flex: 1 },
    templateItem: { width: 60, height: 60, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 2, borderColor: 'transparent' },
    templateItemActive: { borderColor: COLORS.primaryGreen, backgroundColor: COLORS.lightGreen },
    checkMark: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primaryGreen, justifyContent: 'center', alignItems: 'center' },
    viewMoreBtn: { paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', marginTop: 10 },
    viewMoreText: { fontSize: 13, color: COLORS.primaryGreen, fontWeight: '600' },
    uploadBtn: { paddingVertical: 12, alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', marginTop: 10 },
    uploadBtnText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
    customCoverPreview: { width: 80, height: 80, borderRadius: 12 },
    tagGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
    tagActive: { backgroundColor: COLORS.lightGreen, borderColor: COLORS.primaryGreen },
    tagText: { fontSize: 13, color: COLORS.textSub },
    tagTextActive: { color: COLORS.primaryGreen, fontWeight: '600' },
    stockControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', padding: 5, gap: 6 },
    stockBtn: { width: 40, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 8 },
    stockInput: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconItem: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
    iconItemActive: { borderColor: COLORS.primaryGreen, backgroundColor: COLORS.lightGreen },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    saveBtn: { backgroundColor: COLORS.primaryGreen, marginHorizontal: 20, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    deleteHabitBtn: { marginTop: 20, padding: 14, borderRadius: 14, backgroundColor: COLORS.lightPink, alignItems: 'center' },
    deleteHabitBtnText: { color: COLORS.pink, fontSize: 15, fontWeight: '600' },

    fullTemplateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    fullTemplateContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%' },
    fullTemplateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#eee' },
    fullTemplateTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain },
    fullTemplateItem: { width: '18%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
});