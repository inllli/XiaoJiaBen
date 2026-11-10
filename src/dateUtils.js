// 统一用本地时区拼 YYYY-MM-DD。
// toISOString() 是 UTC：在 UTC+8 的 0:00-8:00 之间取日期会得到「昨天」，
// 导致早上打开 App 时日历选中昨天、补货/打卡记录也写到昨天。
export const localDateStr = (d = new Date()) => {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};
