// KElástico  engine.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：AudioContext と AudioWorklet（kel-processor）の管理（仕様書 第8章）

const Engine = {
  ctx: null,
  node: null,
  durationSec: null,
  posCallback: null,
  endedCallback: null,
  contextPromise: null,

  ensureContext_() {
    if (this.contextPromise) return this.contextPromise;
    this.contextPromise = (async () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: 'playback' });
        await this.ctx.audioWorklet.addModule('js/worklet/kel-processor.js');
        this.node = new AudioWorkletNode(this.ctx, 'kel-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });
        this.node.port.onmessage = (e) => this.onMessage_(e.data);
        this.node.connect(this.ctx.destination);
      } catch (e) {
        console.error('[Engine] context', e);
        this.contextPromise = null;
        this.ctx = null;
        this.node = null;
        throw new KelError('AUDIO', e);
      }
    })();
    return this.contextPromise;
  },

  async ensureRunning_() {
    await this.ensureContext_();
    if (this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch (e) { console.warn('[Engine] resume', e); }
    }
  },

  onMessage_(m) {
    if (!m) return;
    if (m.type === 'pos' && this.posCallback) this.posCallback(m.sec);
    else if (m.type === 'ended' && this.endedCallback) this.endedCallback();
  },

  async loadSong(blob) {
    await this.ensureContext_();
    this.node.port.postMessage({ type: 'unload' });
    this.durationSec = null;
    const bytes = await blob.arrayBuffer();
    let ab;
    try {
      ab = await this.ctx.decodeAudioData(bytes);
    } catch (e) {
      throw new KelError('DECODE', e);
    }
    const durationSec = ab.duration;
    if (durationSec > KEL.MAX_DURATION_SEC) { ab = null; throw new KelError('TOO_LONG', durationSec); }
    const channels = [];
    for (let c = 0; c < Math.min(2, ab.numberOfChannels); c++) {
      const arr = new Float32Array(ab.length);
      ab.copyFromChannel(arr, c);
      channels.push(arr);
    }
    ab = null;
    this.node.port.postMessage({ type: 'load', channels }, channels.map((a) => a.buffer));
    this.durationSec = durationSec;
    return { durationSec };
  },

  async play() {
    await this.ensureRunning_();
    this.node.port.postMessage({ type: 'play' });
  },

  pause() {
    if (this.node) this.node.port.postMessage({ type: 'pause' });
  },

  seek(sec) {
    if (this.node) this.node.port.postMessage({ type: 'seek', sec });
  },

  setParams(pitch, speed) {
    if (this.node) this.node.port.postMessage({ type: 'params', pitch, speed });
  },

  unload() {
    this.durationSec = null;
    if (this.node) this.node.port.postMessage({ type: 'unload' });
  },

  onPosition(callback) {
    this.posCallback = callback;
  },

  onEnded(callback) {
    this.endedCallback = callback;
  }
};
