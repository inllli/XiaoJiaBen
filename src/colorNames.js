// 常用颜色名 → 色值，用于「查颜色名」快速选色（自定义背景色）
// 只收录色值公认、日常叫法稳定的颜色，避免「雾霾蓝」「莫兰迪」这类主观命名的争议
export const COLOR_NAMES = [
    { name: '米白', en: 'off white', value: '#F7F6F1' },
    { name: '象牙白', en: 'ivory', value: '#FFFFF0' },
    { name: '奶白', en: 'cream white', value: '#FFFDF0' },
    { name: '米色', en: 'beige', value: '#F5F5DC' },
    { name: '杏仁', en: 'almond', value: '#EED9C4' },
    { name: '卡其', en: 'khaki', value: '#C3B091' },
    { name: '驼色', en: 'camel', value: '#C19A6B' },
    { name: '奶茶', en: 'milk tea', value: '#CBB59F' },
    { name: '奶咖', en: 'latte', value: '#C8A89A' },
    { name: '浅灰', en: 'light gray', value: '#D9D9D9' },
    { name: '银灰', en: 'silver', value: '#C0C0C0' },
    { name: '烟灰', en: 'smoke gray', value: '#8A8A8A' },
    { name: '石板灰', en: 'slate gray', value: '#708090' },
    { name: '深灰', en: 'dark gray', value: '#4F4F4F' },
    { name: '炭灰', en: 'charcoal', value: '#36454F' },
    { name: '黑', en: 'black', value: '#1A1A1A' },
    { name: '浅粉', en: 'light pink', value: '#FFD9E3' },
    { name: '樱花粉', en: 'sakura pink', value: '#FFB7C5' },
    { name: '藕粉', en: 'lotus pink', value: '#E8C4C4' },
    { name: '玫瑰粉', en: 'rose pink', value: '#F7CAC9' },
    { name: '豆沙粉', en: 'bean paste pink', value: '#D8A3A9' },
    { name: '桃粉', en: 'peach pink', value: '#FFC4B8' },
    { name: '珊瑚粉', en: 'coral pink', value: '#F88379' },
    { name: '浅橙', en: 'light orange', value: '#FFD8B1' },
    { name: '杏色', en: 'apricot', value: '#FBCFA4' },
    { name: '蜜桃', en: 'peach', value: '#FFCBA4' },
    { name: '珊瑚橙', en: 'coral orange', value: '#FF7F50' },
    { name: '橙', en: 'orange', value: '#FFA500' },
    { name: '琥珀', en: 'amber', value: '#FFBF00' },
    { name: '浅黄', en: 'light yellow', value: '#FFF9C4' },
    { name: '鹅黄', en: 'goose yellow', value: '#FFF3A3' },
    { name: '柠檬黄', en: 'lemon yellow', value: '#FFF44F' },
    { name: '奶黄', en: 'custard yellow', value: '#FFE9A8' },
    { name: '香槟', en: 'champagne', value: '#F7E7CE' },
    { name: '金', en: 'gold', value: '#FFD700' },
    { name: '浅绿', en: 'light green', value: '#D9F0D2' },
    { name: '薄荷绿', en: 'mint green', value: '#A8E6CF' },
    { name: '豆绿', en: 'bean green', value: '#B9C98A' },
    { name: '橄榄绿', en: 'olive green', value: '#808000' },
    { name: '抹茶', en: 'matcha', value: '#C5D8A4' },
    { name: '草绿', en: 'grass green', value: '#86B84A' },
    { name: '森林绿', en: 'forest green', value: '#228B22' },
    { name: '墨绿', en: 'ink green', value: '#1F3D33' },
    { name: '湖蓝', en: 'lake blue', value: '#7FC8D8' },
    { name: '天蓝', en: 'sky blue', value: '#87CEEB' },
    { name: '雾霾蓝', en: 'haze blue', value: '#A8B8C8' },
    { name: '灰蓝', en: 'gray blue', value: '#8CA0B3' },
    { name: '浅蓝', en: 'light blue', value: '#ADD8E6' },
    { name: '婴儿蓝', en: 'baby blue', value: '#BCD4E6' },
    { name: '牛仔蓝', en: 'denim blue', value: '#5A7D9A' },
    { name: '海蓝', en: 'sea blue', value: '#006994' },
    { name: '宝蓝', en: 'royal blue', value: '#4169E1' },
    { name: '藏青', en: 'navy', value: '#2B3A55' },
    { name: '浅紫', en: 'light purple', value: '#E6E6FA' },
    { name: '薰衣草', en: 'lavender', value: '#B57EDC' },
    { name: '丁香紫', en: 'lilac', value: '#C8A2C8' },
    { name: '紫罗兰', en: 'violet', value: '#8F7FD0' },
    { name: '梅子', en: 'plum', value: '#8E4585' },
    { name: '酒红', en: 'wine red', value: '#722F37' },
    { name: '砖红', en: 'brick red', value: '#B23A48' },
    { name: '陶土', en: 'terracotta', value: '#C97B5A' },
    { name: '正红', en: 'red', value: '#E53935' },
    { name: '朱红', en: 'vermilion', value: '#E34234' },
    { name: '番茄红', en: 'tomato red', value: '#FF6347' },
    { name: '豆沙', en: 'bean paste', value: '#A26769' },
    { name: '咖啡', en: 'coffee', value: '#6F4E37' },
    { name: '栗', en: 'chestnut', value: '#8B5A2B' },
    { name: '巧克力', en: 'chocolate', value: '#7B3F00' },
    { name: '可可', en: 'cocoa', value: '#6B4423' },
];

// 按颜色名 / 英文名 / 精确色值检索，返回最多 limit 条
export function searchColorNames(query, limit = 8) {
    const q = String(query || '').trim();
    if (!q) return [];
    const lower = q.toLowerCase();
    return COLOR_NAMES.filter(c =>
        c.name.includes(q) ||
        c.en.includes(lower) ||
        c.value.toLowerCase() === lower
    ).slice(0, limit);
}

// 色块上的文字该用深色还是浅色：按亮度阈值判断
export function contrastText(hex) {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return '#333333';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#333333' : '#FFFFFF';
}
