import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [inventory, setInventory] = useState([]);
    const [habits, setHabits] = useState([]);
    const [calendarData, setCalendarData] = useState({});
    const [customOptions, setCustomOptions] = useState({
        categories: ['食品', '日用品', '洗护', '其他'],
        units: ['盒', '瓶', '袋', '个', '件', '把'],
        locations: ['冰箱', '储物柜', '阳台'],
    });

    const [toastMsg, setToastMsg] = useState('');
    const [toastVisible, setToastVisible] = useState(false);

    const showToast = (msg) => {
        setToastMsg(msg);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const savedInventory = await AsyncStorage.getItem('inventory');
                const savedHabits = await AsyncStorage.getItem('habits');
                const savedCalendar = await AsyncStorage.getItem('calendarData');
                const savedOptions = await AsyncStorage.getItem('customOptions');
                if (savedInventory) setInventory(JSON.parse(savedInventory));
                if (savedHabits) setHabits(JSON.parse(savedHabits));
                if (savedCalendar) setCalendarData(JSON.parse(savedCalendar));
                if (savedOptions) setCustomOptions(JSON.parse(savedOptions));
            } catch (e) { console.log('Load error:', e); }
        };
        loadData();
    }, []);

    const saveData = async (newInv, newHabits, newCal, newOpts = customOptions) => {
        try {
            await AsyncStorage.setItem('inventory', JSON.stringify(newInv));
            await AsyncStorage.setItem('habits', JSON.stringify(newHabits));
            await AsyncStorage.setItem('calendarData', JSON.stringify(newCal));
            await AsyncStorage.setItem('customOptions', JSON.stringify(newOpts));
        } catch (e) { console.log('Save error:', e); }
    };

    const addCustomOption = (type, value) => {
        if (!value.trim()) return;
        const newOptions = { ...customOptions };
        if (!newOptions[type].includes(value.trim())) {
            newOptions[type].push(value.trim());
            setCustomOptions(newOptions);
            saveData(inventory, habits, calendarData, newOptions);
        }
    };

    const getItemStatus = (item) => {
        if (item.stock <= (parseFloat(item.threshold) || 1)) return 'warn';
        if (item.noExpire || !item.expireDate) return 'ok';
        const today = new Date();
        const expire = new Date(item.expireDate);
        const diffDays = Math.ceil((expire - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= (parseInt(item.expireDays) || 5)) return 'danger';
        return 'ok';
    };

    const addLog = (category, text, sub, itemName) => {
        const today = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const record = { id: Date.now().toString(), time: timeStr, text, sub, category, item: itemName };
        const newCalendarData = { ...calendarData };
        if (!newCalendarData[today]) newCalendarData[today] = [];
        newCalendarData[today].unshift(record);
        setCalendarData(newCalendarData);
        saveData(inventory, habits, newCalendarData);
    };

    const removeLog = (date, recordId) => {
        const newCalendarData = { ...calendarData };
        if (newCalendarData[date]) {
            newCalendarData[date] = newCalendarData[date].filter(r => r.id !== recordId);
            if (newCalendarData[date].length === 0) delete newCalendarData[date];
        }
        setCalendarData(newCalendarData);
        saveData(inventory, habits, newCalendarData);
        showToast('记录已删除');
    };

    const addItem = async (item) => {
        const newItem = { ...item, id: Date.now().toString() };
        const newInventory = [...inventory, newItem];
        setInventory(newInventory);
        saveData(newInventory, habits, calendarData);
        addLog('inventory', `新增物品 ${item.name}`, `初始库存：${item.stock}${item.unit}`, item.name);
        showToast('添加成功');
    };

    const editItem = async (itemId, updatedData) => {
        const newInventory = inventory.map(item => item.id === itemId ? { ...item, ...updatedData } : item);
        setInventory(newInventory);
        saveData(newInventory, habits, calendarData);
        addLog('inventory', `修改物品 ${updatedData.name}`, `库存变动`, updatedData.name);
        showToast('修改成功');
    };

    const deleteItem = async (itemId) => {
        const item = inventory.find(i => i.id === itemId);
        const newInventory = inventory.filter(i => i.id !== itemId);
        setInventory(newInventory);
        saveData(newInventory, habits, calendarData);
        addLog('inventory', `删除物品 ${item.name}`, `已清理库存`, item.name);
        showToast('删除成功');
    };

    const updateStock = (itemId, amount, itemName, unit) => {
        if (amount === 0) return;
        const newInventory = inventory.map(item => {
            if (item.id === itemId) return { ...item, stock: Math.max(0, item.stock + amount) };
            return item;
        });
        const action = amount > 0 ? '补货了' : '消耗了';
        setInventory(newInventory);
        addLog('inventory', `${action} ${Math.abs(amount)}${unit} ${itemName}`, `剩余库存：${newInventory.find(i => i.id === itemId).stock}${unit}`, itemName);
        saveData(newInventory, habits, calendarData);
        showToast(`${action} ${Math.abs(amount)}${unit}`);
    };

    const addHabit = (habit) => {
        const newHabit = { ...habit, id: Date.now().toString() };
        const newHabits = [...habits, newHabit];
        setHabits(newHabits);
        saveData(inventory, newHabits, calendarData);
        showToast('习惯添加成功');
    };

    const editHabit = (habitId, updatedData) => {
        const newHabits = habits.map(h => h.id === habitId ? { ...h, ...updatedData } : h);
        setHabits(newHabits);
        saveData(inventory, newHabits, calendarData);
        showToast('习惯修改成功');
    };

    const deleteHabit = async (habitId) => {
        const newHabits = habits.filter(h => h.id !== habitId);
        setHabits(newHabits);
        saveData(inventory, newHabits, calendarData);
        showToast('习惯已删除');
    };

    const addHabitRecord = (habitName, tags = '', customTime = null) => {
        const text = `完成 ${habitName} 打卡`;
        const sub = tags ? `标签：${tags}` : '快速打卡';
        const today = new Date().toISOString().split('T')[0];
        const timeStr = customTime || new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const record = { id: Date.now().toString(), time: timeStr, text, sub, category: 'habit', item: habitName };

        const newCalendarData = { ...calendarData };
        if (!newCalendarData[today]) newCalendarData[today] = [];
        newCalendarData[today].unshift(record);
        setCalendarData(newCalendarData);
        saveData(inventory, habits, newCalendarData);
        showToast(`${habitName} 打卡成功`);
    };

    // 补全药品打卡，自动扣减库存
    const addMedicineCheckInRecord = (medName, dose, unit, customTime = null, note = '') => {
        const today = new Date().toISOString().split('T')[0];
        const timeStr = customTime || new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const record = { id: Date.now().toString(), time: timeStr, text: `服用了 ${medName}`, sub: `剂量：${dose}${unit} ${note}`, category: 'medicine', item: medName };

        const newInventory = inventory.map(item => {
            if (item.name === medName && item.category === '药品') {
                return { ...item, stock: Math.max(0, item.stock - parseFloat(dose)) };
            }
            return item;
        });

        const newCalendarData = { ...calendarData };
        if (!newCalendarData[today]) newCalendarData[today] = [];
        newCalendarData[today].unshift(record);

        setInventory(newInventory);
        setCalendarData(newCalendarData);
        saveData(newInventory, habits, newCalendarData);
        showToast(`${medName} 打卡成功`);
    };

    const clearAllData = async () => {
        setInventory([]); setHabits([]); setCalendarData({});
        setCustomOptions({ categories: ['食品', '日用品', '洗护', '其他'], units: ['盒', '瓶', '袋', '个', '件', '把'], locations: ['冰箱', '储物柜', '阳台'] });
        await AsyncStorage.clear();
        showToast('已恢复出厂设置');
    };

    const exportData = async () => {
        try {
            const data = { inventory, habits, calendarData, customOptions };
            const fileName = `XiaoJiaBen_Backup_${new Date().getTime()}.json`;
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data));
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: '导出小家本备份' });
            } else { showToast('文件已保存到应用沙盒'); }
        } catch (e) { showToast('导出失败: ' + e.message); }
    };

    // 终极修复版：使用 fetch + fileCopyUri 读取外部文件
    const importData = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (!result.canceled) {
                const fileUri = result.assets[0].fileCopyUri || result.assets[0].uri;
                const response = await fetch(fileUri);
                const fileContent = await response.text();

                const data = JSON.parse(fileContent);

                if (data.inventory && data.calendarData) {
                    setInventory(data.inventory);
                    setHabits(data.habits || []);
                    setCalendarData(data.calendarData);
                    if (data.customOptions) setCustomOptions(data.customOptions);
                    saveData(data.inventory, data.habits || [], data.calendarData, data.customOptions);
                    showToast('恢复成功！');
                } else {
                    showToast('文件格式不正确，请确认是本App导出的备份文件');
                }
            }
        } catch (e) {
            console.log('Import error:', e);
            showToast('导入失败: ' + e.message);
        }
    };

    return (
        <AppContext.Provider value={{
            inventory, habits, calendarData, customOptions, toastMsg, toastVisible,
            addItem, editItem, deleteItem, updateStock, addHabit, editHabit, deleteHabit,
            addHabitRecord, addMedicineCheckInRecord, removeLog, addCustomOption, clearAllData, exportData, importData, getItemStatus
        }}>
            {children}
        </AppContext.Provider>
    );
};