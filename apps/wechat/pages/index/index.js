const { createSession } = require("../../shared/session.js");
const content = require("../../data/content.js");

Page({
  data: { mode: "map", drawer: false, locations: [], messages: [], portraits: [], choices: [], line: { text: "" }, ending: null, notice: "", flash: false, shake: false },
  onLoad() {
    this.lastLine = "";
    this.session = createSession(content.route, {
      load: (key) => wx.getStorageSync(key) || null,
      save: (key, value) => wx.setStorageSync(key, value)
    }, content.assets);
    this.render(this.session.view());
  },
  onHide() {
    if (this.audio) this.audio.pause();
    this.clearEffects();
  },
  onUnload() { this.clearEffects(); this.stopAudio(); },
  clearEffects() {
    clearTimeout(this.flashTimer);
    clearTimeout(this.shakeTimer);
    this.setData({ flash: false, shake: false });
  },
  stopAudio() {
    if (this.audio) { this.audio.destroy(); this.audio = null; }
  },
  render(vm) {
    // Only the current view-model crosses the WeChat setData bridge.
    this.setData(vm);
    if (vm.mode !== "scene") { this.clearEffects(); if (vm.mode === "ending") this.stopAudio(); return; }
    if (vm.lineKey === this.lastLine) return;
    this.lastLine = vm.lineKey;
    this.clearEffects();
    if (vm.effects.includes("white_flash")) {
      this.setData({ flash: true });
      this.flashTimer = setTimeout(() => this.setData({ flash: false }), 180);
    }
    if (vm.effects.includes("shake")) {
      this.setData({ shake: true });
      this.shakeTimer = setTimeout(() => this.setData({ shake: false }), 460);
    }
    for (const command of vm.audio) {
      if (command.type === "stop") { this.stopAudio(); continue; }
      const url = (content.assets.audio || {})[command.id];
      if (!url) continue;
      this.stopAudio();
      this.audio = wx.createInnerAudioContext();
      this.audio.src = url;
      this.audio.loop = command.loop !== false;
      this.audio.onError(() => this.setData({ notice: "音乐暂不可播放，剧情可以继续。" }));
      this.audio.play();
    }
  },
  act(event) {
    const { action, value } = event.currentTarget.dataset;
    const run = () => {
      try {
        if (action === "reset") { this.lastLine = ""; this.stopAudio(); }
        this.render(this.session.act(action, value));
      } catch (error) { wx.showToast({ title: error.message, icon: "none" }); }
    };
    if (action === "reset") {
      wx.showModal({ title: "重新开始", content: "重新开始当前篇章？", success: (result) => { if (result.confirm) run(); } });
    } else run();
  }
});
