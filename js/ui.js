// KElástico  ui.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：画面の表示とボタンの受付（仕様書 第7章）

const UI = {
  el: {},
  seekDragging: false,
  posFramePending: false,
  msgTimer: null,
  deleteArmed: {},
  addEnabled: true,

  ICON_UP: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6l7 9H5z"/></svg>',
  ICON_DOWN: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18l7-9H5z"/></svg>',

  init() {
    const ids = ['appTitle', 'appVersion', 'msgArea', 'updateBanner', 'nowTitle', 'seekBar', 'timeCur', 'timeTotal',
      'btnPrev', 'btnBack', 'btnPlay', 'btnFwd', 'btnNext', 'iconPlay', 'iconPause',
      'btnStop', 'btnStopLabel', 'btnRepeat', 'btnReset',
      'pitchLabel', 'btnPitchDown', 'pitchValue', 'btnPitchUp', 'pitchSlider',
      'speedLabel', 'btnSpeedDown', 'speedValue', 'btnSpeedUp', 'speedSlider',
      'listTitle', 'btnAdd', 'fileInput', 'listEmpty', 'songList'];
    ids.forEach((id) => { this.el[id] = document.getElementById(id); });
    const e = this.el;

    e.appTitle.textContent = TEXT.APP_TITLE;
    e.appVersion.textContent = Util.fill(TEXT.VERSION, { v: KEL.APP_VERSION });
    e.btnStopLabel.textContent = TEXT.BTN_STOP;
    e.btnReset.textContent = TEXT.BTN_RESET;
    e.btnAdd.textContent = TEXT.BTN_ADD;
    e.pitchLabel.textContent = TEXT.LABEL_PITCH;
    e.speedLabel.textContent = TEXT.LABEL_SPEED;
    e.listEmpty.textContent = TEXT.LIST_EMPTY;
    e.updateBanner.textContent = TEXT.UPDATE_BANNER;
    e.fileInput.accept = KEL.ACCEPT_TYPES;

    const aria = [['btnPrev', TEXT.ARIA_PREV], ['btnBack', TEXT.ARIA_BACK], ['btnFwd', TEXT.ARIA_FWD],
      ['btnNext', TEXT.ARIA_NEXT], ['btnPitchDown', TEXT.ARIA_PITCH_DOWN], ['btnPitchUp', TEXT.ARIA_PITCH_UP],
      ['btnSpeedDown', TEXT.ARIA_SPEED_DOWN], ['btnSpeedUp', TEXT.ARIA_SPEED_UP], ['seekBar', TEXT.ARIA_SEEK],
      ['pitchSlider', TEXT.LABEL_PITCH], ['speedSlider', TEXT.LABEL_SPEED]];
    aria.forEach(([id, t]) => e[id].setAttribute('aria-label', t));

    e.pitchSlider.min = KEL.PITCH_MIN;
    e.pitchSlider.max = KEL.PITCH_MAX;
    e.pitchSlider.step = KEL.PITCH_STEP;
    e.speedSlider.min = KEL.SPEED_MIN;
    e.speedSlider.max = KEL.SPEED_MAX;
    e.speedSlider.step = KEL.SPEED_STEP;

    ['btnPrev', 'btnBack', 'btnPlay', 'btnFwd', 'btnNext', 'btnStop', 'btnRepeat', 'btnReset',
      'btnPitchDown', 'btnPitchUp', 'btnSpeedDown', 'btnSpeedUp', 'btnAdd'].forEach((id) => this.bindPress_(e[id]));

    e.btnPlay.addEventListener('click', () => Player.togglePlay());
    e.btnStop.addEventListener('click', () => Player.stop());
    e.btnBack.addEventListener('click', () => Player.skip(-KEL.SKIP_SEC));
    e.btnFwd.addEventListener('click', () => Player.skip(KEL.SKIP_SEC));
    e.btnPrev.addEventListener('click', () => Player.prev());
    e.btnNext.addEventListener('click', () => Player.next());
    e.btnRepeat.addEventListener('click', () => Player.cycleRepeat());
    e.btnReset.addEventListener('click', () => Player.resetParams());
    e.btnPitchDown.addEventListener('click', () => Player.changePitch(-KEL.PITCH_STEP));
    e.btnPitchUp.addEventListener('click', () => Player.changePitch(KEL.PITCH_STEP));
    e.btnSpeedDown.addEventListener('click', () => Player.changeSpeed(-KEL.SPEED_STEP));
    e.btnSpeedUp.addEventListener('click', () => Player.changeSpeed(KEL.SPEED_STEP));
    e.pitchSlider.addEventListener('input', () => Player.setPitch(e.pitchSlider.value));
    e.speedSlider.addEventListener('input', () => Player.setSpeed(e.speedSlider.value));

    e.seekBar.addEventListener('input', () => {
      this.seekDragging = true;
      this.setFill_(e.seekBar);
      e.timeCur.textContent = Util.formatTime(Number(e.seekBar.value));
    });
    e.seekBar.addEventListener('change', () => {
      this.seekDragging = false;
      Player.seekTo(Number(e.seekBar.value));
    });

    e.btnAdd.addEventListener('click', () => {
      if (!this.addEnabled) return;
      e.fileInput.value = '';
      e.fileInput.click();
    });
    e.fileInput.addEventListener('change', async () => {
      const files = e.fileInput.files;
      if (!files || !files.length) return;
      const r = await Library.addFiles(files);
      e.fileInput.value = '';
      this.renderList();
      this.renderTransport();
      const lines = r.errors.map((err) => this.errorText(err));
      if (lines.length) this.showMessage((r.added ? Util.fill(TEXT.INFO_ADDED, { n: r.added }) + '\n' : '') + lines.join('\n'), 'error');
      else if (r.added) this.showMessage(Util.fill(TEXT.INFO_ADDED, { n: r.added }), 'info');
    });

    e.msgArea.addEventListener('click', () => {
      if (e.msgArea.classList.contains('error')) this.hideMessage();
    });
    e.updateBanner.addEventListener('click', () => location.reload());

    e.songList.addEventListener('click', (ev) => this.onListClick_(ev));
  },

  setAddEnabled(on) {
    this.addEnabled = on;
    this.el.btnAdd.disabled = !on;
  },

  onListClick_(ev) {
    const row = ev.target.closest('li.song-row');
    if (!row) return;
    const songId = row.dataset.songId;
    const btn = ev.target.closest('button');
    if (btn) {
      ev.stopPropagation();
      if (btn.disabled) return;
      if (btn.classList.contains('btn-up')) Library.moveUp(songId);
      else if (btn.classList.contains('btn-down')) Library.moveDown(songId);
      else if (btn.classList.contains('btn-delete')) this.onDelete_(songId, btn);
      return;
    }
    Player.selectSong(songId, true);
  },

  onDelete_(songId, btn) {
    if (this.deleteArmed[songId]) {
      clearTimeout(this.deleteArmed[songId]);
      delete this.deleteArmed[songId];
      Library.remove(songId).then(() => {
        this.renderList();
        this.renderTransport();
      });
      return;
    }
    this.deleteArmed[songId] = setTimeout(() => {
      delete this.deleteArmed[songId];
      this.renderList();
    }, KEL.DELETE_CONFIRM_MS);
    btn.textContent = TEXT.BTN_DELETE_CONFIRM;
    btn.classList.add('armed');
  },

  setFill_(el) {
    if (!el) return;
    const min = Number(el.min), max = Number(el.max), v = Number(el.value);
    const pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
    el.style.setProperty('--fill', Util.clamp(pct, 0, 100).toFixed(2) + '%');
  },

  bindPress_(el) {
    if (!el) return;
    let at = 0;
    let timer = null;
    el.addEventListener('pointerdown', () => {
      if (el.disabled) return;
      clearTimeout(timer);
      at = Date.now();
      el.classList.add('pressed');
    });
    const release = () => {
      const left = Math.max(0, KEL.PRESS_HOLD_MS - (Date.now() - at));
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('pressed'), left);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  },

  render() {
    this.renderNowPlaying();
    this.renderTransport();
    this.renderParams();
    this.renderList();
    this.renderPosition();
  },

  renderNowPlaying() {
    const S = KEL.STATE;
    const song = Player.songId ? Library.find(Player.songId) : null;
    let t = TEXT.NOW_NONE;
    if (Player.state === S.LOADING) t = TEXT.NOW_LOADING;
    else if (song && Player.state !== S.EMPTY) t = Util.stripExt(song.name);
    this.el.nowTitle.textContent = t;
  },

  renderTransport() {
    const e = this.el;
    const S = KEL.STATE;
    const st = Player.state;
    const has = st === S.STOPPED || st === S.PLAYING || st === S.PAUSED;
    e.btnPlay.disabled = st === S.LOADING;
    e.btnPlay.classList.toggle('is-disabled', st === S.EMPTY);
    const playing = st === S.PLAYING;
    e.iconPlay.style.display = playing ? 'none' : '';
    e.iconPause.style.display = playing ? '' : 'none';
    e.btnPlay.setAttribute('aria-label', playing ? TEXT.ARIA_PAUSE : TEXT.ARIA_PLAY);
    e.btnStop.disabled = !has;
    e.btnBack.disabled = !has;
    e.btnFwd.disabled = !has;
    e.seekBar.disabled = !has;
    e.btnPrev.disabled = !Player.canPrev();
    e.btnNext.disabled = !Player.canNext();
    e.btnRepeat.textContent = TEXT.REPEAT_LABEL[Player.repeatMode];
    e.btnRepeat.dataset.mode = Player.repeatMode;
  },

  renderParams() {
    const e = this.el;
    e.pitchValue.textContent = Util.formatPitch(Player.pitch);
    e.speedValue.textContent = Util.formatSpeed(Player.speed);
    if (document.activeElement !== e.pitchSlider) e.pitchSlider.value = Player.pitch;
    if (document.activeElement !== e.speedSlider) e.speedSlider.value = Player.speed;
    e.btnPitchDown.disabled = Player.pitch <= KEL.PITCH_MIN;
    e.btnPitchUp.disabled = Player.pitch >= KEL.PITCH_MAX;
    e.btnSpeedDown.disabled = Player.speed <= KEL.SPEED_MIN + 1e-9;
    e.btnSpeedUp.disabled = Player.speed >= KEL.SPEED_MAX - 1e-9;
    this.setFill_(e.pitchSlider);
    this.setFill_(e.speedSlider);
  },

  renderPosition() {
    if (this.posFramePending) return;
    this.posFramePending = true;
    requestAnimationFrame(() => {
      this.posFramePending = false;
      const e = this.el;
      const d = typeof Player.duration === 'number' ? Player.duration : null;
      e.timeTotal.textContent = Player.state === KEL.STATE.EMPTY ? '--:--' : Util.formatTime(d);
      e.seekBar.max = d && d > 0 ? d : 1;
      if (this.seekDragging) return;
      const pos = d ? Math.min(Player.position, d) : 0;
      e.seekBar.value = pos;
      e.timeCur.textContent = Util.formatTime(pos);
      this.setFill_(e.seekBar);
    });
  },

  renderList() {
    const e = this.el;
    const list = Library.getList();
    e.listTitle.textContent = Util.fill(TEXT.LIST_TITLE, { n: list.length, max: KEL.LIBRARY_MAX });
    e.listEmpty.style.display = list.length ? 'none' : '';
    const last = Util.lsGet(KEL.LS.LAST_SONG);
    const frag = document.createDocumentFragment();
    list.forEach((song, i) => {
      const li = document.createElement('li');
      li.className = 'song-row';
      li.dataset.songId = song.songId;
      li.tabIndex = 0;
      if (song.songId === Player.songId && Player.state !== KEL.STATE.EMPTY) li.classList.add('now');
      if (song.songId === last) li.classList.add('last');

      const name = document.createElement('div');
      name.className = 'song-name';
      name.textContent = Util.stripExt(song.name);
      li.appendChild(name);

      const info = document.createElement('div');
      info.className = 'song-info';
      const badge = document.createElement('span');
      badge.className = 'song-badge';
      badge.textContent = Util.fill(TEXT.SETTING_BADGE, { p: Util.formatPitch(song.pitch), s: Number(song.speed).toFixed(2) });
      const time = document.createElement('span');
      time.className = 'song-time';
      time.textContent = Util.formatTime(song.durationSec);
      info.appendChild(badge);
      info.appendChild(time);
      li.appendChild(info);

      const btns = document.createElement('div');
      btns.className = 'song-btns';
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'btn-up btn-move';
      up.innerHTML = this.ICON_UP;
      up.setAttribute('aria-label', TEXT.ARIA_UP);
      up.disabled = i === 0;
      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'btn-down btn-move';
      down.innerHTML = this.ICON_DOWN;
      down.setAttribute('aria-label', TEXT.ARIA_DOWN);
      down.disabled = i === list.length - 1;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn-delete';
      const armed = !!this.deleteArmed[song.songId];
      del.textContent = armed ? TEXT.BTN_DELETE_CONFIRM : TEXT.BTN_DELETE;
      if (armed) del.classList.add('armed');
      [up, down, del].forEach((b) => this.bindPress_(b));
      btns.appendChild(up);
      btns.appendChild(down);
      btns.appendChild(del);
      li.appendChild(btns);
      frag.appendChild(li);
    });
    e.songList.replaceChildren(frag);
  },

  errorText(err, name) {
    const code = err && err.code ? err.code : 'DB';
    const d = (err && err.detail) || {};
    const n = name || (d && typeof d.name === 'string' && !(d instanceof Error) ? d.name : '') || '';
    switch (code) {
      case 'FORMAT': return Util.fill(TEXT.ERR_FORMAT, { name: n });
      case 'TOO_BIG': return Util.fill(TEXT.ERR_TOO_BIG, {
        name: n, mb: (d.size / 1024 / 1024).toFixed(1), max: Math.round(KEL.MAX_FILE_BYTES / 1024 / 1024) });
      case 'DUP': return Util.fill(TEXT.ERR_DUP, { name: n });
      case 'LIB_FULL': return Util.fill(TEXT.ERR_LIB_FULL, { max: KEL.LIBRARY_MAX });
      case 'TOO_LONG': return Util.fill(TEXT.ERR_TOO_LONG, {
        name: n, min: (Number(err.detail) / 60).toFixed(1), max: Math.round(KEL.MAX_DURATION_SEC / 60) });
      case 'DECODE': return Util.fill(TEXT.ERR_DECODE, { name: n });
      case 'QUOTA': return TEXT.ERR_QUOTA;
      case 'AUDIO': return TEXT.ERR_AUDIO;
      default: return TEXT.ERR_DB;
    }
  },

  showError(err, name) {
    this.showMessage(this.errorText(err, name), 'error');
  },

  showMessage(text, kind) {
    const m = this.el.msgArea;
    clearTimeout(this.msgTimer);
    m.textContent = text;
    m.className = 'msg-area ' + (kind === 'error' ? 'error' : 'info');
    m.style.display = '';
    if (kind !== 'error') this.msgTimer = setTimeout(() => this.hideMessage(), KEL.MESSAGE_HIDE_MS);
  },

  hideMessage() {
    clearTimeout(this.msgTimer);
    this.el.msgArea.style.display = 'none';
    this.el.msgArea.textContent = '';
  },

  showUpdateBanner() {
    this.el.updateBanner.style.display = '';
  }
};
