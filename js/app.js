// KElástico  app.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：起動処理（仕様書 第11章「App.start() の順番」）

const App = {
  lastUpdateCheck: 0,
  registration: null,

  async start() {
    UI.init();
    const ok = await Store.open();
    if (!ok) {
      UI.setAddEnabled(false);
      UI.showError(new KelError('DB'));
    }
    await App.checkLoadingFlag_();
    try { await Library.refresh(); } catch (e) { console.error('[App] refresh', e); }
    Player.init();
    MediaCtl.init();
    UI.render();
    App.registerSW_();
    document.addEventListener('visibilitychange', () => App.onVisibility_());
    window.addEventListener('pagehide', () => Player.flushSave());
  },

  async checkLoadingFlag_() {
    const id = Util.lsGet(KEL.LS.LOADING);
    if (!id) return;
    Util.lsRemove(KEL.LS.LOADING);
    let name = id.split('|')[0];
    try {
      const s = await Store.getSong(id);
      if (s) name = s.name;
    } catch (e) { /* 名前は songId から */ }
    UI.showMessage(Util.fill(TEXT.INFO_CRASHED, { name: Util.stripExt(name) }), 'error');
  },

  registerSW_() {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) UI.showUpdateBanner();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      App.registration = reg;
      App.lastUpdateCheck = Date.now();
    }).catch((e) => console.warn('[App] sw', e));
  },

  onVisibility_() {
    if (document.visibilityState === 'hidden') {
      Player.flushSave();
      return;
    }
    const now = Date.now();
    if (App.registration && now - App.lastUpdateCheck >= KEL.UPDATE_CHECK_MIN * 60 * 1000) {
      App.lastUpdateCheck = now;
      App.registration.update().catch(() => {});
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.start());
