import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import ImageCropModal from './ImageCropModal';
import { AppContext } from '../context/AppContext';
import { COLORS, SIZES, SHADOWS } from '../theme';
import { MAX_REMIND_TIMES, ADVANCE_OPTIONS, requestPermission } from '../notifications';
import { localDateStr } from '../dateUtils';

// 是否为真实图片封面（file / content / http / data:image），否则视为模板 emoji
const isCoverUri = (c) => typeof c === 'string' && /^(file|content|http|data:image)/.test(c);

// 打卡提醒字段：新建/编辑共用一套取值，旧数据缺字段时补默认（默认关闭）
const remindFrom = (src) => ({
    remindOn: !!(src && src.remindOn),
    remindRepeat: (src && src.remindRepeat) || 'daily',
    remindWeekdays: (src && Array.isArray(src.remindWeekdays)) ? src.remindWeekdays : [],
    remindTimes: (src && Array.isArray(src.remindTimes)) ? src.remindTimes : [],
    remindAdvance: Number((src && src.remindAdvance) || 0),
});

export default function AddItemModal({ visible, onClose, editItem, editHabit }) {
    const { addItem, editItem: updateItem, addHabit, editHabit: updateHabit, deleteHabit, customOptions, addCustomOption, showToast, addLogEntry, themeColors: tc } = useContext(AppContext);
    const [isEditMode, setIsEditMode] = useState(false);
    const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('item');

    const [itemForm, setItemForm] = useState({ name: '', stock: '1.0', unit: '盒', category: '食品', threshold: '', expireDays: '', noExpire: true, expireDate: '', purpose: '', remark: '', enableCheckIn: false, associateInventory: false, ...remindFrom(null) });
    const [itemLocations, setItemLocations] = useState([]);
    const [itemCovers, setItemCovers] = useState([]); // 新建默认不预选封面，由用户自己挑；保存时无封面仍兜底 📦
    // 待裁切图片：{ uri, isMed }；null 表示未在裁切
    const [cropState, setCropState] = useState(null);
    const [medForm, setMedForm] = useState({ name: '', dose: '1', freq: '', timing: '不限', time: '08:30', stock: '30', remark: '', noExpire: true, expireDate: '', covers: [], enableCheckIn: false, associateInventory: false, unit: '粒', locations: [], purpose: '', threshold: '', expireDays: '', ...remindFrom(null) });
    const [habitForm, setHabitForm] = useState({ name: '', quickCheckIn: false, tags: [], icon: '⭐', frequency: '', startDate: '', endDate: '', ...remindFrom(null) });
    // 打卡提醒的时间点选择器：{ scope: 'item'|'med'|'habit', index: number }，index=-1 表示新增
    const [remindPicker, setRemindPicker] = useState(null);

    const [showCustomCategory, setShowCustomCategory] = useState(false);
    const [customCategory, setCustomCategory] = useState('');
    const [showCustomUnit, setShowCustomUnit] = useState(false);
    const [customUnit, setCustomUnit] = useState('');
    const [showCustomLocation, setShowCustomLocation] = useState(false);
    const [customLocation, setCustomLocation] = useState('');
    const [showCustomMedUnit, setShowCustomMedUnit] = useState(false);
    const [customMedUnit, setCustomMedUnit] = useState('');
    const [showCustomMedFreq, setShowCustomMedFreq] = useState(false);
    const [customMedFreq, setCustomMedFreq] = useState('');
    const [showCustomHabitFreq, setShowCustomHabitFreq] = useState(false);
    const [showCustomMedLocation, setShowCustomMedLocation] = useState(false);
    const [customMedLocation, setCustomMedLocation] = useState('');
    const [customHabitFreq, setCustomHabitFreq] = useState('');
    const [newTagInput, setNewTagInput] = useState('');
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [showExpireDatePicker, setShowExpireDatePicker] = useState(false);
    const [showMedTimePicker, setShowMedTimePicker] = useState(false);
    const [showAllItemTemplates, setShowAllItemTemplates] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [brokenCovers, setBrokenCovers] = useState([]);

    // 安全兜底：addLogEntry 可能为 undefined
    const safeLog = addLogEntry || (() => { });

    // 偏好列表兜底，避免旧数据缺字段时报错
    const optCategories = customOptions.categories || [];
    const optItemUnits = customOptions.itemUnits || [];
    const optItemLocations = customOptions.itemLocations || [];
    const optMedUnits = customOptions.medUnits || [];
    const optMedFrequencies = customOptions.medFrequencies || [];
    const optMedLocations = customOptions.medLocations || [];

    const itemTemplates = [
        '🥛', '🍚', '🍞', '🥚', '🧂', '🧃', '🍬', '🥤', '🧀', '🥫', '🍌', '🥕', '🍇', '🍉', '🍓', '🍒', '🍑', '🍍', '🍋', '🍐', '🥭', '🍈', '🌸', '🌷',
        '🪻', '💐', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔', '🌽', '🥦', '🥒', '🧄', '🧅', '🍄', '🥬', '🫑', '🫒', '🍠', '🥜', '🫘', '🫓', '🥟', '🍜', '🌰',
        '🫐', '🥐', '🥖', '🥨', '🍳', '🥞', '🧇', '🥓', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🍝', '🍲', '🍛', '🍣',
        '🍤', '🍙', '🍘', '🍥', '🥠', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍱', '🍽️', '🥣', '🥄', '🍴', '🥢', '🫙', '🫕', '🍭',
        '🍫', '🍿', '🍩', '🍪', '🍯', '🍼', '☕', '🍵', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🧊', '🧋', '🧴', '🧻', '🧼', '🧽', '🧹',
        '🧺', '🧷', '🧵', '🪡', '🧶', '🧈', '🧤', '🧣', '🧦', '🪥', '💄', '💅', '🛁', '🚿', '🧖', '🪞', '🪮', '🪣', '🗑️', '🪒', '🫧', '🪠', '💡', '🔦',
        '🔌', '🔋', '⚡', '🪫', '🧯', '🛒', '🖼️', '🪑', '🛋️', '🛏️', '🚪', '🪟', '🧱', '🪜', '🧰', '🔗', '🪝', '🪤', '🔧', '🔨', '🪛', '🔩', '⚙️', '⚖️',
        '🧲', '🔪', '🗡️', '🛡️', '🏺', '🛞', '🪚', '🪓', '⛏️', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🩹', '🩺', '💉', '🩸', '🧬', '🦠', '🧫', '🧪',
        '💊', '🩻', '🩼', '🫀', '🫁', '🦷', '🧠', '🥼', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬', '📭', '📮', '🗳️', '✏️', '✒️', '🖋️', '🖊️', '🖌️',
        '🖍️', '📝', '🗒️', '💼', '📁', '📂', '🗂️', '📅', '📆', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '🗄️', '🔍',
        '🔎', '🪴', '🌵', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🪺', '🐚', '🪸', '🪨', '🌊', '🔔', '🔕', '📣', '📢', '⚽', '🏀',
        '🎾', '👑', '🎩', '🧢', '👒', '👓', '🕶️', '🌂', '☂️', '👗', '👘', '🥻', '🩱', '🩲', '🩳', '👙', '👚', '👕', '👖', '👞', '👟', '👠', '👡', '🩴',
        '👢', '🥾', '🥿', '🦺', '👔', '🧥', '📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '💾', '💿', '📀', '🎮', '🕹️', '📷', '📹', '🎥', '📞', '☎️', '📟',
        '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '🧮', '🐶', '🐱', '🐭', '🐹', '🐰', '🐟', '🐠', '🐢', '🦎', '🐦', '🐕', '🐈',
        '🐾', '🦴', '🦜',
    ];
    const habitIcons = ['⭐', '💧', '🏃', '📖', '🍎', '🚽', '🩸', '💊', '🧘', '🥗', '😴', '🦷', '🧴', '🌞', '🏋️', '🧠', '📝', '🍵', '🚶', '🧹', '🍳', '🚴', '🧺', '🍽️', '📱', '✍️', '🎯', '🌙', '🧊', '🥑'];

    useEffect(() => {
        if (visible) {
            if (editItem) {
                setIsEditMode(true);
                // 编辑时也重置“自定义”临时状态，避免自定义分类被锁死、后续保存被强制覆盖
                setShowCustomCategory(false); setCustomCategory('');
                setShowCustomUnit(false); setCustomUnit('');
                setShowCustomMedUnit(false); setCustomMedUnit('');
                setShowCustomMedFreq(false); setCustomMedFreq('');
                setShowCustomHabitFreq(false); setCustomHabitFreq('');
                setShowCustomLocation(false); setCustomLocation('');
                setShowCustomMedLocation(false); setCustomMedLocation('');
                safeLog('Form', `打开编辑表单: ${editItem.name}`);
                if (editItem.category === '药品') {
                    setActiveTab('medicine');
                    setMedForm({
                        name: editItem.name, dose: editItem.dose || '1', freq: editItem.freq || '', timing: editItem.timing || '不限', time: editItem.time || '08:30',
                        stock: editItem.stock ? editItem.stock.toString() : '0', remark: editItem.remark || '',
                        noExpire: editItem.noExpire !== undefined ? editItem.noExpire : true,
                        expireDate: editItem.expireDate || '', covers: editItem.covers || [editItem.cover || '💊'],
                        enableCheckIn: editItem.enableCheckIn || false, unit: editItem.unit || '粒',
                        locations: editItem.locations ? editItem.locations.split('、').filter(l => l !== '未指定') : [],
                        purpose: editItem.purpose || '',
                        threshold: editItem.threshold !== undefined ? editItem.threshold : '',
                        expireDays: editItem.expireDays !== undefined ? editItem.expireDays : '',
                        associateInventory: editItem.associateInventory || false,
                        ...remindFrom(editItem)
                    });
                } else {
                    setActiveTab('item');
                    setItemForm({
                        name: editItem.name || '', stock: editItem.stock ? editItem.stock.toString() : '0',
                        unit: editItem.unit || '件', category: editItem.category || '其他',
                        threshold: editItem.threshold !== undefined ? editItem.threshold : '',
                        expireDays: editItem.expireDays !== undefined ? editItem.expireDays : '',
                        noExpire: editItem.noExpire !== undefined ? editItem.noExpire : true,
                        expireDate: editItem.expireDate || '',
                        purpose: editItem.purpose || '',
                        remark: editItem.remark || '',
                        enableCheckIn: editItem.enableCheckIn || false,
                        associateInventory: editItem.associateInventory || false,
                        ...remindFrom(editItem)
                    });
                    setItemCovers(editItem.covers || [editItem.cover || '📦']);
                    setItemLocations((editItem.locations ? editItem.locations.split('、') : (editItem.location ? [editItem.location] : [])).filter(l => l !== '未指定'));
                }
            } else if (editHabit) {
                setIsEditMode(true);
                safeLog('Form', `打开编辑习惯: ${editHabit.name}`);
                setActiveTab('habit');
                setHabitForm({ name: editHabit.name, quickCheckIn: editHabit.quickCheckIn, tags: editHabit.tags || [], icon: editHabit.icon || '⭐', frequency: editHabit.frequency || '', startDate: editHabit.startDate || '', endDate: editHabit.endDate || '', ...remindFrom(editHabit) });
            } else {
                setIsEditMode(false);
                setActiveTab('item');
                setItemForm({ name: '', stock: '1.0', unit: '盒', category: '食品', threshold: '', expireDays: '', noExpire: true, expireDate: '', purpose: '', remark: '', enableCheckIn: false, associateInventory: false });
                setItemCovers([]); setItemLocations([]);
                setMedForm({ name: '', dose: '1', freq: '', timing: '不限', time: '08:30', stock: '30', remark: '', noExpire: true, expireDate: '', covers: [], enableCheckIn: false, associateInventory: false, unit: '粒', purpose: '' });
                setHabitForm({ name: '', quickCheckIn: false, tags: [], icon: '⭐', frequency: '', startDate: '', endDate: '' });
                setShowCustomCategory(false); setCustomCategory(''); setShowCustomUnit(false); setCustomUnit('');
                setShowCustomLocation(false); setCustomLocation(''); setShowCustomMedUnit(false); setCustomMedUnit('');
                setShowCustomMedFreq(false); setCustomMedFreq(''); setShowCustomHabitFreq(false); setCustomHabitFreq('');
                setNewTagInput('');
                setShowAllItemTemplates(false);
                setShowCustomMedLocation(false);
                setCustomMedLocation('');
            }
        }
    }, [visible, editItem, editHabit]);

    const showToastCustom = (msg) => {
        setToastMsg(msg);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);
    };

    // 打卡提醒：改时间 / 加时间 / 删时间，按 scope 落到对应表单
    const applyRemindTime = (pick, hhmm) => {
        const apply = (prev) => {
            const times = Array.isArray(prev.remindTimes) ? [...prev.remindTimes] : [];
            if (pick.index >= 0) times[pick.index] = hhmm;
            else times.push(hhmm);
            return { ...prev, remindTimes: times.slice(0, MAX_REMIND_TIMES) };
        };
        if (pick.scope === 'item') setItemForm(apply);
        else if (pick.scope === 'med') setMedForm(apply);
        else setHabitForm(apply);
    };

    const removeRemindTime = (scope, index) => {
        const apply = (prev) => {
            const times = Array.isArray(prev.remindTimes) ? [...prev.remindTimes] : [];
            times.splice(index, 1);
            return { ...prev, remindTimes: times };
        };
        if (scope === 'item') setItemForm(apply);
        else if (scope === 'med') setMedForm(apply);
        else setHabitForm(apply);
    };

    // 打卡提醒设置区（物品 / 药品 / 习惯共用同一套控件与样式）
    const renderRemindBlock = (form, setForm, scope, isMed) => (
        <>
            <View style={[styles.row, { marginTop: 10 }]}>
                <Text style={[styles.label, { color: tc.textMain }]}>打卡提醒</Text>
                <TouchableOpacity style={[styles.tag, form.remindOn && styles.tagActive]} onPress={() => {
                    if (form.remindOn) { setForm({ ...form, remindOn: false }); return; }
                    // 开启时不预设时间：药品固定时间沿用服药时间，其余留空由用户自己添加
                    const times = (Array.isArray(form.remindTimes) && form.remindTimes.length > 0)
                        ? form.remindTimes
                        : ((isMed && form.timing === '固定时间' && form.time) ? [form.time] : []);
                    setForm({ ...form, remindOn: true, remindTimes: times });
                    // 开启时顺手要一次通知权限（没有权限就排不进系统）
                    requestPermission().catch(() => {});
                }}>
                    <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, form.remindOn && styles.tagTextActive]}>{form.remindOn ? '已开启' : '未开启'}</Text>
                </TouchableOpacity>
            </View>
            {form.remindOn && (<>
                <Text style={[styles.label, { color: tc.textMain }]}>提醒重复</Text>
                <View style={styles.tagGroup}>
                    {[['daily', '每天'], ['odd', '隔日'], ['weekly', '每周']].map(([key, label]) => (
                        <TouchableOpacity key={key} style={[styles.tag, (form.remindRepeat || 'daily') === key && styles.tagActive]} onPress={() => {
                            const patch = { remindRepeat: key };
                            if (key === 'weekly' && (!Array.isArray(form.remindWeekdays) || form.remindWeekdays.length === 0)) patch.remindWeekdays = [new Date().getDay()];
                            setForm({ ...form, ...patch });
                        }}>
                            <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, (form.remindRepeat || 'daily') === key && styles.tagTextActive]}>{label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {(form.remindRepeat || 'daily') === 'weekly' && (
                    <View style={styles.tagGroup}>
                        {['日', '一', '二', '三', '四', '五', '六'].map((label, i) => (
                            <TouchableOpacity key={i} style={[styles.tag, (form.remindWeekdays || []).includes(i) && styles.tagActive]} onPress={() => {
                                const cur = Array.isArray(form.remindWeekdays) ? form.remindWeekdays : [];
                                const next = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i].sort((a, b) => a - b);
                                if (next.length === 0) return; // 一周至少要留一天
                                setForm({ ...form, remindWeekdays: next });
                            }}>
                                <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, (form.remindWeekdays || []).includes(i) && styles.tagTextActive]}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                <Text style={[styles.label, { color: tc.textMain }]}>提醒时间（可多个，最多 {MAX_REMIND_TIMES} 个）</Text>
                <View style={styles.tagGroup}>
                    {(form.remindTimes || []).map((t, i) => (
                        <View key={i} style={[styles.tag, styles.tagActive, { flexDirection: 'row', alignItems: 'center' }]}>
                            <TouchableOpacity onPress={() => setRemindPicker({ scope, index: i })}>
                                <Text style={styles.tagTextActive}>{t}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeRemindTime(scope, i)} style={{ marginLeft: 8 }}>
                                <Text style={styles.tagTextActive}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                    {(form.remindTimes || []).length < MAX_REMIND_TIMES && (
                        <TouchableOpacity style={styles.tag} onPress={() => setRemindPicker({ scope, index: -1 })}>
                            <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }]}>+ 添加时间</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={[styles.label, { color: tc.textMain }]}>提前提醒</Text>
                <View style={styles.tagGroup}>
                    {ADVANCE_OPTIONS.map(v => (
                        <TouchableOpacity key={v} style={[styles.tag, Number(form.remindAdvance || 0) === v && styles.tagActive]} onPress={() => setForm({ ...form, remindAdvance: v })}>
                            <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, Number(form.remindAdvance || 0) === v && styles.tagTextActive]}>{v === 0 ? '不提前' : v + ' 分钟前'}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </>)}
        </>
    );

    // 开启了打卡提醒却没选提醒时间 → 保存时拦截
    const isRemindTimeMissing = (form) => !!(form && form.remindOn) && (!Array.isArray(form.remindTimes) || form.remindTimes.length === 0);

    const handleSave = () => {
        safeLog('Save', `点击保存，当前Tab: ${activeTab}`);
        if (activeTab === 'item') {
            if (!itemForm.name || String(itemForm.name).trim() === '') { showToastCustom('请输入物品名称'); return; }
            if (isRemindTimeMissing(itemForm)) { showToastCustom('请选择提醒时间'); return; }
            const finalUnit = showCustomUnit && customUnit ? customUnit : itemForm.unit;
            const finalCategory = showCustomCategory && customCategory ? customCategory : itemForm.category;
            // 自定义写回对应偏好 key
            if (showCustomUnit && customUnit && addCustomOption) addCustomOption('itemUnits', customUnit);
            if (showCustomCategory && customCategory && addCustomOption) addCustomOption('categories', customCategory);

            // 数据清洗：剔除失效封面；模板 emoji 与真实图片可共存，不再二选一
            const aliveItemCovers = itemCovers.filter(c => !brokenCovers.includes(c));
            const dedupItemCovers = Array.from(new Set(aliveItemCovers));
            const visibleItemCovers = dedupItemCovers.length > 0 ? dedupItemCovers : ['📦'];
            const finalData = {
                ...itemForm,
                name: itemForm.name.trim(),
                stock: isNaN(parseFloat(itemForm.stock)) ? 0 : parseFloat(itemForm.stock),
                unit: finalUnit || '件',
                category: finalCategory || '其他',
                covers: visibleItemCovers.length > 0 ? visibleItemCovers : ['📦'],
                locations: itemLocations.length > 0 ? itemLocations.join('、') : '',
                location: itemLocations.length > 0 ? itemLocations[0] : '',
                threshold: itemForm.threshold === '' ? '' : (isNaN(parseFloat(itemForm.threshold)) ? '' : parseFloat(itemForm.threshold).toString()),
                expireDays: itemForm.expireDays === '' ? '' : (isNaN(parseFloat(itemForm.expireDays)) ? '' : parseFloat(itemForm.expireDays).toString()),
                expireDate: itemForm.noExpire ? '' : (itemForm.expireDate || ''),
                purpose: itemForm.purpose || '',
                remark: itemForm.remark || '',
                enableCheckIn: itemForm.enableCheckIn || false,
                associateInventory: itemForm.associateInventory || false
            };
            safeLog('Save', `准备保存物品数据: ${JSON.stringify(finalData)}`);
            if (editItem) { if (updateItem) updateItem(editItem.id, finalData); } else { if (addItem) addItem(finalData); }
        } else if (activeTab === 'medicine') {
            if (!medForm.name || String(medForm.name).trim() === '') { showToastCustom('请输入药品名称'); return; }
            if (isRemindTimeMissing(medForm)) { showToastCustom('请选择提醒时间'); return; }
            const finalFreq = showCustomMedFreq && customMedFreq ? customMedFreq : medForm.freq;
            const finalUnit = showCustomMedUnit && customMedUnit ? customMedUnit : medForm.unit;
            // 自定义写回对应偏好 key
            if (showCustomMedUnit && customMedUnit && addCustomOption) addCustomOption('medUnits', customMedUnit);
            if (showCustomMedFreq && customMedFreq && addCustomOption) addCustomOption('medFrequencies', customMedFreq);
            const aliveMedCovers = medForm.covers.filter(c => !brokenCovers.includes(c));
            const dedupMedCovers = Array.from(new Set(aliveMedCovers));
            const visibleMedCovers = dedupMedCovers.length > 0 ? dedupMedCovers : ['💊'];
            const finalData = {
                ...medForm,
                name: medForm.name.trim(),
                stock: isNaN(parseFloat(medForm.stock)) ? 0 : parseFloat(medForm.stock),
                unit: finalUnit || '粒',
                freq: finalFreq,
                category: '药品',
                locations: medForm.locations && medForm.locations.length > 0 ? medForm.locations.join('、') : '',
                location: medForm.locations && medForm.locations.length > 0 ? medForm.locations[0] : '',
                covers: visibleMedCovers.length > 0 ? visibleMedCovers : ['💊'],
                expireDate: medForm.noExpire ? '' : (medForm.expireDate || ''),
                purpose: medForm.purpose || '',
                threshold: medForm.threshold === '' ? '' : (isNaN(parseFloat(medForm.threshold)) ? '' : parseFloat(medForm.threshold).toString()),
                expireDays: medForm.expireDays === '' ? '' : (isNaN(parseFloat(medForm.expireDays)) ? '' : parseFloat(medForm.expireDays).toString()),
                associateInventory: medForm.associateInventory || false
            };
            safeLog('Save', `准备保存药品数据: ${JSON.stringify(finalData)}`);
            if (editItem) { if (updateItem) updateItem(editItem.id, finalData); } else { if (addItem) addItem(finalData); }
        } else if (activeTab === 'habit') {
            if (!habitForm.name || String(habitForm.name).trim() === '') { showToastCustom('请输入习惯名称'); return; }
            if (isRemindTimeMissing(habitForm)) { showToastCustom('请选择提醒时间'); return; }
            const finalFreq = showCustomHabitFreq && customHabitFreq ? customHabitFreq : habitForm.frequency;
            const finalData = { ...habitForm, name: habitForm.name.trim(), frequency: finalFreq };
            safeLog('Save', `准备保存习惯数据: ${JSON.stringify(finalData)}`);
            if (editHabit) { if (updateHabit) updateHabit(editHabit.id, finalData); } else { if (addHabit) addHabit(finalData); }
        }
        onClose();
    };

    const handleDeleteHabit = () => { if (editHabit) { if (deleteHabit) deleteHabit(editHabit.id); } if (onClose) onClose(); };
    const updateStock = (delta, isMed = false) => { const form = isMed ? medForm : itemForm; const setter = isMed ? setMedForm : setItemForm; const current = parseFloat(form.stock) || 0; setter({ ...form, stock: Math.max(0, current + delta).toString() }); };
    // 将裁切/选择产生的临时缓存图拷贝到持久目录，避免 Expo 缓存清理后封面丢失
    const persistCoverUri = async (uri) => {
        try {
            const dir = FileSystem.documentDirectory + 'covers/';
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
            const extMatch = /\.(jpg|jpeg|png|webp)$/i.exec(uri || '');
            const ext = extMatch ? extMatch[0] : '.jpg';
            const dest = dir + 'cover_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
            await FileSystem.copyAsync({ from: uri, to: dest });
            if (addLogEntry) addLogEntry('CoverPersist', `封面持久化成功: ${dest}`);
            return dest;
        } catch (e) {
            if (addLogEntry) addLogEntry('CoverPersist', `封面持久化失败: ${e && e.message ? e.message : e}`);
            return uri;
        }
    };
    const pickImage = async (isMed = false) => {
        // 只选图不做系统裁切（系统裁切固定 1:1 不可控），选完进入自绘裁切弹窗（封面16:9/1:1/自由）
        let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
        if (!result.canceled) setCropState({ uri: result.assets[0].uri, isMed });
    };

    const renderTagGroup = (options, selected, onSelect, isCustom, onCustomSelect, showCustomInput, customValue, setCustomValue, onCustomDone) => (
        <View>
            <View style={styles.tagGroup}>
                {options.map(opt => (
                    <TouchableOpacity key={opt} style={[styles.tag, selected === opt && styles.tagActive]} onPress={() => onSelect(opt)}>
                        <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, selected === opt && styles.tagTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                ))}
                {onCustomSelect && <TouchableOpacity style={[styles.tag, isCustom && styles.tagActive]} onPress={onCustomSelect}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, isCustom && styles.tagTextActive]}>+ 自定义</Text></TouchableOpacity>}
            </View>
            {showCustomInput && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TextInput
                        placeholderTextColor={tc.textSub}
                        style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain, flex: 1, marginTop: 0 }]}
                        placeholder="输入自定义内容"
                        value={customValue}
                        onChangeText={setCustomValue}
                        onSubmitEditing={onCustomDone}
                        returnKeyType="done"
                    />
                    <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: tc.accent }]} onPress={onCustomDone}>
                        <Text style={{ color: tc.accentText, fontWeight: '600' }}>完成</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <>
            <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setExitConfirmVisible(true)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <View style={[styles.content, { backgroundColor: tc.modalBg }]}>
                    <View style={styles.header}>
                        {isEditMode ? <Text style={[styles.modalTitle, { color: tc.textMain }]}>{activeTab === 'item' ? '编辑物品' : activeTab === 'medicine' ? '编辑药品' : '编辑习惯'}</Text> : (
                            <View style={styles.tabs}>
                                <TouchableOpacity onPress={() => setActiveTab('item')}><Text style={[styles.tabText, { color: tc.textSub }, activeTab === 'item' && styles.tabActive]}>添加物品</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setActiveTab('medicine')}><Text style={[styles.tabText, { color: tc.textSub }, activeTab === 'medicine' && styles.tabActive]}>添加药品</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setActiveTab('habit')}><Text style={[styles.tabText, { color: tc.textSub }, activeTab === 'habit' && styles.tabActive]}>配置习惯</Text></TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity onPress={onClose}><Text style={[styles.closeBtn, { color: tc.textSub }]}>✕</Text></TouchableOpacity>
                    </View>

                    <ScrollView keyboardShouldPersistTaps="handled" style={styles.formScroll} contentContainerStyle={{ paddingBottom: 60 }}>
                        {activeTab === 'item' && (<><Text style={[styles.label, { color: tc.textMain }]}>物品封面（可多选，滑动查看）</Text>
                            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                                <TouchableOpacity style={[styles.templateItem, { borderStyle: 'dashed', backgroundColor: tc.cardBg }]} onPress={() => pickImage(false)}><Text style={{ fontSize: 24, color: COLORS.textSub }}>➕</Text></TouchableOpacity>
                                {itemCovers.map((cover, index) => brokenCovers.includes(cover) ? null : (
                                    <View key={index} style={{ marginRight: 10, position: 'relative' }}>
                                        {cover.startsWith('file') || cover.startsWith('content') ? <Image source={{ uri: cover }} style={styles.templateItem} onError={() => setBrokenCovers(prev => prev.includes(cover) ? prev : [...prev, cover])} /> : <View style={[styles.templateItem, { justifyContent: 'center', alignItems: 'center', backgroundColor: tc.cardBg }]}><Text style={{ fontSize: 24 }}>{cover}</Text></View>}
                                        {<TouchableOpacity style={styles.removeCoverBtn} onPress={() => setItemCovers(itemCovers.filter((_, i) => i !== index))}><Text style={{ color: '#fff', fontSize: 10 }}>✕</Text></TouchableOpacity>}
                                    </View>
                                ))}
                            </ScrollView>

                            <Text style={[styles.label, { color: tc.textMain }]}>选择模板</Text>
                            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                                {itemTemplates.slice(0, showAllItemTemplates ? itemTemplates.length : 20).map((item, index) => (
                                    <TouchableOpacity key={index} style={[styles.templateItem, { backgroundColor: tc.cardBg }, itemCovers.includes(item) && styles.templateItemActive]} onPress={() => setItemCovers(prev => [...prev.filter(c => isCoverUri(c)), item])}><Text style={{ fontSize: 24 }}>{item}</Text></TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity onPress={() => setShowAllItemTemplates(!showAllItemTemplates)} style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain, justifyContent: 'center', marginTop: 10 }]}>
                                <Text style={{ textAlign: 'center', color: COLORS.primaryGreen }}>{showAllItemTemplates ? '收起模板' : '查看更多模板 (' + itemTemplates.length + ')'}</Text>
                            </TouchableOpacity>

                            <Text style={[styles.label, { color: tc.textMain }]}>物品名称</Text>
                            <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} placeholder="请输入物品名称" value={itemForm.name} onChangeText={t => setItemForm({ ...itemForm, name: t })} />

                            <Text style={[styles.label, { color: tc.textMain }]}>分类</Text>
                            {renderTagGroup(optCategories, (showCustomCategory && customCategory) ? customCategory : itemForm.category, t => { setShowCustomCategory(false); setCustomCategory(''); setItemForm({ ...itemForm, category: t }); }, showCustomCategory, () => setShowCustomCategory(!showCustomCategory), showCustomCategory, customCategory, setCustomCategory, () => { const v = (customCategory || '').trim(); if (!v) return; if (addCustomOption) addCustomOption('categories', v); setItemForm({ ...itemForm, category: v }); setCustomCategory(''); setShowCustomCategory(false); })}

                            <Text style={[styles.label, { color: tc.textMain }]}>库存数量</Text>
                            <View style={[styles.stockControl, { backgroundColor: tc.inputBg, borderColor: tc.border }]}>
                                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => updateStock(-0.5)}><Text>-0.5</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => updateStock(-1)}><Text>-1</Text></TouchableOpacity>
                                <TextInput placeholderTextColor={tc.textSub}style={[styles.stockInput, { color: tc.textMain }]} keyboardType="decimal-pad" value={itemForm.stock} onChangeText={t => setItemForm({ ...itemForm, stock: t })} />
                                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => updateStock(1)}><Text>+1</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => updateStock(0.5)}><Text>+0.5</Text></TouchableOpacity>
                            </View>

                            <Text style={[styles.label, { color: tc.textMain }]}>单位</Text>
                            {renderTagGroup(optItemUnits, (showCustomUnit && customUnit) ? customUnit : showCustomUnit ? 'custom' : itemForm.unit, t => { if (t !== 'custom') { setShowCustomUnit(false); setItemForm({ ...itemForm, unit: t }); } }, showCustomUnit, () => setShowCustomUnit(!showCustomUnit), showCustomUnit, customUnit, setCustomUnit, () => { const v = (customUnit || '').trim(); if (!v) return; if (addCustomOption) addCustomOption('itemUnits', v); setItemForm({ ...itemForm, unit: v }); setCustomUnit(''); setShowCustomUnit(false); })}

                            <Text style={[styles.label, { color: tc.textMain }]}>存放位置（可多选）</Text>
                            <View style={styles.tagGroup}>
                                {optItemLocations.map(opt => (
                                    <TouchableOpacity key={opt} style={[styles.tag, itemLocations.includes(opt) && styles.tagActive]} onPress={() => { if (itemLocations.includes(opt)) setItemLocations(itemLocations.filter(l => l !== opt)); else setItemLocations([...itemLocations, opt]); }}>
                                        <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, itemLocations.includes(opt) && styles.tagTextActive]}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={[styles.tag, showCustomLocation && styles.tagActive]} onPress={() => setShowCustomLocation(!showCustomLocation)}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, showCustomLocation && styles.tagTextActive]}>+ 自定义</Text></TouchableOpacity>
                            </View>
                            {showCustomLocation && (
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                    <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain, flex: 1 }]} placeholder="请输入自定义内容" value={customLocation} onChangeText={setCustomLocation} />
                                    <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: tc.accent }]} onPress={() => { if (customLocation.trim()) { setItemLocations([...itemLocations, customLocation.trim()]); addCustomOption && addCustomOption('itemLocations', customLocation.trim()); setCustomLocation(''); setShowCustomLocation(false); } }}><Text style={{ color: tc.accentText, fontWeight: '600' }}>完成</Text></TouchableOpacity>
                                </View>
                            )}

                            <View style={{ marginTop: 10 }}>
                                <Text style={[styles.label, { color: tc.textMain }]}>过期时间</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <TouchableOpacity style={[styles.tag, itemForm.noExpire && styles.tagActive]} onPress={() => setItemForm({ ...itemForm, noExpire: true })}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, itemForm.noExpire && styles.tagTextActive]}>无期限</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.tag, !itemForm.noExpire && styles.tagActive]} onPress={() => { if (itemForm.noExpire) setItemForm({ ...itemForm, noExpire: false, expireDate: localDateStr() }); else setItemForm({ ...itemForm, noExpire: false }); }}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, !itemForm.noExpire && styles.tagTextActive]}>指定日期</Text></TouchableOpacity>
                                </View>
                                {!itemForm.noExpire && (
                                    <TouchableOpacity style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, justifyContent: 'center' }]} onPress={() => setShowExpireDatePicker(true)}>
                                        <Text style={{ color: itemForm.expireDate ? tc.textMain : tc.textLight }}>{itemForm.expireDate || '选择日期'}</Text>
                                    </TouchableOpacity>
                                )}
                                {showExpireDatePicker && <DateTimePicker value={itemForm.expireDate ? new Date(itemForm.expireDate) : new Date()} mode="date" display="spinner" themeVariant="light" onChange={(e, d) => {
                                    if (Platform.OS === 'android') {
                                        // Android spinner：滚动不关闭、不应用，点“确定”才应用并关闭（可自由选到当日之前的日期）
                                        setShowExpireDatePicker(false);
                                        if (e.type === 'set' && d) setItemForm({ ...itemForm, expireDate: localDateStr(d) });
                                    } else {
                                        if (d) setItemForm({ ...itemForm, expireDate: localDateStr(d) });
                                        setShowExpireDatePicker(false);
                                    }
                                }} />}
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                                <View style={{ width: '48%' }}>
                                    <Text style={[styles.label, { color: tc.textMain }]}>低库存预警值（空则不提醒）</Text><TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} value={itemForm.threshold} keyboardType="numeric" onChangeText={t => setItemForm({ ...itemForm, threshold: t })} placeholder="如: 2" />
                                </View>
                                <View style={{ width: '48%' }}>
                                    <Text style={[styles.label, { color: tc.textMain }]}>临期提前提醒(天)</Text><TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} value={itemForm.expireDays} keyboardType="numeric" onChangeText={t => setItemForm({ ...itemForm, expireDays: t })} placeholder="如: 5" />
                                </View>
                            </View>

                            <Text style={[styles.label, { color: tc.textMain }]}>用途（限10字）</Text>
                            <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} placeholder="请输入用途" value={itemForm.purpose} onChangeText={t => setItemForm({ ...itemForm, purpose: t })} maxLength={10} />

                            <View style={[styles.row, { marginTop: 10 }]}>
                                <Text style={[styles.label, { color: tc.textMain }]}>开启打卡</Text>
                                <TouchableOpacity style={[styles.tag, itemForm.enableCheckIn && styles.tagActive]} onPress={() => setItemForm({ ...itemForm, enableCheckIn: !itemForm.enableCheckIn })}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, itemForm.enableCheckIn && styles.tagTextActive]}>{itemForm.enableCheckIn ? '已开启' : '未开启'}</Text></TouchableOpacity>
                            </View>
                            {itemForm.enableCheckIn && (
                                <>
                                    <View style={[styles.row, { marginTop: 10 }]}>
                                        <Text style={[styles.label, { color: tc.textMain }]}>关联库存（打卡扣库存/删记录还原）</Text>
                                        <TouchableOpacity style={[styles.tag, itemForm.associateInventory && styles.tagActive]} onPress={() => setItemForm({ ...itemForm, associateInventory: !itemForm.associateInventory })}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, itemForm.associateInventory && styles.tagTextActive]}>{itemForm.associateInventory ? '已关联' : '未关联'}</Text></TouchableOpacity>
                                    </View>
                                    {renderRemindBlock(itemForm, setItemForm, 'item', false)}
                                </>
                            )}
                            <Text style={[styles.label, { color: tc.textMain }]}>备注（限50字）</Text>
                            <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain, height: 60, textAlignVertical: 'top' }]} placeholder="请输入备注" value={itemForm.remark} onChangeText={t => setItemForm({ ...itemForm, remark: t })} maxLength={50} multiline />
                        </>)}

                        {activeTab === 'medicine' && (<><Text style={[styles.label, { color: tc.textMain }]}>药品封面（可多选）</Text>
                            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                                <TouchableOpacity style={[styles.templateItem, { borderStyle: 'dashed', backgroundColor: tc.cardBg }]} onPress={() => pickImage(true)}><Text style={{ fontSize: 24, color: COLORS.textSub }}>➕</Text></TouchableOpacity>
                                {medForm.covers.map((cover, index) => brokenCovers.includes(cover) ? null : (
                                    <View key={index} style={{ marginRight: 10, position: 'relative' }}>
                                        {cover.startsWith('file') || cover.startsWith('content') ? <Image source={{ uri: cover }} style={styles.templateItem} onError={() => setBrokenCovers(prev => prev.includes(cover) ? prev : [...prev, cover])} /> : <View style={[styles.templateItem, { justifyContent: 'center', alignItems: 'center', backgroundColor: tc.cardBg }]}><Text style={{ fontSize: 24 }}>{cover}</Text></View>}
                                        {<TouchableOpacity style={styles.removeCoverBtn} onPress={() => setMedForm({ ...medForm, covers: medForm.covers.filter((_, i) => i !== index) })}><Text style={{ color: '#fff', fontSize: 10 }}>✕</Text></TouchableOpacity>}
                                    </View>
                                ))}
                            </ScrollView>

                            <Text style={[styles.label, { color: tc.textMain }]}>药品名称</Text>
                            <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} placeholder="请输入药品名称" value={medForm.name} onChangeText={t => setMedForm({ ...medForm, name: t })} />

                            <Text style={[styles.label, { color: tc.textMain }]}>每次剂量</Text>
                            <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} placeholder="例如：1粒" value={medForm.dose} onChangeText={t => setMedForm({ ...medForm, dose: t })} />

                            <Text style={[styles.label, { color: tc.textMain }]}>库存数量</Text>
                            <View style={[styles.stockControl, { backgroundColor: tc.inputBg, borderColor: tc.border }]}>
                                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => updateStock(-0.5, true)}><Text>-0.5</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => updateStock(-1, true)}><Text>-1</Text></TouchableOpacity>
                                <TextInput placeholderTextColor={tc.textSub}style={[styles.stockInput, { color: tc.textMain }]} keyboardType="decimal-pad" value={medForm.stock} onChangeText={t => setMedForm({ ...medForm, stock: t })} />
                                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => updateStock(1, true)}><Text>+1</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => updateStock(0.5, true)}><Text>+0.5</Text></TouchableOpacity>
                            </View>

                            <Text style={[styles.label, { color: tc.textMain }]}>单位</Text>
                            {renderTagGroup(optMedUnits, (showCustomMedUnit && customMedUnit) ? customMedUnit : showCustomMedUnit ? 'custom' : medForm.unit, t => { if (t !== 'custom') { setShowCustomMedUnit(false); setMedForm({ ...medForm, unit: t }); } }, showCustomMedUnit, () => setShowCustomMedUnit(!showCustomMedUnit), showCustomMedUnit, customMedUnit, setCustomMedUnit, () => { const v = (customMedUnit || '').trim(); if (!v) return; if (addCustomOption) addCustomOption('medUnits', v); setMedForm({ ...medForm, unit: v }); setCustomMedUnit(''); setShowCustomMedUnit(false); })}

                            <Text style={[styles.label, { color: tc.textMain }]}>服用频数（非必选）</Text>
                            {renderTagGroup(optMedFrequencies, (showCustomMedFreq && customMedFreq) ? customMedFreq : showCustomMedFreq ? 'custom' : medForm.freq, t => { if (t !== 'custom') { setShowCustomMedFreq(false); setMedForm({ ...medForm, freq: t }); } }, showCustomMedFreq, () => setShowCustomMedFreq(!showCustomMedFreq), showCustomMedFreq, customMedFreq, setCustomMedFreq, () => { const v = (customMedFreq || '').trim(); if (!v) return; if (addCustomOption) addCustomOption('medFrequencies', v); setMedForm({ ...medForm, freq: v }); setCustomMedFreq(''); setShowCustomMedFreq(false); })}

                            <Text style={[styles.label, { color: tc.textMain }]}>服用时机</Text>
                            <View style={styles.tagGroup}>
                                {['饭前', '随餐', '饭后', '不限'].map(opt => (
                                    <TouchableOpacity key={opt} style={[styles.tag, medForm.timing === opt && styles.tagActive]} onPress={() => setMedForm({ ...medForm, timing: opt })}>
                                        <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, medForm.timing === opt && styles.tagTextActive]}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={[styles.tag, medForm.timing === '固定时间' && styles.tagActive]} onPress={() => setShowMedTimePicker(true)}>
                                    <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, medForm.timing === '固定时间' && styles.tagTextActive]}>{medForm.timing === '固定时间' ? (medForm.time || '固定时间') : '固定时间'}</Text>
                                </TouchableOpacity>
                            </View>
                            {showMedTimePicker && <DateTimePicker value={medForm.time && medForm.time !== '00:00' ? new Date('2000-01-01T' + medForm.time + ':00') : new Date()} mode="time" display="spinner" themeVariant="light" is24Hour={true} onChange={(event, selectedDate) => { setShowMedTimePicker(false); if (event && event.type === 'dismissed') return; if (selectedDate) { const h = String(selectedDate.getHours()).padStart(2, '0'); const m = String(selectedDate.getMinutes()).padStart(2, '0'); setMedForm({ ...medForm, timing: '固定时间', time: h + ':' + m }); } }} />}

                            <View style={{ marginTop: 20 }}>
                                <Text style={[styles.label, { color: tc.textMain }]}>存放位置（可多选）</Text>
                                <View style={styles.tagGroup}>
                                    {optMedLocations.map(opt => (
                                        <TouchableOpacity key={opt} style={[styles.tag, medForm.locations && medForm.locations.includes(opt) && styles.tagActive]} onPress={() => {
                                            const locs = medForm.locations || [];
                                            if (locs.includes(opt)) setMedForm({ ...medForm, locations: locs.filter(l => l !== opt) });
                                            else setMedForm({ ...medForm, locations: [...locs, opt] });
                                        }}>
                                            <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, medForm.locations && medForm.locations.includes(opt) && styles.tagTextActive]}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    <TouchableOpacity style={[styles.tag, showCustomMedLocation && styles.tagActive]} onPress={() => setShowCustomMedLocation(!showCustomMedLocation)}>
                                        <Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, showCustomMedLocation && styles.tagTextActive]}>+ 自定义</Text>
                                    </TouchableOpacity>
                                </View>
                                {showCustomMedLocation && (
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                        <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain, flex: 1 }]} placeholder="请输入自定义内容" value={customMedLocation} onChangeText={setCustomMedLocation} />
                                        <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: tc.accent }]} onPress={() => {
                                            if (customMedLocation.trim()) {
                                                const locs = medForm.locations || [];
                                                setMedForm({ ...medForm, locations: [...locs, customMedLocation.trim()] });
                                                addCustomOption && addCustomOption('medLocations', customMedLocation.trim());
                                                setCustomMedLocation('');
                                                setShowCustomMedLocation(false);
                                            }
                                        }}><Text style={{ color: tc.accentText, fontWeight: '600' }}>完成</Text></TouchableOpacity>
                                    </View>
                                )}

                                <View style={{ marginTop: 10 }}>
                                    <Text style={[styles.label, { color: tc.textMain }]}>过期时间</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                        <TouchableOpacity style={[styles.tag, medForm.noExpire && styles.tagActive]} onPress={() => setMedForm({ ...medForm, noExpire: true })}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, medForm.noExpire && styles.tagTextActive]}>无期限</Text></TouchableOpacity>
                                        <TouchableOpacity style={[styles.tag, !medForm.noExpire && styles.tagActive]} onPress={() => { if (medForm.noExpire) setMedForm({ ...medForm, noExpire: false, expireDate: localDateStr() }); else setMedForm({ ...medForm, noExpire: false }); }}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, !medForm.noExpire && styles.tagTextActive]}>指定日期</Text></TouchableOpacity>
                                    </View>
                                    {!medForm.noExpire && <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} placeholder="格式：2026-12-31" value={medForm.expireDate} onChangeText={t => setMedForm({ ...medForm, expireDate: t })} />}
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                                    <View style={{ width: '48%' }}>
                                        <Text style={[styles.label, { color: tc.textMain }]}>低库存预警值（空则不提醒）</Text><TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} value={medForm.threshold} keyboardType="numeric" onChangeText={t => setMedForm({ ...medForm, threshold: t })} placeholder="如: 2" />
                                    </View>
                                    <View style={{ width: '48%' }}>
                                        <Text style={[styles.label, { color: tc.textMain }]}>临期提前提醒(天)</Text><TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} value={medForm.expireDays} keyboardType="numeric" onChangeText={t => setMedForm({ ...medForm, expireDays: t })} placeholder="如: 5" />
                                    </View>
                                </View>

                                <Text style={[styles.label, { color: tc.textMain }]}>用途（限10字）</Text>
                                <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} placeholder="请输入用途" value={medForm.purpose} onChangeText={t => setMedForm({ ...medForm, purpose: t })} maxLength={10} />

                                <View style={[styles.row, { marginTop: 10 }]}>
                                    <Text style={[styles.label, { color: tc.textMain }]}>开启打卡</Text>
                                    <TouchableOpacity style={[styles.tag, medForm.enableCheckIn && styles.tagActive]} onPress={() => setMedForm({ ...medForm, enableCheckIn: !medForm.enableCheckIn })}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, medForm.enableCheckIn && styles.tagTextActive]}>{medForm.enableCheckIn ? '已开启' : '未开启'}</Text></TouchableOpacity>
                                </View>
                                {medForm.enableCheckIn && (
                                    <>
                                        <View style={[styles.row, { marginTop: 10 }]}>
                                            <Text style={[styles.label, { color: tc.textMain }]}>关联库存（打卡扣库存/删记录还原）</Text>
                                            <TouchableOpacity style={[styles.tag, medForm.associateInventory && styles.tagActive]} onPress={() => setMedForm({ ...medForm, associateInventory: !medForm.associateInventory })}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, medForm.associateInventory && styles.tagTextActive]}>{medForm.associateInventory ? '已关联' : '未关联'}</Text></TouchableOpacity>
                                        </View>
                                        {renderRemindBlock(medForm, setMedForm, 'med', true)}
                                    </>
                                )}
                            </View>

                            <Text style={[styles.label, { color: tc.textMain }]}>备注</Text>
                            <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain, height: 60, textAlignVertical: 'top' }]} placeholder="例如：钙片要配水吃" value={medForm.remark} onChangeText={t => setMedForm({ ...medForm, remark: t })} multiline />
                        </>)}

                        {activeTab === 'habit' && (
                            <View>
                                <Text style={[styles.label, { color: tc.textMain }]}>习惯名称</Text>
                                <TextInput placeholderTextColor={tc.textSub}style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain }]} placeholder="请输入习惯名称" value={habitForm.name} onChangeText={t => setHabitForm({ ...habitForm, name: t })} />

                                <Text style={[styles.label, { color: tc.textMain }]}>选择图标</Text>
                                <View style={styles.iconGrid}>{habitIcons.map(icon => <TouchableOpacity key={icon} style={[styles.iconItem, { backgroundColor: tc.cardBg }, habitForm.icon === icon && styles.iconItemActive]} onPress={() => setHabitForm({ ...habitForm, icon })}><Text style={{ fontSize: 22 }}>{icon}</Text></TouchableOpacity>)}</View>

                                <Text style={[styles.label, { color: tc.textMain }]}>打卡频次</Text>
                                {renderTagGroup(['每日1次', '每日2次', '隔日', '每周几次', '每天多次'], (showCustomHabitFreq && customHabitFreq) ? customHabitFreq : showCustomHabitFreq ? 'custom' : habitForm.frequency, t => { if (t !== 'custom') { setShowCustomHabitFreq(false); setHabitForm({ ...habitForm, frequency: t }); } }, showCustomHabitFreq, () => setShowCustomHabitFreq(!showCustomHabitFreq), showCustomHabitFreq, customHabitFreq, setCustomHabitFreq, () => { const v = (customHabitFreq || '').trim(); if (v) setHabitForm({ ...habitForm, frequency: v }); setCustomHabitFreq(''); setShowCustomHabitFreq(false); })}

                                <Text style={[styles.label, { color: tc.textMain }]}>打卡期限</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center', backgroundColor: tc.inputBg, borderColor: tc.border }]} onPress={() => setShowStartDatePicker(true)}><Text style={{ color: habitForm.startDate ? tc.textMain : tc.textLight }}>{habitForm.startDate || '开始日期'}</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center', backgroundColor: tc.inputBg, borderColor: tc.border }]} onPress={() => setShowEndDatePicker(true)}><Text style={{ color: habitForm.endDate ? tc.textMain : tc.textLight }}>{habitForm.endDate || '结束日期'}</Text></TouchableOpacity>
                                </View>
                                {showStartDatePicker && <DateTimePicker value={habitForm.startDate ? new Date(habitForm.startDate) : new Date()} mode="date" display="spinner" themeVariant="light" onChange={(e, d) => {
                                    if (Platform.OS === 'android') {
                                        setShowStartDatePicker(false);
                                        if (e.type === 'set' && d) setHabitForm({ ...habitForm, startDate: localDateStr(d) });
                                    } else {
                                        if (d) setHabitForm({ ...habitForm, startDate: localDateStr(d) });
                                        setShowStartDatePicker(false);
                                    }
                                }} />}
                                {showEndDatePicker && <DateTimePicker value={habitForm.endDate ? new Date(habitForm.endDate) : new Date()} mode="date" display="spinner" themeVariant="light" onChange={(e, d) => {
                                    if (Platform.OS === 'android') {
                                        setShowEndDatePicker(false);
                                        if (e.type === 'set' && d) setHabitForm({ ...habitForm, endDate: localDateStr(d) });
                                    } else {
                                        if (d) setHabitForm({ ...habitForm, endDate: localDateStr(d) });
                                        setShowEndDatePicker(false);
                                    }
                                }} />}

                                <Text style={[styles.label, { color: tc.textMain }]}>打卡标签（输入后点“完成”新增）</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                                    <TextInput placeholderTextColor={tc.textSub} style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.textMain, flex: 1 }]} value={newTagInput} onChangeText={setNewTagInput} placeholder="请输入标签内容" />
                                    <TouchableOpacity style={[styles.addTagBtn, { backgroundColor: tc.accent }]} onPress={() => { if (newTagInput.trim() && !habitForm.tags.includes(newTagInput.trim())) { setHabitForm({ ...habitForm, tags: [...habitForm.tags, newTagInput.trim()] }); setNewTagInput(''); } }}><Text style={{ color: tc.accentText, fontWeight: '600' }}>完成</Text></TouchableOpacity>
                                </View>
                                <View style={styles.tagGroup}>
                                    {habitForm.tags.map(tag => (
                                        <TouchableOpacity key={tag} style={styles.tag} onPress={() => setHabitForm({ ...habitForm, tags: habitForm.tags.filter(t => t !== tag) })}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }]}>{tag} ×</Text></TouchableOpacity>
                                    ))}
                                </View>

                                <View style={[styles.row, { marginTop: 10 }]}>
                                    <Text style={[styles.label, { color: tc.textMain }]}>开启快速打卡（跳过标签）</Text>
                                    <TouchableOpacity style={[styles.tag, habitForm.quickCheckIn && styles.tagActive]} onPress={() => setHabitForm({ ...habitForm, quickCheckIn: !habitForm.quickCheckIn })}><Text style={[styles.tagText, { color: tc.isDark ? tc.textMain : tc.textSub }, habitForm.quickCheckIn && styles.tagTextActive]}>{habitForm.quickCheckIn ? '已开启' : '未开启'}</Text></TouchableOpacity>
                                </View>

                                {renderRemindBlock(habitForm, setHabitForm, 'habit', false)}

                                {editHabit && <TouchableOpacity style={styles.deleteHabitBtn} onPress={handleDeleteHabit}><Text style={styles.deleteHabitBtnText}>删除该习惯</Text></TouchableOpacity>}
                            </View>
                        )}
                    </ScrollView>

                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: tc.accent }]} onPress={handleSave}><Text style={[styles.saveBtnText, { color: tc.accentText }]}>保存</Text></TouchableOpacity>
                </View >
            </KeyboardAvoidingView >

            {/* 自定义 Toast 提示 */}
            {
                toastVisible && (
                    <View style={styles.toastOverlay}>
                        <View style={styles.toastBox}>
                            <Text style={styles.toastText}>{toastMsg}</Text>
                        </View>
                    </View>
                )
            }

            {/* 查看更多模板全屏弹窗 */}
            {
                showAllItemTemplates && (
                    <Modal visible transparent animationType="fade" onRequestClose={() => setShowAllItemTemplates(false)}>
                    <View style={styles.templateOverlay}>
                        <TouchableOpacity style={styles.templateOverlayBg} activeOpacity={1} onPress={() => setShowAllItemTemplates(false)} />
                        <View style={[styles.templatePicker, { backgroundColor: tc.modalBg }]}>
                            <Text style={[styles.templatePickerTitle, { color: tc.textMain }]}>所有物品模板</Text>
                            <ScrollView keyboardShouldPersistTaps="handled" style={styles.templatePickerScroll}>
                                <View style={styles.templatePickerGrid}>
                                    {itemTemplates.map((item, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={[styles.templatePickerItem, { backgroundColor: tc.cardBg }, itemCovers.includes(item) && styles.templateItemActive]}
                                            onPress={() => { setItemCovers(prev => [...prev.filter(c => isCoverUri(c)), item]); setShowAllItemTemplates(false); }}
                                        >
                                            <Text style={{ fontSize: 24 }}>{item}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                            <TouchableOpacity onPress={() => setShowAllItemTemplates(false)} style={[styles.templatePickerClose, { backgroundColor: tc.accent }]}>
                                <Text style={[styles.templatePickerCloseText, { color: tc.accentText }]}>关闭</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    </Modal>
                )
            }

            {/* 返回/关闭确认：保存并退出 / 仅退出 / 取消返回 */}
            <Modal visible={exitConfirmVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setExitConfirmVisible(false)}>
                <View style={styles.confirmOverlay}>
                    <View style={[styles.confirmBox, { backgroundColor: tc.modalBg }]}>
                        <Text style={[styles.confirmTitle, { color: tc.textMain }]}>退出{isEditMode ? '编辑' : '添加'}</Text>
                        <Text style={[styles.confirmMsg, { color: tc.textSub }]}>尚未保存的修改将丢失，请选择退出方式</Text>
                        <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: tc.accent }]} onPress={() => { setExitConfirmVisible(false); handleSave(); }}><Text style={{ color: tc.accentText, fontWeight: '600' }}>保存并退出</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: tc.cardSubBg }]} onPress={() => { setExitConfirmVisible(false); if (onClose) onClose(); }}><Text style={{ color: tc.textMain, fontWeight: '600' }}>仅退出</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setExitConfirmVisible(false)}><Text style={{ color: tc.textSub, textAlign: 'center', marginTop: 12 }}>取消</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </Modal >

        <ImageCropModal
            visible={!!cropState}
            uri={cropState ? cropState.uri : null}
            onCancel={() => setCropState(null)}
            onConfirm={async (croppedUri) => {
                if (cropState) {
                    // 拷贝到持久目录，避免 Expo 缓存目录被清理后封面丢失（显示为默认纸盒）
                    const persisted = await persistCoverUri(croppedUri);
                    // 最新添加的排在最前（+ 按钮固定第一位），并去掉旧的 emoji 兜底封面
                    const stripFallback = (list) => list.filter(c => c !== '📦' && c !== '💊');
                    if (cropState.isMed) setMedForm(prev => ({ ...prev, covers: [persisted, ...stripFallback(prev.covers)] }));
                    else setItemCovers(prev => [persisted, ...stripFallback(prev)]);
                }
                setCropState(null);
            }}
        />
        {/* 打卡提醒的时间点选择：新增(-1)或修改某个已存在的时间 */}
        {remindPicker && (
            <DateTimePicker
                value={(() => {
                    const form = remindPicker.scope === 'item' ? itemForm : (remindPicker.scope === 'med' ? medForm : habitForm);
                    const t = (form.remindTimes || [])[remindPicker.index];
                    return t ? new Date('2000-01-01T' + t + ':00') : new Date();
                })()}
                mode="time"
                display="spinner"
                themeVariant="light"
                is24Hour={true}
                onChange={(event, selectedDate) => {
                    const pick = remindPicker;
                    setRemindPicker(null);
                    if (!event || event.type === 'dismissed') return;
                    if (!selectedDate || !pick) return;
                    const h = String(selectedDate.getHours()).padStart(2, '0');
                    const m = String(selectedDate.getMinutes()).padStart(2, '0');
                    applyRemindTime(pick, h + ':' + m);
                }}
            />
        )}
        </>
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
    input: { backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },
    // overflow hidden：横向滑动封面时图片不会溢出可视区（避免滑到“药品封面”标题左侧/超出边界）
    templateScroll: { height: 60, flexGrow: 0, flexShrink: 0, flexDirection: 'row', marginBottom: 10, overflow: 'hidden' },
    templateItem: { width: 60, height: 60, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 2, borderColor: 'transparent' },
    templateItemActive: { borderColor: COLORS.primaryGreen, backgroundColor: COLORS.lightGreen },
    removeCoverBtn: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.pink, justifyContent: 'center', zIndex: 10, elevation: 10, alignItems: 'center' },
    uploadBtn: { paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', marginTop: 5 },
    uploadBtnText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
    tagGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'transparent', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
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
    addTagBtn: { paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', backgroundColor: COLORS.primaryGreen, borderRadius: 12 },
    toastOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
    toastBox: { backgroundColor: 'rgba(50, 50, 50, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
    toastText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    confirmBox: { width: '78%', borderRadius: 16, padding: 20, alignItems: 'stretch' },
    confirmTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
    confirmMsg: { fontSize: 13, textAlign: 'center', marginBottom: 18 },
    confirmBtn: { padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    templateOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end', zIndex: 1000 },
    templateOverlayBg: { ...StyleSheet.absoluteFillObject },
    templatePicker: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
    templatePickerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMain, marginBottom: 15 },
    templatePickerScroll: { maxHeight: '85%' },
    templatePickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingBottom: 20 },
    templatePickerItem: { width: 60, height: 60, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
    templatePickerClose: { backgroundColor: COLORS.primaryGreen, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    templatePickerCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});