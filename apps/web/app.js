(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let session, lastLine = "", flashTimer, shakeTimer, bgm;
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
      if (action === "reset" && !window.confirm("重新开始当前篇章？")) return;
      if (action === "reset") stopAudio();
      render(session.act(action, value));
    } catch (error) { $("notice").textContent = error.message; }
  }
  function render(vm) {
    $("notice").textContent = vm.notice;
    $("brand").textContent = vm.title;
    $("mapView").classList.toggle("active", vm.mode === "map");
    $("sceneView").classList.toggle("active", vm.mode !== "map");
    $("sceneView").setAttribute("aria-hidden", String(vm.mode === "map"));
    $("mapView").setAttribute("aria-hidden", String(vm.mode !== "map"));
    $("hotspots").innerHTML = vm.locations.map((loc) =>
      '<button class="hotspot ' + (loc.available ? "available" : "") + '" style="left:' + loc.x + '%;top:' + loc.y + '%" ' + (loc.available ? "" : "disabled") +
      ' data-action="open" data-value="' + escape(loc.eventId) + '"><strong>' + escape(loc.name) + '</strong><span>' + escape(loc.eventTitle || loc.desc) + '</span></button>').join("");
    $("stageLabel").textContent = vm.label;
    $("sceneBg").style.backgroundImage = vm.bg ? 'url("' + encodeURI(vm.bg).replace(/"/g, "%22") + '")' : "";
    $("portraits").innerHTML = vm.portraits.map((p) => p.src
      ? '<img class="portrait ' + p.side + ' show ' + (p.inactive ? "inactive" : "") + '" src="' + escape(p.src) + '" alt="' + escape(p.name) + '">'
      : '<div class="portrait placeholder ' + p.side + ' show ' + (p.inactive ? "inactive" : "") + '">' + escape(p.name) + '</div>').join("");
    $("fx").classList.toggle("show", vm.black);
    $("fx").textContent = vm.black ? vm.line.text : "";
    $("dialogue").classList.toggle("title-control", vm.black);
    if (vm.mode === "ending") {
      stopAudio();
      $("dialogue").innerHTML = '<h2>' + escape(vm.ending.title) + '</h2><div class="line">' + escape(vm.ending.text) +
        '</div><button class="choice" data-action="reset">重新开始</button>';
    } else if (vm.mode === "scene") {
      $("dialogue").innerHTML = (vm.black ? "" : '<div class="nameplate">' + escape(vm.speaker) + '</div><div class="line">' + escape(vm.line.text) + '</div>') +
        '<div class="choices">' + (vm.hasNext ? '<button class="next" data-action="next">继续</button>' : vm.choices.map((c) =>
          '<button class="choice" data-action="choose" data-value="' + c.index + '">' + escape(c.text) + '</button>').join("")) + '</div>';
    } else $("dialogue").innerHTML = "";
    $("drawer").classList.toggle("show", vm.drawer);
    $("terminalBtn").setAttribute("aria-expanded", String(vm.drawer));
    $("drawer").innerHTML = '<h2>战术终端 / 私信</h2>' + (vm.coreCount === null ? "" : '<p>黑核 ' + vm.coreCount + ' / ' + vm.maxCores + '</p>') +
      (vm.messages.length ? vm.messages.map((m) => '<div class="message"><strong>' + escape(m.title) + (m.read ? "（已读）" : "") +
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
  }
  $("app").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled || !session) return;
    if (button.dataset.action === "reset") lastLine = "";
    act(button.dataset.action, button.dataset.value);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && bgm) bgm.pause(); });
  window.addEventListener("pagehide", stopAudio);
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
