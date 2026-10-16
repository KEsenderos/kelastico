// KElástico  player.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：再生の状態と操作の中心（仕様書 第9章）

const Player = {
  state: KEL.STATE.EMPTY,
  songId: null,
  pitch: KEL.PITCH_DEFAULT,
  speed: KEL.SPEED_DEFAULT,
  position: 0,
  duration: null,
  repeatMode: KEL.REPEAT_DEFAULT,
  loadToken: 0,
  saveTimer: null,
  lastPosStateAt: 0,

  init() {
    const r = Util.lsGet(KEL.LS.REPEAT);
    this.repeatMode = KEL.REPEAT_ORDER.includes(r) ? r : KEL.REPEAT_DEFAULT;
    Engine.onPosition((sec) => this.onPosition_(sec));
    Engine.onEnded(() => this.handleEnded_());
  },

  setState_(s) {
    this.state = s;
    UI.render();
    MediaCtl.setPlaybackState(s);
  },

  hasSong_() {
    const S = KEL.STATE;
    return this.state === S.STOPPED || this.state === S.PLAYING || this.state === S.PAUSED;
  },

  currentSong_() {
    return this.songId ? Library.find(this.songId) : null;
  },

  async selectSong(songId, autoplay) {
    const song = Library.find(songId);
    if (!song) return;
    this.flushSave();
    const token = ++this.loadToken;
    if (this.state === KEL.STATE.PLAYING) Engine.pause();
    this.songId = songId;
    this.position = 0;
    this.duration = song.durationSec;
    this.setState_(KEL.STATE.LOADING);
    Util.lsSet(KEL.LS.LOADING, songId);
    let durationSec;
    try {
      const blob = await Store.getFileBlob(songId);
      if (token !== this.loadToken) return;
      if (!blob) throw new KelError('DECODE');
      const r = await Engine.loadSong(blob);
      durationSec = r.durationSec;
    } catch (e) {
      if (token !== this.loadToken) return;
      Util.lsRemove(KEL.LS.LOADING);
      if (e instanceof KelError) console.warn('[Player] load', e.code); else console.error('[Player] load', e);
      UI.showError(e instanceof KelError ? e : new KelError('DECODE', e), song.name);
      this.songId = null;
      this.duration = null;
      this.position = 0;
      MediaCtl.setMetadata(null);
      this.setState_(KEL.STATE.EMPTY);
      return;
    }
    Util.lsRemove(KEL.LS.LOADING);
    if (token !== this.loadToken) return;

    const now = Date.now();
    song.durationSec = durationSec;
    song.lastPlayedAt = now;
    Store.updateSongMeta(songId, { durationSec, lastPlayedAt: now }).catch((e) => console.warn('[Player] meta', e));
    Util.lsSet(KEL.LS.LAST_SONG, songId);

    this.pitch = song.pitch;
    this.speed = song.speed;
    this.duration = durationSec;
    this.position = 0;
    Engine.setParams(this.pitch, this.speed);
    MediaCtl.setMetadata(song, this.pitch, this.speed);
    this.setState_(KEL.STATE.STOPPED);
    if (autoplay) await this.play();
  },

  clearSong(songId) {
    if (this.songId !== songId) return;
    this.flushSave();
    this.loadToken++;
    Engine.pause();
    Engine.unload();
    Util.lsRemove(KEL.LS.LOADING);
    this.songId = null;
    this.duration = null;
    this.position = 0;
    MediaCtl.setMetadata(null);
    this.setState_(KEL.STATE.EMPTY);
  },

  async play() {
    if (!this.hasSong_()) {
      if (this.state === KEL.STATE.EMPTY) UI.showMessage(TEXT.HINT_NEED_SONG, 'info');
      return;
    }
    MediaCtl.startSilence();
    this.setState_(KEL.STATE.PLAYING);
    try {
      await Engine.play();
    } catch (e) {
      console.error('[Player] play', e);
      UI.showError(e instanceof KelError ? e : new KelError('AUDIO', e));
      this.setState_(KEL.STATE.PAUSED);
    }
  },

  pause() {
    if (this.state !== KEL.STATE.PLAYING) return;
    Engine.pause();
    this.setState_(KEL.STATE.PAUSED);
  },

  togglePlay() {
    if (this.state === KEL.STATE.PLAYING) this.pause();
    else this.play();
  },

  stop() {
    if (!this.hasSong_()) return;
    Engine.pause();
    Engine.seek(0);
    this.position = 0;
    this.setState_(KEL.STATE.STOPPED);
  },

  skip(deltaSec) {
    if (!this.hasSong_()) return;
    this.seekTo(this.position + deltaSec);
  },

  seekTo(sec) {
    if (!this.hasSong_()) return;
    const max = typeof this.duration === 'number' ? this.duration : 0;
    const t = Util.clamp(sec, 0, max);
    this.position = t;
    Engine.seek(t);
    UI.renderPosition();
    MediaCtl.updatePosition(this.position, this.duration, this.speed);
  },

  canNext() {
    if (!this.hasSong_()) return false;
    return Library.nextOf(this.songId, this.repeatMode === KEL.REPEAT.ALL) !== null;
  },

  canPrev() {
    return this.hasSong_();
  },

  next() {
    if (!this.hasSong_()) return;
    const id = Library.nextOf(this.songId, this.repeatMode === KEL.REPEAT.ALL);
    if (!id) return;
    this.selectSong(id, this.state === KEL.STATE.PLAYING);
  },

  prev() {
    if (!this.hasSong_()) return;
    if (this.position > KEL.PREV_RESTART_SEC) { this.seekTo(0); return; }
    const id = Library.prevOf(this.songId, this.repeatMode === KEL.REPEAT.ALL);
    if (!id || id === this.songId) { this.seekTo(0); return; }
    this.selectSong(id, this.state === KEL.STATE.PLAYING);
  },

  changePitch(delta) {
    this.setPitch(this.pitch + delta);
  },

  changeSpeed(delta) {
    this.setSpeed(this.speed + delta);
  },

  setPitch(v) {
    const p = Util.clamp(Math.round(Number(v)), KEL.PITCH_MIN, KEL.PITCH_MAX);
    if (isNaN(p)) return;
    this.pitch = p;
    this.applyParams_();
  },

  setSpeed(v) {
    const s = Util.clamp(Util.roundStep(Number(v), KEL.SPEED_STEP), KEL.SPEED_MIN, KEL.SPEED_MAX);
    if (isNaN(s)) return;
    this.speed = s;
    this.applyParams_();
  },

  resetParams() {
    this.pitch = KEL.PITCH_DEFAULT;
    this.speed = KEL.SPEED_DEFAULT;
    this.applyParams_();
  },

  applyParams_() {
    Engine.setParams(this.pitch, this.speed);
    UI.renderParams();
    if (this.hasSong_()) {
      const song = this.currentSong_();
      if (song) {
        song.pitch = this.pitch;
        song.speed = this.speed;
        MediaCtl.setMetadata(song, this.pitch, this.speed);
      }
      UI.renderList();
      this.saveSettings_();
    }
  },

  saveSettings_() {
    const songId = this.songId;
    const pitch = this.pitch;
    const speed = this.speed;
    clearTimeout(this.saveTimer);
    this.pendingSave = () => {
      this.pendingSave = null;
      Store.updateSongSettings(songId, pitch, speed).catch((e) => console.warn('[Player] save', e));
    };
    this.saveTimer = setTimeout(() => { if (this.pendingSave) this.pendingSave(); }, KEL.SAVE_DEBOUNCE_MS);
  },

  flushSave() {
    clearTimeout(this.saveTimer);
    if (this.pendingSave) this.pendingSave();
  },

  cycleRepeat() {
    const i = KEL.REPEAT_ORDER.indexOf(this.repeatMode);
    this.repeatMode = KEL.REPEAT_ORDER[(i + 1) % KEL.REPEAT_ORDER.length];
    Util.lsSet(KEL.LS.REPEAT, this.repeatMode);
    UI.renderTransport();
  },

  onPosition_(sec) {
    if (this.state !== KEL.STATE.PLAYING) return;
    this.position = sec;
    UI.renderPosition();
    const now = Date.now();
    if (now - this.lastPosStateAt >= KEL.POSITION_STATE_MS) {
      this.lastPosStateAt = now;
      MediaCtl.updatePosition(this.position, this.duration, this.speed);
    }
  },

  handleEnded_() {
    const R = KEL.REPEAT;
    if (this.state !== KEL.STATE.PLAYING) return;
    const nextId = (this.repeatMode === R.LIST || this.repeatMode === R.ALL)
      ? Library.nextOf(this.songId, this.repeatMode === R.ALL) : null;
    if (this.repeatMode === R.ONE || (nextId && nextId === this.songId)) {
      Engine.seek(0);
      this.position = 0;
      Engine.play();
      UI.renderPosition();
      return;
    }
    if (nextId) { this.selectSong(nextId, true); return; }
    Engine.seek(0);
    this.position = 0;
    this.setState_(KEL.STATE.STOPPED);
  }
};
