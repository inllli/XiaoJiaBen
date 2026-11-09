
import { Dimensions } from 'react-native';
const { width, height } = Dimensions.get('window');

export const COLORS = {
    bg: '#f7f6f1', // 默认背景，可在我的页面更换
    cardBg: '#ffffff',
    primaryGreen: '#8eaa8b',
    lightGreen: '#e5efe5',
    orange: '#edb173',
    lightOrange: '#fbeee0',
    pink: '#e79898',
    lightPink: '#fcecec',
    blue: '#6ba3d6',
    lightBlue: '#e6f0fa',
    purple: '#b19cd9',
    lightPurple: '#f0e9fa',
    textMain: '#333333',
    textSub: '#888888',
    textLight: '#b0b0b0',
    white: '#ffffff',
    dotInv: '#e74c3c',
    dotMed: '#9b59b6',
    dotHab: '#3498db',
};

// 新增：调色盘可选背景色（浅色/中性/深色）
export const THEME_COLORS = [
    // 浅色系
    { name: '暖白', value: '#f7f6f1' },
    { name: '冷白', value: '#f5f7fa' },
    { name: '浅粉', value: '#fdf0f0' },
    { name: '浅黄', value: '#fef9e8' },
    { name: '浅蓝', value: '#eef6ff' },
    { name: '浅绿', value: '#eef7f1' },
    { name: '浅紫', value: '#f4f0fa' },
    // 中性色系
    { name: '浅灰', value: '#f0f0f0' },
    { name: '米灰', value: '#efede8' },
    { name: '烟灰', value: '#dcdcdc' },
    { name: '中灰', value: '#c8c8c8' },
    // 深色系
    { name: '深灰', value: '#37474f' },
    { name: '深蓝', value: '#1e3a5f' },
    { name: '墨绿', value: '#2f4f4f' },
    { name: '炭黑', value: '#2b2b2b' },
];

export const SIZES = {
    radius: 16,
    padding: 24,
    cardPadding: 16,
    screenWidth: width,
    screenHeight: height,
};

export const SHADOWS = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 3,
    },
    nav: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 8,
    },
    glass: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    }
};

// 判断背景色是否为深色（感知亮度阈值），用于深色主题下切换文字/卡片/组件配色
export function isDarkColor(hex) {
    if (!hex || typeof hex !== 'string') return false;
    const m = hex.replace('#', '').match(/^([0-9a-fA-F]{6})$/);
    if (!m) return false;
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum < 128;
}

// 把 hex 颜色按比例混向目标色，用于按主题背景派生卡片/填充的层次色
function mixColor(hex, target, ratio) {
    const parse = (s) => [0, 2, 4].map(i => parseInt(s.replace('#', '').slice(i, i + 2), 16));
    const a = parse(hex);
    const b = parse(target);
    const out = a.map((v, i) => Math.round(v + (b[i] - v) * ratio));
    return '#' + out.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

// 默认暖白与中性灰主题：卡片用浅灰/白卡、填充用纯白；其余主题卡片跟随背景色系
const PLAIN_THEME_BGS = ['#f7f6f1', '#f0f0f0', '#efede8', '#dcdcdc', '#c8c8c8'];
const DEFAULT_THEME_BG = '#f7f6f1';
// 调色盘预设色：这 15 套配色的派生结果不允许变动
const PRESET_THEME_BGS = THEME_COLORS.map(c => String(c.value).toLowerCase());

// 依据背景色明暗派生整套页面配色（字体/卡片/输入框/弹窗/组件），浅色主题沿用现有 COLORS
export function getThemeColors(bg) {
    const rawBg = String(bg || DEFAULT_THEME_BG);
    const dark = isDarkColor(rawBg);
    const lowerBg = rawBg.toLowerCase();
    const isPlain = PLAIN_THEME_BGS.includes(lowerBg);
    const isDefault = lowerBg === DEFAULT_THEME_BG;
    // 自定义深色：背景就是所选色，配套色全部按它的色相派生（不用固定的深灰/近黑），
    // 避免红底配黑框的割裂感；预设深色仍走原来的固定深色模板
    const customDark = dark && !PRESET_THEME_BGS.includes(lowerBg);
    return {
        isDark: dark,
        bg: rawBg,
        // 文字
        textMain: dark ? (customDark ? '#f7f5f4' : '#e8eaed') : COLORS.textMain,
        textSub: dark ? (customDark ? mixColor(rawBg, '#ffffff', 0.62) : '#9aa0a6') : COLORS.textSub,
        textLight: dark ? (customDark ? mixColor(rawBg, '#ffffff', 0.40) : '#6b7076') : COLORS.textLight,
        // 卡片与面板：默认暖白 = 纯白卡（首页另用 homeCardBg 米白一档）；灰色 = 浅灰卡；
        // 彩色浅色 = 背景同色系浅两档；深色 = 背景同色系浅一档（自定义深色更亮一档，保证卡片有层次）
        cardBg: dark ? mixColor(rawBg, '#ffffff', customDark ? 0.18 : 0.12) : (isDefault ? '#ffffff' : (isPlain ? '#f0f0f0' : mixColor(rawBg, '#ffffff', 0.55))),
        // 首页卡片专用：默认暖白下比纯白深一点点（米白），不是浅灰；其余主题与 cardBg 一致
        homeCardBg: dark ? mixColor(rawBg, '#ffffff', customDark ? 0.18 : 0.12) : (isDefault ? mixColor(rawBg, '#ffffff', 0.35) : (isPlain ? '#f0f0f0' : mixColor(rawBg, '#ffffff', 0.55))),
        cardSubBg: dark ? (customDark ? mixColor(rawBg, '#000000', 0.16) : mixColor(rawBg, '#ffffff', 0.06)) : (isPlain ? COLORS.bg : mixColor(rawBg, '#000000', 0.06)),
        // 深色边框跟随背景色系提亮，不再用黑色系；浅色自定义（橙/黄等高饱和底）用背景压暗一档，
        // 否则固定浅灰边压在橙底上等于没有边；预设浅色仍保持原来的 #e8e8e8
        border: dark ? mixColor(rawBg, '#ffffff', customDark ? 0.30 : 0.22) : (PRESET_THEME_BGS.includes(lowerBg) ? '#e8e8e8' : mixColor(rawBg, '#000000', 0.18)),
        // 输入与弹窗：自定义深色的输入框取背景暗一档的同色，而不是固定的近黑
        inputBg: dark ? (customDark ? mixColor(rawBg, '#000000', 0.24) : '#2b2e33') : '#ffffff',
        modalBg: dark ? mixColor(rawBg, '#ffffff', customDark ? 0.12 : 0.18) : mixColor(rawBg, '#ffffff', 0.55),
        overlay: dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)',
        // 状态面板：自定义深色下改取同色系偏黄/深红/偏绿，保证在饱和背景上仍可区分
        warnBg: dark ? (customDark ? mixColor(rawBg, '#ffb74d', 0.60) : '#4a3a28') : COLORS.lightOrange,
        dangerBg: dark ? (customDark ? mixColor(rawBg, '#000000', 0.30) : '#4a2a2a') : COLORS.lightPink,
        okBg: dark ? (customDark ? mixColor(rawBg, '#7fd18e', 0.55) : '#2c3a30') : COLORS.lightGreen,
        // 已用完卡片：明显偏灰一档（区别于普通卡，也不能与页面背景同色）
        emptyBg: dark ? (customDark ? mixColor(rawBg, '#000000', 0.40) : '#25282c') : '#d4d3cf',
        // 封面图填充底（第三层）：默认/灰 = 纯白；彩色浅色 = 背景同色系浅三档（近白）；
        // 深色统一在卡片上叠7%白（比卡片再亮一档），随卡片色相走，与四状态色均不冲突
        coverBg: dark ? 'rgba(255,255,255,0.07)' : (isPlain ? '#ffffff' : mixColor(rawBg, '#ffffff', 0.80)),
        chipBg: dark ? (customDark ? mixColor(rawBg, '#ffffff', 0.14) : '#3a3d43') : '#ffffff',
        // 强调色（选中态 chip / 主按钮）：自定义深色取比背景亮一档的同色；自定义浅色（橙/黄等）
        // 取背景压暗一档的同色，配白字，避免固定主绿压在橙底上不配套；预设色仍返回原主绿
        accent: customDark ? mixColor(rawBg, '#ffffff', 0.30) : (PRESET_THEME_BGS.includes(lowerBg) ? COLORS.primaryGreen : mixColor(rawBg, '#000000', 0.28)),
        accentText: customDark ? mixColor(rawBg, '#000000', 0.62) : '#ffffff',
        // 底部导航栏底色：自定义深色取背景暗一档的同色，避免深灰灰条割裂
        navBg: dark ? (customDark ? mixColor(rawBg, '#000000', 0.22) : 'rgba(52, 55, 60, 0.96)') : 'rgba(255, 255, 255, 0.95)',
        // 次级说明文字（记录详情、图例、弹窗取消按钮）：预设浅色沿用原灰字（观感不变），
        // 深色与自定义色改用主文字色，否则灰字压在饱和底色上几乎看不清
        labelText: (!dark && PRESET_THEME_BGS.includes(lowerBg)) ? COLORS.textSub : (dark ? (customDark ? '#f7f5f4' : '#e8eaed') : COLORS.textMain),
    };
}