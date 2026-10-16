// KElástico  store.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：IndexedDB（曲の記録 songs・曲のファイル files）の読み書き（仕様書 第6章）

const Store = {
  db: null,

  async open() {
    try {
      this.db = await this.openDb_();
      return true;
    } catch (e) {
      console.error('[Store] open', e);
      this.db = null;
      return false;
    }
  },

  openDb_() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in self)) { reject(new Error('no indexedDB')); return; }
      let req;
      try { req = indexedDB.open(KEL.DB_NAME, KEL.DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'songId' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'songId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
  },

  // 1回の書き込み（トランザクション）。work(stores) の中で put/delete を行う。完了で resolve
  tx_(names, mode, work) {
    return new Promise((resolve, reject) => {
      if (!this.db) { reject(new KelError('DB')); return; }
      let t;
      try { t = this.db.transaction(names, mode); } catch (e) { reject(new KelError('DB', e)); return; }
      const stores = {};
      names.forEach((n) => { stores[n] = t.objectStore(n); });
      let result;
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(Store.toKelError(t.error));
      t.onabort = () => reject(Store.toKelError(t.error));
      try {
        result = work(stores, (v) => { result = v; });
      } catch (e) {
        try { t.abort(); } catch (e2) { /* 無視 */ }
        reject(Store.toKelError(e));
      }
    });
  },

  toKelError(err) {
    if (err instanceof KelError) return err;
    if (err && err.name === 'QuotaExceededError') return new KelError('QUOTA', err);
    return new KelError('DB', err);
  },

  reqValue_(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(Store.toKelError(req.error));
    });
  },

  normalizeSong_(rec) {
    if (!rec) return null;
    const r = Object.assign({}, rec);
    if (typeof r.schema !== 'number') r.schema = KEL.SONG_SCHEMA;
    if (typeof r.pitch !== 'number') r.pitch = KEL.PITCH_DEFAULT;
    if (typeof r.speed !== 'number') r.speed = KEL.SPEED_DEFAULT;
    if (typeof r.durationSec !== 'number') r.durationSec = null;
    if (typeof r.inLibrary !== 'boolean') r.inLibrary = true;
    if (typeof r.addedAt !== 'number') r.addedAt = 0;
    if (typeof r.order !== 'number') r.order = r.addedAt;
    if (typeof r.lastPlayedAt !== 'number') r.lastPlayedAt = null;
    if (typeof r.updatedAt !== 'number') r.updatedAt = r.addedAt;
    return r;
  },

  async getAllSongs() {
    if (!this.db) return [];
    const t = this.db.transaction(['songs'], 'readonly');
    const list = await this.reqValue_(t.objectStore('songs').getAll());
    return list.map((r) => this.normalizeSong_(r));
  },

  async getSong(songId) {
    if (!this.db) return null;
    const t = this.db.transaction(['songs'], 'readonly');
    const r = await this.reqValue_(t.objectStore('songs').get(songId));
    return this.normalizeSong_(r || null);
  },

  async getFileBlob(songId) {
    if (!this.db) return null;
    const t = this.db.transaction(['files'], 'readonly');
    const r = await this.reqValue_(t.objectStore('files').get(songId));
    return r ? r.blob : null;
  },

  // list: [{ song, blob }]
  putSongsWithFiles(list) {
    return this.tx_(['songs', 'files'], 'readwrite', (s) => {
      list.forEach(({ song, blob }) => {
        s.songs.put(song);
        s.files.put({ songId: song.songId, blob });
      });
    });
  },

  async updateSongSettings(songId, pitch, speed) {
    return this.updateSongMeta(songId, { pitch, speed });
  },

  updateSongMeta(songId, fields) {
    return this.tx_(['songs'], 'readwrite', (s) => {
      const req = s.songs.get(songId);
      req.onsuccess = () => {
        if (!req.result) return;
        const rec = Object.assign(this.normalizeSong_(req.result), fields, { updatedAt: Date.now() });
        s.songs.put(rec);
      };
    });
  },

  removeFile(songId) {
    return this.tx_(['songs', 'files'], 'readwrite', (s) => {
      s.files.delete(songId);
      const req = s.songs.get(songId);
      req.onsuccess = () => {
        if (!req.result) return;
        const rec = Object.assign(this.normalizeSong_(req.result), { inLibrary: false, updatedAt: Date.now() });
        s.songs.put(rec);
      };
    });
  },

  swapOrder(songIdA, songIdB) {
    return this.tx_(['songs'], 'readwrite', (s) => {
      const ra = s.songs.get(songIdA);
      const rb = s.songs.get(songIdB);
      let a = null, b = null, n = 0;
      const done = () => {
        if (++n < 2) return;
        if (!a || !b) return;
        const na = this.normalizeSong_(a), nb = this.normalizeSong_(b);
        const oa = na.order;
        na.order = nb.order;
        nb.order = oa;
        if (na.order === nb.order) nb.order = na.order + 1;
        const now = Date.now();
        na.updatedAt = now;
        nb.updatedAt = now;
        s.songs.put(na);
        s.songs.put(nb);
      };
      ra.onsuccess = () => { a = ra.result; done(); };
      rb.onsuccess = () => { b = rb.result; done(); };
    });
  }
};
