// KElástico  util.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：小さな共通処理（仕様書 第11章）

const Util = {
  fill(text, obj) {
    return String(text).replace(/\{(\w+)\}/g, (m, k) => (obj && obj[k] !== undefined ? String(obj[k]) : m));
  },

  formatTime(sec) {
    if (typeof sec !== 'number' || !isFinite(sec) || sec < 0) return '--:--';
    const t = Math.floor(sec);
    const m = Math.floor(t / 60);
    const s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  },

  formatPitch(n) {
    if (n === 0) return '±0';
    return n > 0 ? '+' + n : '−' + Math.abs(n);
  },

  formatSpeed(x) {
    return Number(x).toFixed(2) + '倍';
  },

  clamp(x, min, max) {
    return Math.min(max, Math.max(min, x));
  },

  roundStep(x, step) {
    return Number((Math.round(x / step) * step).toFixed(2));
  },

  makeSongId(name, size) {
    return name + '|' + size;
  },

  stripExt(name) {
    const i = String(name).lastIndexOf('.');
    return i > 0 ? name.slice(0, i) : name;
  },

  getExt(name) {
    const i = String(name).lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
  },

  makeSilentWavUrl() {
    const sr = 8000, n = sr, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  },

  lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },

  lsSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* 保存できなくても続ける */ }
  },

  lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* 続ける */ }
  },

  debounce(fn, ms) {
    let timer = null;
    const d = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn(...args); }, ms);
    };
    d.flush = () => {
      if (timer !== null) { clearTimeout(timer); timer = null; fn(); }
    };
    return d;
  }
};
