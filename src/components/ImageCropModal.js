import React, { useState, useRef, useEffect, useContext } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS, SIZES } from '../theme';
import { AppContext } from '../context/AppContext';

// 首页卡片封面区域的实际宽高比：卡片占行宽 48%、页面左右留白 SIZES.padding、卡片内 padding 12 + 边框 1
const WIN_W = Dimensions.get('window').width;
const HOME_CARD_W = (WIN_W - SIZES.padding * 2) * 0.48;
const HOME_COVER_RATIO = Math.max(0.8, (HOME_CARD_W - 26) / 100);

// 各种模式对应的裁切比例（null = 自由）
const getModeRatio = (m) => (m === 'cover' ? HOME_COVER_RATIO : (m === 'wide' ? 16 / 9 : (m === 'square' ? 1 : null)));

const MIN_BOX = 40;

// 在 contain 显示区域内计算最大内接框（按比例），ratio 为 null 时取全图
const fitBox = (dispW, dispH, ratio) => {
    let w, h;
    if (ratio) {
        const areaRatio = dispW / dispH;
        if (areaRatio > ratio) { h = dispH; w = h * ratio; }
        else { w = dispW; h = w / ratio; }
    } else { w = dispW; h = dispH; }
    return { x: (dispW - w) / 2, y: (dispH - h) / 2, w, h };
};

export default function ImageCropModal({ visible, uri, onCancel, onConfirm }) {
    const { themeColors: tc } = useContext(AppContext);
    const [mode, setMode] = useState('cover'); // cover=16:9 | square=1:1 | free
    const [area, setArea] = useState({ w: 0, h: 0 });
    const [img, setImg] = useState({ w: 0, h: 0 });
    const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });

    const boxRef = useRef(box); boxRef.current = box;
    const areaRef = useRef(area); areaRef.current = area;
    const imgRef = useRef(img); imgRef.current = img;
    const modeRef = useRef(mode); modeRef.current = mode;
    const moveStart = useRef(null);
    const cornerStart = useRef(null);

    // 原图尺寸
    useEffect(() => {
        if (uri) Image.getSize(uri, (w, h) => setImg({ w, h }), () => {});
    }, [uri]);

    // contain 后图片在显示区域内的实际位置（缩放比例 + 居中偏移）
    const getDisp = () => {
        const { w: aw, h: ah } = areaRef.current;
        const { w: iw, h: ih } = imgRef.current;
        if (!aw || !ih) return { x: 0, y: 0, w: 0, h: 0, scale: 1 };
        const scale = Math.min(aw / iw, ah / ih);
        const dispW = iw * scale, dispH = ih * scale;
        return { x: (aw - dispW) / 2, y: (ah - dispH) / 2, w: dispW, h: dispH, scale };
    };

    // 显示区域 / 原图 / 模式变化时重置裁切框
    useEffect(() => {
        if (area.w > 0 && img.w > 0) {
            const d = getDisp();
            const ratio = getModeRatio(mode);
            const fb = fitBox(d.w, d.h, ratio);
            setBox({ x: d.x + fb.x, y: d.y + fb.y, w: fb.w, h: fb.h });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [area, img, mode, uri]);

    const movePan = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
            moveStart.current = { x: boxRef.current.x, y: boxRef.current.y, gx: e.nativeEvent.pageX, gy: e.nativeEvent.pageY };
        },
        onPanResponderMove: (e) => {
            const s = moveStart.current; if (!s) return;
            const b = boxRef.current;
            const d = getDisp();
            const nx = Math.max(d.x, Math.min(d.x + d.w - b.w, s.x + (e.nativeEvent.pageX - s.gx)));
            const ny = Math.max(d.y, Math.min(d.y + d.h - b.h, s.y + (e.nativeEvent.pageY - s.gy)));
            setBox({ ...b, x: nx, y: ny });
        },
        onPanResponderRelease: () => { moveStart.current = null; },
        onPanResponderTerminate: () => { moveStart.current = null; },
    })).current;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    // 四个角分别拖拽缩放：corner 为 tl/tr/bl/br；比例模式按比例缩放，自由模式任意缩放
    const makeCornerPan = (corner) => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
            const b = boxRef.current;
            cornerStart.current = { x: b.x, y: b.y, w: b.w, h: b.h, gx: e.nativeEvent.pageX, gy: e.nativeEvent.pageY, corner, m: modeRef.current };
        },
        onPanResponderMove: (e) => {
            const s = cornerStart.current; if (!s) return;
            const d = getDisp();
            if (!d.w || !d.h) return;
            const dx = e.nativeEvent.pageX - s.gx;
            const dy = e.nativeEvent.pageY - s.gy;
            // 固定不动的对角点
            const isLeft = s.corner === 'tl' || s.corner === 'bl';
            const isTop = s.corner === 'tl' || s.corner === 'tr';
            const anchorX = isLeft ? s.x + s.w : s.x;
            const anchorY = isTop ? s.y + s.h : s.y;
            const ratio = getModeRatio(s.m);

            if (ratio) {
                // 按鼠标位移主轴算宽度，另一轴按比例推导；限制在图片范围内且不小于 MIN_BOX
                const byW = Math.abs(dx) >= Math.abs(dy);
                let nw = byW ? (s.w + (isLeft ? -dx : dx)) : ((s.h + (isTop ? -dy : dy)) * ratio);
                const maxWByX = isLeft ? (anchorX - d.x) : (d.x + d.w - anchorX);
                const maxHByY = isTop ? (anchorY - d.y) : (d.y + d.h - anchorY);
                const maxW = Math.max(MIN_BOX, Math.min(maxWByX, maxHByY * ratio));
                nw = Math.max(MIN_BOX, Math.min(isNaN(nw) ? s.w : nw, maxW));
                const nh = nw / ratio;
                setBox({
                    x: isLeft ? anchorX - nw : anchorX,
                    y: isTop ? anchorY - nh : anchorY,
                    w: nw,
                    h: nh,
                });
            } else {
                let left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
                if (isLeft) left = clamp(s.x + dx, d.x, s.x + s.w - MIN_BOX);
                else right = clamp(s.x + s.w + dx, s.x + MIN_BOX, d.x + d.w);
                if (isTop) top = clamp(s.y + dy, d.y, s.y + s.h - MIN_BOX);
                else bottom = clamp(s.y + s.h + dy, s.y + MIN_BOX, d.y + d.h);
                setBox({ x: left, y: top, w: right - left, h: bottom - top });
            }
        },
        onPanResponderRelease: () => { cornerStart.current = null; },
        onPanResponderTerminate: () => { cornerStart.current = null; },
    });
    const tlPan = useRef(makeCornerPan('tl')).current;
    const trPan = useRef(makeCornerPan('tr')).current;
    const blPan = useRef(makeCornerPan('bl')).current;
    const brPan = useRef(makeCornerPan('br')).current;

    const confirmCrop = async () => {
        const b = boxRef.current;
        const d = getDisp();
        if (!d.scale || b.w <= 0) return;
        // 换算回原图坐标后必须夹进图片范围：四舍五入后哪怕越界 1px，Android 也会把越界部分补成白边（封面上一道白线）
        const iw = imgRef.current.w;
        const ih = imgRef.current.h;
        const originX = Math.max(0, Math.min(iw - 1, Math.round((b.x - d.x) / d.scale)));
        const originY = Math.max(0, Math.min(ih - 1, Math.round((b.y - d.y) / d.scale)));
        const width = Math.max(1, Math.min(iw - originX, Math.round(b.w / d.scale)));
        const height = Math.max(1, Math.min(ih - originY, Math.round(b.h / d.scale)));
        try {
            const result = await ImageManipulator.manipulateAsync(uri, [{ crop: { originX, originY, width, height } }], { compress: 1 });
            onConfirm(result.uri);
        } catch (e) {
            // 裁切失败保持弹窗，用户可重试
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <View style={[styles.panel, { backgroundColor: tc.modalBg }]}>
                    <Text style={[styles.title, { color: tc.textMain }]}>裁切封面</Text>
                    <View style={styles.ratioRow}>
                        {[['cover', '封面'], ['wide', '16:9'], ['square', '1:1'], ['free', '自由']].map(([m, label]) => (
                            <TouchableOpacity key={m} style={[styles.ratioBtn, { backgroundColor: tc.chipBg, borderColor: tc.border }, mode === m && styles.ratioActive]} onPress={() => setMode(m)}>
                                <Text style={[styles.ratioText, { color: tc.textSub }, mode === m && styles.ratioTextActive]}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.imageArea} onLayout={e => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
                        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}
                        {box.w > 0 && area.w > 0 && (
                            <>
                                <View style={[styles.mask, { top: 0, left: 0, right: 0, height: box.y }]} />
                                <View style={[styles.mask, { top: box.y, left: 0, width: box.x, height: box.h }]} />
                                <View style={[styles.mask, { top: box.y, left: box.x + box.w, right: 0, height: box.h }]} />
                                <View style={[styles.mask, { top: box.y + box.h, left: 0, right: 0, bottom: 0 }]} />
                                <View style={[styles.cropBox, { left: box.x, top: box.y, width: box.w, height: box.h }]} {...movePan.panHandlers} />
                                {/* 角柄放在裁剪框外层：子元素超出父容器范围时无法接收触摸，放进去就拖不动 */}
                                <View style={[styles.corner, { left: box.x - 15, top: box.y - 15 }]} {...tlPan.panHandlers} />
                                <View style={[styles.corner, { left: box.x + box.w - 15, top: box.y - 15 }]} {...trPan.panHandlers} />
                                <View style={[styles.corner, { left: box.x - 15, top: box.y + box.h - 15 }]} {...blPan.panHandlers} />
                                <View style={[styles.corner, { left: box.x + box.w - 15, top: box.y + box.h - 15 }]} {...brPan.panHandlers} />
                            </>
                        )}
                    </View>
                    <View style={styles.btnRow}>
                        <TouchableOpacity style={[styles.btn, { backgroundColor: tc.cardSubBg }]} onPress={onCancel}>
                            <Text style={[styles.btnCancelText, { color: tc.labelText }]}>取消</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, { backgroundColor: tc.accent }]} onPress={confirmCrop}>
                            <Text style={[styles.btnConfirmText, { color: tc.accentText }]}>确定</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    panel: { width: '90%', backgroundColor: '#fff', borderRadius: 16, padding: 16 },
    title: { fontSize: 17, fontWeight: '600', color: COLORS.textMain, textAlign: 'center', marginBottom: 12 },
    ratioRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
    ratioBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
    ratioActive: { backgroundColor: COLORS.lightGreen, borderColor: COLORS.primaryGreen },
    ratioText: { fontSize: 13, color: COLORS.textSub },
    ratioTextActive: { color: COLORS.primaryGreen, fontWeight: '600' },
    imageArea: { width: '100%', height: 320, backgroundColor: '#111', borderRadius: 10, overflow: 'hidden' },
    mask: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)' },
    cropBox: { position: 'absolute', borderWidth: 1.5, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.06)' },
    corner: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1.5, borderColor: '#fff', zIndex: 10 },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    btnCancelText: { color: COLORS.textSub, fontWeight: '600' },
    btnConfirmText: { color: '#fff', fontWeight: '600' },
});
