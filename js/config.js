// KElástico  config.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：定数 KEL と、画面に出る文言 TEXT（仕様書 第5章）

const KEL = {
  APP_VERSION: '0.2.4',

  PITCH_MIN: -12,
  PITCH_MAX: 12,
  PITCH_STEP: 1,
  PITCH_DEFAULT: 0,

  SPEED_MIN: 0.5,
  SPEED_MAX: 2.0,
  SPEED_STEP: 0.05,
  SPEED_DEFAULT: 1.0,

  SKIP_SEC: 10,
  PREV_RESTART_SEC: 3,

  MAX_FILE_BYTES: 20 * 1024 * 1024,
  MAX_DURATION_SEC: 600,
  LIBRARY_MAX: 30,
  ALLOWED_EXT: ['mp3', 'm4a'],
  ACCEPT_TYPES: 'audio/*',

  SAVE_DEBOUNCE_MS: 500,
  HEADSET_DEBOUNCE_MS: 300,
  PRESS_HOLD_MS: 150,
  DELETE_CONFIRM_MS: 3000,
  MESSAGE_HIDE_MS: 5000,
  POSITION_STATE_MS: 1000,
  UPDATE_CHECK_MIN: 10,

  DB_NAME: 'kelastico',
  DB_VERSION: 1,
  SONG_SCHEMA: 1,

  STATE: { EMPTY: 'empty', LOADING: 'loading', STOPPED: 'stopped', PLAYING: 'playing', PAUSED: 'paused' },
  REPEAT: { STOP: 'stop', ONE: 'one', LIST: 'list', ALL: 'all' },
  REPEAT_ORDER: ['list', 'all', 'one', 'stop'],
  REPEAT_DEFAULT: 'list',

  LS: {
    REPEAT: 'kel_repeatMode',
    LAST_SONG: 'kel_lastSongId',
    LOADING: 'kel_loadingSongId',
    PERSIST_ASKED: 'kel_persistAsked'
  }
};

const TEXT = {
  APP_TITLE: 'KElástico',
  VERSION: '版 {v}',
  LABEL_PITCH: 'キー',
  LABEL_SPEED: '速度',
  BTN_ADD: '曲を追加',
  BTN_RESET: '元に戻す',
  BTN_STOP: '停止',
  BTN_DELETE: '削除',
  BTN_DELETE_CONFIRM: 'もう一度押すと削除',
  ARIA_PLAY: '再生',
  ARIA_PAUSE: '一時停止',
  ARIA_BACK: '10秒戻る',
  ARIA_FWD: '10秒進む',
  ARIA_PREV: '前の曲',
  ARIA_NEXT: '次の曲',
  ARIA_PITCH_DOWN: 'キーを下げる',
  ARIA_PITCH_UP: 'キーを上げる',
  ARIA_SPEED_DOWN: '速度を下げる',
  ARIA_SPEED_UP: '速度を上げる',
  ARIA_SEEK: '再生位置',
  ARIA_UP: '上へ',
  ARIA_DOWN: '下へ',
  REPEAT_LABEL: { stop: '1曲で停止', one: '1曲くり返し', list: '一覧を順に', all: '一覧をくり返し' },
  LIST_TITLE: '曲の一覧（{n}/{max}）',
  LIST_EMPTY: '「曲を追加」から、iPhoneの「ファイル」にある曲を選んでください',
  NOW_NONE: '曲が選ばれていません',
  NOW_LOADING: '読み込み中…',
  HINT_NEED_SONG: '曲の一覧から曲を選んでください',
  SETTING_BADGE: 'キー{p}・{s}倍',
  INFO_ADDED: '{n}曲を追加しました',
  ERR_FORMAT: 'mp3・m4a以外は追加できません：{name}',
  ERR_TOO_BIG: 'ファイルが大きすぎます（{mb}MB。{max}MBまで）：{name}',
  ERR_DUP: 'すでに一覧にあります：{name}',
  ERR_LIB_FULL: '一覧は{max}曲までです。削除してから追加してください',
  ERR_TOO_LONG: '曲が長すぎます（{min}分。{max}分まで）：{name}',
  ERR_DECODE: 'この曲を読み込めませんでした。ファイルが壊れているか、対応していない形式です：{name}',
  ERR_DB: '曲を保存する場所を開けません。プライベートブラウズになっていないか確かめ、ホーム画面のアイコンから開いてください',
  ERR_QUOTA: 'iPhoneの空き容量が足りず、曲を保存できませんでした',
  ERR_AUDIO: '音を出す準備ができませんでした。iOSを最新にしてから、もう一度開いてください',
  INFO_CRASHED: '前回「{name}」の読み込み中にアプリが終了しました。曲が長すぎる可能性があります',
  UPDATE_BANNER: '新しい版があります。ここをタップすると更新します'
};

// エラーの種類（仕様書 第8-4節）。code は FORMAT TOO_BIG DUP LIB_FULL TOO_LONG DECODE DB QUOTA AUDIO
class KelError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}
