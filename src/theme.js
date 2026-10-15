import { Dimensions } from 'react-native';
const { width, height } = Dimensions.get('window');

export const COLORS = {
    bg: '#f7f6f1',
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
    glass: { // 补全这个缺失的样式，App.js 中使用了
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    }
};