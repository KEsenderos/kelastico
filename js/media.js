// KElástico  media.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：ロック画面・イヤホンのボタン、無音のaudio要素（仕様書 第10章）

const MediaCtl = {
  silenceEl: null,
  silenceStarted: false,
  lastToggleAt: 0,

  init() {
    this.silenceEl = document.getElementById('kelSilence');
    if (this.silenceEl) this.silenceEl.src = Util.makeSilentWavUrl();
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) { /* 未対応なら何もしない */ }

    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action, fn) => {
      try { ms.setActionHandler(action, fn); } catch (e) { /* 未対応の操作は無視 */ }
    };
    set('play', () => this.handleToggle_());
    set('pause', () => this.handleToggle_());
    set('stop', () => this.handleToggle_());
    set('seekbackward', () => Player.skip(-KEL.SKIP_SEC));
    set('seekforward', () => Player.skip(KEL.SKIP_SEC));
    set('previoustrack', () => Player.prev());
    set('nexttrack', () => Player.next());
    set('seekto', (d) => { if (d && typeof d.seekTime === 'number') Player.seekTo(d.seekTime); });
  },

  startSilence() {
    if (this.silenceStarted || !this.silenceEl) return;
    try {
      const p = this.silenceEl.play();
      this.silenceStarted = true;
      if (p && p.catch) p.catch((e) => { this.silenceStarted = false; console.warn('[MediaCtl] silence', e); });
    } catch (e) {
      this.silenceStarted = false;
      console.warn('[MediaCtl] silence', e);
    }
  },

  setMetadata(song, pitch, speed) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    if (!song) { navigator.mediaSession.metadata = null; return; }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: Util.stripExt(song.name),
        artist: Util.fill(TEXT.SETTING_BADGE, { p: Util.formatPitch(pitch), s: Number(speed).toFixed(2) }),
        album: TEXT.APP_TITLE,
        artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
      });
    } catch (e) { /* 無視 */ }
  },

  setPlaybackState(state) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state === KEL.STATE.PLAYING ? 'playing' : 'paused';
    } catch (e) { /* 無視 */ }
  },

  updatePosition(pos, duration, speed) {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (typeof duration !== 'number' || !isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Util.clamp(pos || 0, 0, duration),
        playbackRate: speed
      });
    } catch (e) { /* 無視 */ }
  },

  handleToggle_() {
    const now = Date.now();
    if (now - this.lastToggleAt < KEL.HEADSET_DEBOUNCE_MS) return;
    this.lastToggleAt = now;
    const S = KEL.STATE;
    if (Player.state === S.PLAYING) Player.pause();
    else if (Player.state === S.STOPPED || Player.state === S.PAUSED) Player.play();
  }
};
