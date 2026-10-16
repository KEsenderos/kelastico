// KElástico  library.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：曲の一覧の追加・削除・並べ替え（仕様書 第9-1・9-8・9-9節）

const Library = {
  list: [],

  async refresh() {
    const all = await Store.getAllSongs();
    this.list = all.filter((s) => s.inLibrary).sort((a, b) => a.order - b.order);
    return this.list;
  },

  getList() {
    return this.list;
  },

  find(songId) {
    return this.list.find((s) => s.songId === songId) || null;
  },

  maxOrder_() {
    return this.list.reduce((m, s) => Math.max(m, s.order), -1);
  },

  async addFiles(fileList) {
    const files = Array.from(fileList || []);
    const errors = [];
    const accepted = [];
    const ids = new Set(this.list.map((s) => s.songId));
    let order = this.maxOrder_() + 1;
    const now = Date.now();
    let full = false;

    for (const f of files) {
      const name = f.name;
      if (!KEL.ALLOWED_EXT.includes(Util.getExt(name))) {
        errors.push(new KelError('FORMAT', { name }));
        continue;
      }
      if (f.size > KEL.MAX_FILE_BYTES) {
        errors.push(new KelError('TOO_BIG', { name, size: f.size }));
        continue;
      }
      const songId = Util.makeSongId(name, f.size);
      if (ids.has(songId)) {
        errors.push(new KelError('DUP', { name }));
        continue;
      }
      if (this.list.length + accepted.length >= KEL.LIBRARY_MAX) {
        full = true;
        break;
      }
      const old = await Store.getSong(songId);
      const song = {
        schema: KEL.SONG_SCHEMA,
        songId,
        name,
        size: f.size,
        type: f.type || '',
        durationSec: old ? old.durationSec : null,
        pitch: old ? old.pitch : KEL.PITCH_DEFAULT,
        speed: old ? old.speed : KEL.SPEED_DEFAULT,
        inLibrary: true,
        order: order++,
        addedAt: now,
        lastPlayedAt: old ? old.lastPlayedAt : null,
        updatedAt: now
      };
      ids.add(songId);
      accepted.push({ song, blob: f });
    }
    if (full) errors.push(new KelError('LIB_FULL', {}));

    if (accepted.length) {
      try {
        await Store.putSongsWithFiles(accepted);
      } catch (e) {
        errors.push(Store.toKelError(e));
        await this.refresh();
        return { added: 0, errors };
      }
      if (!Util.lsGet(KEL.LS.PERSIST_ASKED)) {
        Util.lsSet(KEL.LS.PERSIST_ASKED, '1');
        try {
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        } catch (e) { /* 無視 */ }
      }
    }
    await this.refresh();
    return { added: accepted.length, errors };
  },

  async remove(songId) {
    if (Player.songId === songId) Player.clearSong(songId);
    try {
      await Store.removeFile(songId);
    } catch (e) {
      UI.showError(Store.toKelError(e));
    }
    await this.refresh();
  },

  async moveUp(songId) {
    return this.move_(songId, -1);
  },

  async moveDown(songId) {
    return this.move_(songId, 1);
  },

  async move_(songId, dir) {
    const i = this.list.findIndex((s) => s.songId === songId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.list.length) return false;
    const a = this.list[i];
    const b = this.list[j];
    const backup = this.list.slice();
    const oa = a.order, ob = b.order;
    a.order = ob;
    b.order = oa === ob ? ob + 1 : oa;
    this.list[i] = b;
    this.list[j] = a;
    UI.renderList();
    UI.renderTransport();
    try {
      await Store.swapOrder(a.songId, b.songId);
    } catch (e) {
      a.order = oa;
      b.order = ob;
      this.list = backup;
      UI.renderList();
      UI.renderTransport();
      UI.showError(new KelError('DB', e));
      return false;
    }
    return true;
  },

  nextOf(songId, wrap) {
    const i = this.list.findIndex((s) => s.songId === songId);
    if (i < 0 || !this.list.length) return null;
    if (i + 1 < this.list.length) return this.list[i + 1].songId;
    return wrap ? this.list[0].songId : null;
  },

  prevOf(songId, wrap) {
    const i = this.list.findIndex((s) => s.songId === songId);
    if (i < 0 || !this.list.length) return null;
    if (i > 0) return this.list[i - 1].songId;
    return wrap ? this.list[this.list.length - 1].songId : null;
  }
};
