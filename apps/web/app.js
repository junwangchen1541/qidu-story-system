(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let session, lastLine = "", flashTimer, shakeTimer, bgm;
  let currentView, started = false, paused = false, autoTimer, dueAt = 0, remaining = 0, mediaKey = '';
  const movie = document.createElement('video');
  movie.id = 'storyVideo'; movie.className = 'story-video'; movie.playsInline = true;
  movie.preload = 'metadata'; movie.hidden = true;
  $('sceneView').prepend(movie);
  const cover = document.createElement('div');
  cover.className = 'play-cover'; cover.hidden = true;
  $('app').append(cover);
  const pauseButton = document.createElement('button');
  pauseButton.id = 'pauseBtn'; pauseButton.className = 'tool'; pauseButton.dataset.action = 'pause';
  pauseButton.textContent = '暂停'; pauseButton.hidden = true;
  document.querySelector('.toolbar').prepend(pauseButton);
  function running() { return started && !paused && !document.hidden; }
  function freeze() {
    if (autoTimer) { remaining = Math.max(0, dueAt - performance.now()); clearTimeout(autoTimer); autoTimer = null; }
    movie.pause();
    $('app').classList.add('playback-paused');
  }
  function resume() {
    if (!running() || !currentView || !currentView.cinematic) return;
    $('app').classList.remove('playback-paused');
    if (currentView.line.video) {
      movie.play().catch(() => {
        paused = true; freeze(); pauseButton.textContent = '播放';
        $('notice').textContent = '点击播放继续演出。';
      });
    } else if (currentView.autoAdvance && !autoTimer) {
      dueAt = performance.now() + remaining;
      autoTimer = setTimeout(() => { autoTimer = null; act('advance'); }, remaining);
    }
  }
  function renderPlayback(view) {
    currentView = view;
    $('app').classList.toggle('cinematic', view.cinematic);
    $('app').classList.toggle('has-movie', !!view.line.video);
    $('mapBtn').hidden = $('terminalBtn').hidden = !!view.cinematic;
    pauseButton.hidden = !view.cinematic || view.mode === 'ending' || !started;
    if (!view.cinematic) return;
    if (!started) {
      cover.hidden = false;
      cover.innerHTML = '<div><h1>' + escape(view.title) + '</h1><button class="choice" data-action="play">开始</button></div>';
    }
    clearTimeout(autoTimer); autoTimer = null;
    if (mediaKey !== view.lineKey) {
      mediaKey = view.lineKey;
      remaining = view.line.durationMs || 3000;
      movie.pause(); movie.hidden = !view.line.video;
      if (view.line.video) {
        const clip = view.line.video;
        const url = (session.assets.video || {})[clip.id];
        if (!url) throw Error('缺少演出视频：' + clip.id);
        movie.src = url;
        movie.onloadedmetadata = () => { movie.currentTime = clip.start; resume(); };
      } else { movie.removeAttribute('src'); movie.load(); }
    }
    if (view.mode === 'ending') { movie.pause(); return; }
    if (!running()) freeze();
    else if (!view.line.video || movie.readyState >= 1) resume();
  }
  movie.addEventListener('timeupdate', () => {
    const clip = currentView && currentView.line.video;
    if (clip && movie.currentTime >= clip.end && running()) { movie.pause(); act('advance'); }
  });
  movie.addEventListener('ended', () => { if (currentView && currentView.line.video && running()) act('advance'); });
  movie.addEventListener('error', () => { if (movie.getAttribute('src')) { paused = true; freeze(); $('notice').textContent = '演出视频加载失败，请检查本地视频文件。'; } });
  function stopAudio() {
    if (bgm) { bgm.pause(); bgm.removeAttribute("src"); bgm = null; }
  }
  function runAudio(commands) {
    for (const command of commands) {
      if (command.type === "stop") { stopAudio(); continue; }
      const url = (session.assets.audio || {})[command.id];
      if (!url) continue;
      stopAudio();
      bgm = new Audio(url);
      bgm.loop = command.loop !== false;
      bgm.play().catch(() => { $("notice").textContent = "点击剧情后可播放音乐。"; });
    }
  }
  function act(action, value) {
    try {
      if (action === 'play') { started = true; paused = false; cover.hidden = true; render(session.view()); return; }
      if (action === 'pause') {
        paused = !paused; pauseButton.textContent = paused ? '播放' : '暂停';
        if (paused) freeze(); else resume();
        return;
      }
      if (action === "reset" && !window.confirm("重新开始当前篇章？")) return;
      if (action === "reset") { stopAudio(); paused = false; mediaKey = ''; pauseButton.textContent = '暂停'; }
      render(session.act(action, value));
    } catch (error) { $("notice").textContent = error.message; }
  }
  function render(vm) {
    $("notice").textContent = vm.notice;
    $("brand").textContent = vm.title;
    document.title = vm.title;
    const mapBg = (session.assets.bg || {}).central_court;
    $("mapView").style.setProperty("--map-background", mapBg ? 'url("' + encodeURI(mapBg).replace(/"/g, "%22") + '")' : 'linear-gradient(135deg,#07101f,#101b2d)');
    $("mapView").classList.toggle("active", vm.mode === "map");
    $("sceneView").classList.toggle("active", vm.mode !== "map");
    $("sceneView").setAttribute("aria-hidden", String(vm.mode === "map"));
    $("mapView").setAttribute("aria-hidden", String(vm.mode !== "map"));
    $("hotspots").innerHTML = vm.locations.map((loc) =>
      '<button class="hotspot ' + (loc.available ? "available" : "") + '" style="left:' + loc.x + '%;top:' + loc.y + '%" ' + (loc.available ? "" : "disabled") +
      ' data-action="open" data-value="' + escape(loc.eventId) + '"><div class="pin"></div><strong>' + escape(loc.name) + '</strong><span>' + escape(loc.desc) + '</span><div class="event">' + escape(loc.eventTitle ? '事件：' + loc.eventTitle : '暂无事件') + '</div></button>').join("");
    $("stageLabel").textContent = vm.label;
    $("sceneBg").style.backgroundImage = vm.bg ? 'url("' + encodeURI(vm.bg).replace(/"/g, "%22") + '")' : "";
    $("portraits").innerHTML = (vm.black ? [] : vm.portraits).map((p) => p.src
      ? '<img class="portrait ' + p.side + ' show ' + (p.inactive ? "inactive" : "") + '" src="' + escape(p.src) + '" alt="' + escape(p.name) + '">'
      : '<div class="portrait placeholder ' + p.side + ' show ' + (p.inactive ? "inactive" : "") + '">' + escape(p.name) + '</div>').join("");
    $("fx").classList.toggle("show", vm.black);
    $("fx").classList.toggle("black", vm.black);
    const text = vm.cinematic && vm.line.reveal ? vm.line.reveal.map(line => '<span class="reveal-line" style="animation-delay:' + line.delayMs + 'ms">' + escape(line.text) + '</span>').join('') : escape(vm.line.text);
    $("fx").innerHTML = vm.black ? '<div class="title-text">' + text + '</div>' : "";
    $("dialogue").classList.toggle("title-control", vm.black);
    if (vm.mode === "ending") {
      stopAudio();
      $("dialogue").innerHTML = '<div class="ending-card"><h2>' + escape(vm.ending.title) + '</h2><p>' + escape(vm.ending.text) +
        '</p><button class="choice" data-action="reset">重新开始</button></div>';
    } else if (vm.mode === "scene") {
      $("dialogue").innerHTML = (vm.black ? "" : '<div class="nameplate">' + escape(vm.speaker) + '</div><div class="line' + (vm.line.speaker ? '' : ' narration') + '">' + text + '</div>') +
        '<div class="choices">' + (vm.hasNext && !vm.cinematic ? '<button class="next" data-action="next">继续</button>' : vm.choices.map((c) =>
          '<button class="choice" data-action="choose" data-value="' + c.index + '">' + escape(c.text) + '</button>').join("")) + '</div>';
      if (vm.cinematic && vm.choices.length) {
        const delay = Math.max(0, ...(vm.line.reveal || []).map(line => line.delayMs)) + 800;
        $('dialogue').querySelector('.choices').style.animationDelay = delay + 'ms';
      }
    } else $("dialogue").innerHTML = "";
    $("drawer").classList.toggle("show", vm.drawer);
    $("terminalBtn").setAttribute("aria-expanded", String(vm.drawer));
    $("drawer").innerHTML = '<h2>战术终端 / 私信</h2>' + (vm.coreCount === null ? "" : '<p>黑核 ' + vm.coreCount + ' / ' + vm.maxCores + '</p>') +
      (vm.messages.length ? vm.messages.map((m) => '<div class="memory-card"><strong>' + escape(m.title) + (m.read ? "（已读）" : "") +
        '</strong><span>来自：' + escape(m.from) + '</span><span>' + escape(m.text) + '</span>' +
        (m.reply ? '<span>回复：' + escape(m.reply) + '</span>' : "") +
        (m.read ? "" : '<button class="choice" data-action="read" data-value="' + escape(m.id) + '">读取</button>') + '</div>').join("") : '<p>暂无新私信</p>');
    if (vm.mode !== "scene") {
      clearTimeout(flashTimer); clearTimeout(shakeTimer);
      $("app").classList.remove("shake"); $("flash").classList.remove("show");
    } else if (vm.lineKey !== lastLine) {
      clearTimeout(flashTimer); clearTimeout(shakeTimer);
      $("flash").classList.remove("show"); $("app").classList.remove("shake");
      lastLine = vm.lineKey;
      if (vm.effects.includes("white_flash")) {
        $("flash").classList.add("show");
        flashTimer = setTimeout(() => $("flash").classList.remove("show"), 180);
      }
      if (vm.effects.includes("shake")) {
        void $("app").offsetWidth;
        $("app").classList.add("shake");
        shakeTimer = setTimeout(() => $("app").classList.remove("shake"), 460);
      }
      runAudio(vm.audio);
    }
    renderPlayback(vm);
  }
  $("app").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled || !session) return;
    if (button.dataset.action === "reset") lastLine = "";
    act(button.dataset.action, button.dataset.value);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { freeze(); if (bgm) bgm.pause(); }
    else resume();
  });
  window.addEventListener("pagehide", () => { freeze(); stopAudio(); });
  try {
    session = window.StorySession.createSession(window.StoryContent.route, {
      load: (key) => { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; },
      save: (key, value) => localStorage.setItem(key, JSON.stringify(value))
    }, window.StoryContent.assets);
    render(session.view());
  } catch (error) {
    $("notice").textContent = "加载失败：" + error.message + "。请先运行 npm run build。";
  }
})();
