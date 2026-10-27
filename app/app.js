/* Sadhan Bhajan (for Thakur & Souvik) — private sadhana app.
   All private content arrives encrypted (AES-GCM); the key is derived from the password
   each time the app opens and is kept in memory only. */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let KEY = null, D = null;            // crypto key, decrypted bundle
let hiddenAt = 0;
const RELOCK_MS = 3 * 60 * 1000;     // re-ask the password after 3 minutes away

/* ---------- storage (on this device only) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("sb:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("sb:" + k, JSON.stringify(v)); } catch {} }
};
const S = Object.assign({ lang: "both", theme: "auto", tone: true, dur: 45, gaze: "gaze-chakra", speed: 1.5 }, store.get("settings", {}));
const saveS = () => store.set("settings", S);
const LOG = store.get("log", {});
const saveLog = () => store.set("log", LOG);
const dkey = (d = new Date()) => {
  // a sadhana day runs from 3 am to 3 am, so the night sitting after midnight belongs to the evening before
  const x = new Date(d.getTime() - 3 * 3600 * 1000);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
};
const today = () => (LOG[dkey()] ||= {});

/* ---------- crypto ---------- */
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(pass) {
  const meta = await (await fetch("data/meta.json", { cache: "no-cache" })).json();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64d(meta.salt), iterations: meta.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}
async function openFile(path, key = KEY) {
  const buf = new Uint8Array(await (await fetch(path)).arrayBuffer());
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, key, buf.slice(12));
}

/* ---------- lock ---------- */
$("#lockForm").addEventListener("submit", async e => {
  e.preventDefault();
  const p = $("#pass").value;
  const msg = $("#lockMsg");
  if (!p) return;
  msg.textContent = "…";
  try {
    const k = await deriveKey(p);
    const plain = await openFile("data/main.bin", k);
    KEY = k; D = JSON.parse(new TextDecoder().decode(plain));
    $("#pass").value = ""; msg.textContent = "";
    $("#lock").hidden = true; $("#app").hidden = false;
    go(location.hash.slice(1) || "today");
  } catch {
    msg.textContent = "খোলা গেল না · Not this one";
    $("#pass").select();
  }
});
function lock() {
  KEY = null; D = null;
  $("#view").innerHTML = ""; $("#overlay").innerHTML = ""; $("#overlay").hidden = true;
  $("#app").hidden = true; $("#lock").hidden = false;
  setTimeout(() => $("#pass").focus(), 50);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (KEY && hiddenAt && Date.now() - hiddenAt > RELOCK_MS && !timer.running) lock();
});

/* ---------- theme & language ---------- */
function applyPrefs() {
  document.body.classList.remove("lang-both", "lang-bn", "lang-en");
  document.body.classList.add("lang-" + S.lang);
  let t = S.theme;
  if (t === "auto") {
    const h = new Date().getHours();
    t = (h >= 19 || h < 5) || matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
  }
  document.documentElement.dataset.theme = t;
}
applyPrefs();

/* ---------- helpers ---------- */
const pair = (bn, en, cls = "") => `<div class="pair ${cls}">${bn ? `<p class="bn">${bn}</p>` : ""}${en ? `<p class="en">${en}</p>` : ""}</div>`;
const dayIndex = () => Math.floor(new Date(dkey() + "T00:00:00").getTime() / 86400000);
function phase() {
  const h = new Date().getHours();
  if (h >= 3 && h < 9) return "dawn";
  if (h >= 9 && h < 17) return "day";
  if (h >= 17 && h < 20) return "eve";
  return "night";
}
const fmt = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), r = s % 60; return m + ":" + String(r).padStart(2, "0"); };
const bnDigits = s => String(s).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);

/* ---------- router ---------- */
const views = {};
function go(tab, sub) {
  if (!D) return;
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  history.replaceState(null, "", "#" + tab);
  applyPrefs();
  (views[tab] || views.today)(sub);
  window.scrollTo(0, 0);
}
$("#tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) go(b.dataset.tab); });
$("#settingsBtn").addEventListener("click", () => openSettings());

/* ---------- ToDAY ---------- */
const CHECKS = [
  { k: "dawn", bn: "প্রাতঃ নামধ্যান", en: "Dawn sitting" },
  { k: "ishta", bn: "ইষ্টভৃতি", en: "Ishtabhriti" },
  { k: "mprayer", bn: "প্রাতঃকালীন প্রার্থনা", en: "Morning prayer" },
  { k: "sava", bn: "শবাসন (২য় দফা)", en: "Savasana, 3–4 times", count: 4 },
  { k: "eprayer", bn: "সান্ধ্য প্রার্থনা", en: "Evening prayer" },
  { k: "night", bn: "রাত্রি নামধ্যান", en: "Night sitting" }
];
views.today = () => {
  const t = today(), ph = phase(), T = D.text;
  const P = {
    dawn: { k: "ভোর · Dawn", h: "<span class='bn'>উষায় মন্ত্রসাধন</span> <span class='en'>· the dawn sitting</span>",
      p: pair("জপ ও ধ্যানের পর অন্নজলাদি গ্রহণের পূর্ব্বেই ইষ্টভৃতি।", "After japa and dhyan, Ishtabhriti before any food or water."),
      a: `<button class="btn primary" data-sit="full">বসুন · Sit now</button> <button class="btn" data-read="ishtabhriti">ইষ্টভৃতি</button>` },
    day: { k: "দিন · The day", h: "<span class='bn'>চলা-ফেরায় জপ</span> <span class='en'>· the Name running through work</span>",
      p: pair(T.dapha2_bn, T.dapha2_en),
      a: `<button class="btn primary" data-sit="sava">শবাসন · Savasana</button> <button class="btn" data-sit="short">২–১০ মিনিট বসা</button>` },
    eve: { k: "সন্ধ্যা · Evening", h: "<span class='bn'>সান্ধ্য প্রার্থনা</span> <span class='en'>· evening prayer</span>",
      p: pair("", "\"At sandhya the sound is heard.\""),
      a: `<button class="btn primary" data-tab-go="prayer">প্রার্থনা · Prayer</button> <button class="btn" data-sit="short">২–১০ মিনিট বসা</button>` },
    night: { k: "রাত্রি · Night", h: "<span class='bn'>নিশায় মন্ত্রসাধন</span> <span class='en'>· the night sitting</span>",
      p: pair("ঘুমের আগে, একই ভাবে।", "Before sleep, the same way."),
      a: `<button class="btn primary" data-sit="full">বসুন · Sit now</button> <button class="btn" data-sit="floor">কঠিন দিন · Hard day</button>` }
  }[ph];
  const say = T.sayings[dayIndex() % T.sayings.length];
  const ses = D.sessions[dayIndex() % D.sessions.length];
  const checks = CHECKS.map(c => {
    if (c.count) {
      const n = t[c.k] || 0;
      return `<li data-check="${c.k}" class="${n >= 3 ? "done" : ""}"><span class="box">${n >= 3 ? "✓" : ""}</span><span class="lbl"><span class="bn">${c.bn}</span> <span class="en note">${c.en}</span></span><span class="count">${Array.from({ length: c.count }, (_, i) => `<i class="${i < n ? "f" : ""}"></i>`).join("")}</span></li>`;
    }
    return `<li data-check="${c.k}" class="${t[c.k] ? "done" : ""}"><span class="box">${t[c.k] ? "✓" : ""}</span><span class="lbl"><span class="bn">${c.bn}</span> <span class="en note">${c.en}</span></span></li>`;
  }).join("");
  const d = new Date();
  $("#view").innerHTML = `
    <p class="kicker">${d.toLocaleDateString("bn-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
    <div class="card phase"><p class="kicker">${P.k}</p><h2 style="margin-top:0">${P.h}</h2>${P.p}<div class="row" style="margin-top:12px">${P.a}</div></div>
    <div class="card"><p class="kicker">আজকের খাতা · Today</p><ul class="checks">${checks}</ul>
      <p class="note" style="margin:.6rem 0 0">শবাসনে টোকা দিলে একটি করে গোনা হয় · Tap savasana to count one.</p></div>
    <div class="card tint q"><p class="kicker">শ্রীশ্রীঠাকুর</p>${pair(say.bn, say.en)}</div>
    <div class="card"><p class="kicker">বসার আগে · Before the Sitting · ${ses.n}/38</p>
      <h3 style="margin-top:0">${esc(ses.t)}</h3><p class="note">${esc(ses.th)}</p><p>${esc(ses.a)}</p>
      <div class="row"><a class="btn sm" href="${ses.u}" target="_blank" rel="noopener">Notion-এ পড়ুন</a>${ses.audio ? `<button class="btn sm" data-read="audio">শুনুন · Listen</button>` : ""}<button class="btn sm" data-read="sessions">সব · All 38</button></div></div>
    <div class="card floor-card"><p class="kicker">দ্রষ্টব্য · The minimum, on a hard day</p>${pair(T.drashtabya_bn, T.drashtabya_en)}
      <button class="btn sm" data-sit="floor">এখন করুন · Do it now</button></div>`;
};
document.addEventListener("click", e => {
  const c = e.target.closest("[data-check]");
  if (c && D) {
    const t = today(), k = c.dataset.check;
    if (k === "sava") t.sava = ((t.sava || 0) + 1) % 5; else t[k] = !t[k];
    saveLog(); views.today(); return;
  }
  const s = e.target.closest("[data-sit]"); if (s && D) { startSit(s.dataset.sit); return; }
  const r = e.target.closest("[data-read]"); if (r && D) { go("read", r.dataset.read); return; }
  const g = e.target.closest("[data-tab-go]"); if (g && D) { go(g.dataset.tabGo); return; }
});

/* ---------- SIT tab ---------- */
views.sit = () => {
  const T = D.text;
  $("#view").innerHTML = `
    <h2>বসা · Sit</h2>
    <div class="card phase"><h3 style="margin-top:0"><span class="bn">পূর্ণ নামধ্যান</span> <span class="en">· the full sitting</span></h3>
      <p class="note">উপদেশ-পত্র ১ম দফা (ক)–(ছ), ধাপে ধাপে · Ritwik book, step by step.</p>
      <button class="btn primary block" data-sit="full">শুরু করুন · Begin</button></div>
    <div class="card"><h3 style="margin-top:0"><span class="bn">কঠিন দিন</span> <span class="en">· the hard day (দ্রষ্টব্য)</span></h3>
      ${pair(T.drashtabya_bn, T.drashtabya_en)}<button class="btn block" data-sit="floor">তেস্‌রা তিলে নাম · Name at the tesra til</button></div>
    <div class="card"><h3 style="margin-top:0"><span class="bn">শবাসন</span> <span class="en">· 2nd dapha</span></h3>
      ${pair(T.dapha2_bn, T.dapha2_en)}<button class="btn block" data-sit="sava">শবাসন · ৫–৬ মিনিট</button></div>
    <div class="card"><h3 style="margin-top:0"><span class="bn">২ মিনিট ১০ মিনিট</span> <span class="en">· whenever you can</span></h3>
      ${pair(T.sayings[4].bn, T.sayings[4].en)}<button class="btn block" data-sit="short">বসুন · Sit</button></div>`;
};

/* ---------- timer + sound + wake lock ---------- */
const timer = { running: false, end: 0, raf: 0, wake: null, ac: null };
function tone() {
  if (!S.tone) return;
  try {
    const ac = timer.ac || (timer.ac = new (window.AudioContext || window.webkitAudioContext)());
    const now = ac.currentTime;
    [0, 2.2].forEach(off => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = 432;
      g.gain.setValueAtTime(0.0001, now + off);
      g.gain.exponentialRampToValueAtTime(0.25, now + off + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + off + 2);
      o.connect(g).connect(ac.destination); o.start(now + off); o.stop(now + off + 2.1);
    });
  } catch {}
  if (navigator.vibrate) navigator.vibrate([200, 300, 200]);
}
function primeAudio() { // must run inside a tap so iOS allows the end tone later
  try {
    timer.ac = timer.ac || new (window.AudioContext || window.webkitAudioContext)();
    const b = timer.ac.createBuffer(1, 1, 22050), s = timer.ac.createBufferSource(); s.buffer = b; s.connect(timer.ac.destination); s.start(0);
  } catch {}
}
async function wakeOn() { try { timer.wake = await navigator.wakeLock?.request("screen"); } catch {} }
function wakeOff() { try { timer.wake?.release(); } catch {} timer.wake = null; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && timer.running) wakeOn(); });

/* dark screen for eyes-closed time */
function darkSit(seconds, hint, onDone) {
  primeAudio(); wakeOn();
  const el = $("#dark");
  el.innerHTML = `<div class="d-time"></div><div class="d-hint">${hint}</div><button class="d-end">শেষ করুন · End</button>`;
  el.hidden = false; el.classList.remove("show");
  const start = Date.now(); timer.running = true; timer.end = start + seconds * 1000;
  let showT;
  el.onclick = e => {
    if (e.target.classList.contains("d-end")) { finish(true); return; }
    el.classList.add("show"); clearTimeout(showT); showT = setTimeout(() => el.classList.remove("show"), 4000);
  };
  function tick() {
    const left = (timer.end - Date.now()) / 1000;
    $(".d-time", el).textContent = left > 0 ? fmt(left) : "+" + fmt(-left);
    if (left <= 0 && !timer.toned) { timer.toned = true; tone(); el.classList.add("show"); }
    timer.raf = requestAnimationFrame(tick);
  }
  timer.toned = false; tick();
  function finish() {
    cancelAnimationFrame(timer.raf); timer.running = false; wakeOff();
    el.hidden = true; el.onclick = null;
    onDone(Math.round((Date.now() - start) / 60000));
  }
}

/* small inline countdown inside a step */
function inlineTimer(host, seconds, label) {
  host.innerHTML = `<div class="clock">${fmt(seconds)}</div><p class="note" style="text-align:center">${label}</p>
    <div class="row" style="justify-content:center"><button class="btn sm" data-t="go">শুরু · Start</button></div>`;
  let end = 0, raf = 0;
  host.querySelector("[data-t]").onclick = ev => {
    primeAudio();
    if (raf) { cancelAnimationFrame(raf); raf = 0; ev.target.textContent = "শুরু · Start"; return; }
    end = Date.now() + seconds * 1000; ev.target.textContent = "থামুন · Stop";
    const tick = () => {
      const left = (end - Date.now()) / 1000;
      host.querySelector(".clock").textContent = fmt(left);
      if (left <= 0) { tone(); raf = 0; ev.target.textContent = "শুরু · Start"; return; }
      raf = requestAnimationFrame(tick);
    };
    tick();
  };
  return () => cancelAnimationFrame(raf);
}

/* ---------- the sitting flows ---------- */
function startSit(kind) {
  const T = D.text, ov = $("#overlay");
  ov.hidden = false; document.body.style.overflow = "hidden";
  const close = () => { ov.hidden = true; ov.innerHTML = ""; document.body.style.overflow = ""; if (location.hash.slice(1) === "today") views.today(); };
  const swatah = () => `<div class="card tint"><p class="kicker">স্বতঃ-অনুজ্ঞা · Swatah-Anugya</p>
      <div class="pair"><p class="bn verse">${T.swatah_bn.join("<br>")}</p><p class="en verse">${T.swatah_en.join("<br>")}</p></div>
      ${pair(T.swatah_note_bn, T.swatah_note_en, "note")}</div>`;
  const logSit = (mins, which) => {
    const t = today();
    const slot = which || (phase() === "dawn" || phase() === "day" ? "dawn" : "night");
    t[slot] = true; t.min = (t.min || 0) + mins; saveLog();
  };
  const durChoice = (def, opts) => `<div class="choice" id="dur">${opts.map(m => `<button data-m="${m}" class="${m === def ? "on" : ""}">${bnDigits(m)} মি</button>`).join("")}</div>`;
  const pickDur = () => +($("#dur .on")?.dataset.m || S.dur);
  ov.onclick = e => { const b = e.target.closest("#dur button"); if (b) { $("#dur .on")?.classList.remove("on"); b.classList.add("on"); } };

  if (kind === "full") {
    const steps = T.steps; let i = 0, stopInline = null;
    const render = () => {
      stopInline?.(); stopInline = null;
      const st = steps[i];
      let extra = "";
      if (st.gaze) extra = `<img class="gaze" src="${D.img[S.gaze] || D.img["gaze-chakra"]}" alt="শ্রীশ্রীঠাকুর"><div id="it"></div>`;
      else if (st.timer) extra = `<div id="it"></div>`;
      if (st.sit) extra = `<div class="card tint"><p class="kicker">সময় · Duration</p>${durChoice(S.dur, [30, 45, 60, 90])}
        <p class="note" style="margin-bottom:0">চোখ বন্ধ করুন, চাদর ঢেকে নিন। স্ক্রিন অন্ধকার থাকবে; টোকা দিলে সময় দেখাবে। · Screen stays dark; tap to see the time.</p></div>`;
      if (st.swatah) extra = swatah();
      ov.innerHTML = `<div class="ov-inner">
        <div class="ov-top"><button class="back" data-x>✕ বন্ধ</button><span class="note">${bnDigits(i + 1)} / ${bnDigits(steps.length)}</span></div>
        <div class="progress">${steps.map((_, j) => `<i class="${j <= i ? "on" : ""}"></i>`).join("")}</div>
        <div class="ov-body"><h2>${st.label}</h2>${st.gaze ? extra : ""}${pair(st.bn, st.en)}${st.eng ? `<p class="en src">English edition: ${st.eng}</p>` : ""}${st.gaze ? "" : extra}</div>
        <div class="ov-foot">${i > 0 ? `<button class="btn" data-prev>← আগে</button>` : ""}
          ${st.sit ? `<button class="btn primary" data-close-eyes>চোখ বন্ধ · Begin</button>` : i === steps.length - 1 ? `<button class="btn primary" data-done>প্রণাম · Done</button>` : `<button class="btn primary" data-next>পরে →</button>`}</div></div>`;
      const it = $("#it", ov);
      if (it && st.timer) stopInline = inlineTimer(it, st.timer, st.timerLabel);
      ov.scrollTop = 0;
    };
    let minutes = 0;
    ov.addEventListener("click", function h(e) {
      if (!ov.contains(e.target) || ov.hidden) return;
      if (e.target.closest("[data-x]")) { stopInline?.(); ov.removeEventListener("click", h); close(); }
      else if (e.target.closest("[data-next]")) { i++; render(); }
      else if (e.target.closest("[data-prev]")) { i--; render(); }
      else if (e.target.closest("[data-close-eyes]")) {
        const m = pickDur(); S.dur = m; saveS();
        darkSit(m * 60, D.text.name_word + " · তেস্‌রা তিলে", got => { minutes = got; i++; render(); });
      } else if (e.target.closest("[data-done]")) { logSit(minutes); ov.removeEventListener("click", h); close(); }
    });
    render();
    return;
  }

  // the shorter flows share one screen
  const cfg = {
    floor: { h: "কঠিন দিন · The hard day", body: pair(T.drashtabya_bn, T.drashtabya_en) + `<p class="note">প্রণাম: <span class="mantra bn">"${T.pranam_bn}"</span></p>`, opts: [5, 10, 15, 30], def: 10, hint: "তেস্‌রা তিলে ইষ্টমনন ও নাম", sw: true },
    sava: { h: "শবাসন · Savasana (২য় দফা)", body: pair(T.dapha2_bn, T.dapha2_en), opts: [5, 6], def: 6, hint: "মস্তকের পশ্চাদ্ভাগে · back of the head", sw: false, which: "sava" },
    short: { h: "২ মিনিট ১০ মিনিট", body: pair(T.sayings[4].bn, T.sayings[4].en), opts: [2, 5, 10], def: 10, hint: D.text.name_word, sw: false, which: "short" }
  }[kind];
  ov.innerHTML = `<div class="ov-inner"><div class="ov-top"><button class="back" data-x>✕ বন্ধ</button></div>
    <div class="ov-body"><h2>${cfg.h}</h2>${cfg.body}<div class="card tint"><p class="kicker">সময় · Duration</p>${durChoice(cfg.def, cfg.opts)}</div></div>
    <div class="ov-foot"><button class="btn primary" data-go>শুরু · Begin</button></div></div>`;
  ov.addEventListener("click", function h(e) {
    if (e.target.closest("[data-x]")) { ov.removeEventListener("click", h); close(); }
    if (e.target.closest("[data-go]")) {
      const m = pickDur();
      darkSit(m * 60, cfg.hint, got => {
        const t = today();
        if (cfg.which === "sava") { t.sava = Math.min(4, (t.sava || 0) + 1); saveLog(); }
        else if (cfg.which === "short") { t.min = (t.min || 0) + got; saveLog(); }
        else logSit(got);
        if (cfg.sw) {
          ov.innerHTML = `<div class="ov-inner"><div class="ov-body"><h2>প্রণাম · Pranam</h2>
            <p class="bn mantra">"${T.pranam_bn}"</p>${swatah()}</div>
            <div class="ov-foot"><button class="btn primary" data-x>প্রণাম · Done</button></div></div>`;
        } else { ov.removeEventListener("click", h); close(); }
      });
    }
  });
}

/* ---------- PRAYER ---------- */
let ytReady = null;
function loadYT() {
  return ytReady ||= new Promise(res => {
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  });
}
views.prayer = (which) => {
  const pr = D.text.prayers;
  const sel = pr.find(p => p.id === which) || pr.find(p => p.id === (phase() === "eve" || phase() === "night" ? "evening" : "morning"));
  $("#view").innerHTML = `<h2>প্রার্থনা · Prayer</h2>
    <div class="choice">${pr.map(p => `<button data-pr="${p.id}" class="${p === sel ? "on" : ""}"><span class="bn">${p.bn}</span> <span class="en">· ${p.en}</span></button>`).join("")}</div>
    <div class="video"><div id="yt"></div></div>
    <div class="row"><span class="note">গতি · Speed</span><div class="choice" id="spd">${[1, 1.25, 1.5, 1.75].map(v => `<button data-s="${v}" class="${v === S.speed ? "on" : ""}">${v}×</button>`).join("")}</div></div>
    <p class="note">ইন্টারনেট লাগবে · Needs internet. <a href="https://www.youtube.com/watch?v=${sel.yt}" target="_blank" rel="noopener">YouTube-এ খুলুন</a> (screen-off listening).</p>
    ${sel.sections.length ? `<h3>অংশ · Sections</h3><ul class="secs">${sel.sections.map(s => `<li><button data-seek="${s.seconds}">${s.start}</button><span class="bn">${esc(s.title)}</span>${s.text ? `<div class="stext bn">${esc(s.text)}</div>` : ""}</li>`).join("")}</ul>` : ""}`;
  $("#view").querySelectorAll("[data-pr]").forEach(b => b.onclick = () => views.prayer(b.dataset.pr));
  let player;
  loadYT().then(() => {
    player = new YT.Player("yt", { videoId: sel.yt, playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: { onReady: () => player.setPlaybackRate(S.speed), onStateChange: ev => { if (ev.data === 1 && player.getPlaybackRate() !== S.speed) player.setPlaybackRate(S.speed); } } });
  });
  $("#spd").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.speed = +b.dataset.s; saveS(); $("#spd .on")?.classList.remove("on"); b.classList.add("on"); player?.setPlaybackRate?.(S.speed); };
  $("#view").querySelectorAll("[data-seek]").forEach(b => b.onclick = () => { player?.seekTo?.(+b.dataset.seek, true); player?.playVideo?.(); window.scrollTo({ top: 0, behavior: "smooth" }); });
};

/* ---------- READ ---------- */
const READS = [
  ["upadesh", "উপদেশ-পত্র (১ম–৩য় দফা, দ্রষ্টব্য)", "The initiation instructions, as printed"],
  ["swatah", "স্বতঃ-অনুজ্ঞা", "Swatah-Anugya"],
  ["ishtabhriti", "ইষ্টভৃতি", "Ishtabhriti mantra"],
  ["sankalpa", "সংকল্প", "The four resolves"],
  ["name", "নাম", "The Name, in Thakur's words"],
  ["guide", "নামধ্যান গাইড", "How to meditate (full guide)"],
  ["sayings", "শ্রীশ্রীঠাকুরের বাণী", "Sayings on the Name"],
  ["sessions", "বসার আগে (৩৮)", "Before the Sitting, 38 sessions"],
  ["comp_bn", "নাম ও ধ্যান — বাংলা সংকলন", "Full Bangla compilation, searchable"],
  ["comp_en", "Nam and Dhyan — English compilation", "Full English compilation, searchable"],
  ["books", "বই · Ritwik book, Dikshanuchalan", "Page by page"],
  ["audio", "ধ্যান-নির্দেশ, Session 01", "Guided meditation audio"],
  ["photos", "ছবি", "Thakur's chakra photos"],
  ["links", "Notion ও অন্যান্য", "Links for deeper reading"]
];
views.read = (sub) => {
  if (sub && readers[sub]) return readers[sub]();
  $("#view").innerHTML = `<h2>পাঠ · Read</h2><ul class="list">${READS.map(([k, bn, en]) =>
    `<li><button data-r="${k}"><span><span class="bn">${bn}</span><br><span class="note">${en}</span></span><span class="chev">›</span></button></li>`).join("")}</ul>`;
  $("#view").querySelectorAll("[data-r]").forEach(b => b.onclick = () => { history.replaceState(null, "", "#read"); readers[b.dataset.r](); window.scrollTo(0, 0); });
};
const backBtn = `<button class="back" data-back>← পাঠ</button>`;
function readerPage(html) {
  $("#view").innerHTML = backBtn + `<div class="reader">${html}</div>`;
  $("#view [data-back]").onclick = () => views.read();
}
const readers = {
  upadesh() {
    const T = D.text;
    readerPage(`<h2>উপদেশ-পত্র · ১ম দফা</h2><p class="note">ঋত্বিক্, দীক্ষা-পদ্ধতি, pp. ২১–২৩ · as printed.</p>
      <ol class="steps">${T.steps.map(s => `<li><b>${s.label}</b>${pair(s.bn, s.en)}${s.eng ? `<p class="en src">English edition: ${s.eng}</p>` : ""}</li>`).join("")}</ol>
      <div class="pair"><p class="bn verse">${T.swatah_bn.join("<br>")}</p><p class="en verse">${T.swatah_en.join("<br>")}</p></div>${pair(T.swatah_note_bn, T.swatah_note_en, "note")}
      <h2>২য় দফা</h2>${pair(T.dapha2_bn, T.dapha2_en)}
      <h2>৩য় দফা</h2>${pair(T.dapha3_bn, T.dapha3_en)}
      <div class="box floor"><h3 style="margin-top:0">দ্রষ্টব্য</h3>${pair(T.drashtabya_bn, T.drashtabya_en)}</div>
      <p class="note">Ritwik book, Part 1 pages 22–24 and Part 2 pages 1–2 · পাঠ › বই.</p>`);
  },
  swatah() {
    const T = D.text;
    readerPage(`<h2>স্বতঃ-অনুজ্ঞা</h2><p class="bn mantra">"${T.pranam_bn}"</p>
      <div class="pair"><p class="bn verse" style="font-size:1.15rem">${T.swatah_bn.join("<br>")}</p><p class="en verse">${T.swatah_en.join("<br>")}</p></div>${pair(T.swatah_note_bn, T.swatah_note_en, "note")}`);
  },
  ishtabhriti() {
    const T = D.text;
    readerPage(`<h2>ইষ্টভৃতি · Ishtabhriti</h2>${pair(T.ishtabhriti_bn, T.ishtabhriti_en)}
      <div class="box">${pair(`<span class="mantra" style="font-size:1.15rem">${T.ishtabhriti_mantra_bn}</span>`, `<span class="mantra">${T.ishtabhriti_mantra_en}</span>`)}</div>
      ${pair(T.ishtabhriti_meaning_bn, T.ishtabhriti_meaning_en)}${pair(T.shraddha_bn, T.shraddha_en)}<p class="note">দীক্ষানুচলন.</p>
      <button class="btn primary" id="ishDone">${today().ishta ? "✓ আজ করা হয়েছে" : "আজ করলাম · Done today"}</button>`);
    $("#ishDone").onclick = () => { today().ishta = true; saveLog(); $("#ishDone").textContent = "✓ আজ করা হয়েছে"; };
  },
  sankalpa() { const T = D.text; readerPage(`<h2>সংকল্প</h2><p class="note">ঋত্বিক্, pp. ২৬–২৭.</p>${pair(T.sankalpa_bn, T.sankalpa_en)}`); },
  name() {
    const T = D.text;
    readerPage(`<h2>নাম · ${T.name_word}</h2>${T.name_bn.map((b, i) => pair(b, T.name_en[i], "q")).join("")}
      <p class="en">"This Name may be called a dhunatmaka Name. Everything in the universe is created from vibration. Within this Name is the mechanism of vibration. So it fulfils each and every thing."</p>
      <p class="en">"The Name becomes meaningful in the Nami."</p>`);
  },
  guide() { readerPage(D.guide); },
  sayings() { readerPage(`<h2>বাণী · Sayings</h2>${D.text.sayings.map(s => `<div class="card tint q">${pair(s.bn, s.en)}</div>`).join("")}`); },
  sessions() {
    readerPage(`<h2>বসার আগে · Before the Sitting</h2><p class="note">৩৮টি পাঠ; আজ-এ প্রতিদিন একটি · One appears on Today each day.</p>
      ${D.sessions.map(s => `<div class="card"><p class="kicker">${s.n} · ${esc(s.th)}</p><h3 style="margin-top:0">${esc(s.t)}</h3><p>${esc(s.a)}</p><a href="${s.u}" target="_blank" rel="noopener">Notion-এ পড়ুন ›</a></div>`).join("")}`);
  },
  comp_bn() { compReader("comp_bn", "নাম ও ধ্যান — বাংলা সংকলন", true); },
  comp_en() { compReader("comp_en", "Nam and Dhyan — English compilation", false); },
  books() {
    readerPage(`<h2>বই · Books</h2><ul class="list">${D.text.books.map(b => `<li><button data-b="${b.id}"><span>${esc(b.t)}<br><span class="note">${b.pages} pages${b.note ? " · " + esc(b.note) : ""}</span></span><span class="chev">›</span></button></li>`).join("")}</ul>`);
    $("#view").querySelectorAll("[data-b]").forEach(x => x.onclick = () => bookReader(x.dataset.b, store.get("page:" + x.dataset.b, 1)));
  },
  async audio() {
    readerPage(`<h2>ধ্যান-নির্দেশ · Guided meditation, Session 01</h2><p class="note">"The Name itself is He." · খুলছে…</p><audio id="aud" controls style="width:100%"></audio>`);
    try {
      const buf = await openFile("data/a/session01.bin");
      const a = $("#aud"); if (!a) return;
      a.src = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      $(".reader .note").textContent = "\"The Name itself is He.\"";
    } catch { $(".reader .note").textContent = "খোলা গেল না · Could not load (offline the first time?)"; }
  },
  photos() { readerPage(`<h2>ছবি</h2>${["gaze-chakra", "gaze-portrait", "chakra-photo-square", "chakra-dual-photo-pro"].map(k => D.img[k] ? `<img src="${D.img[k]}" style="width:100%;border-radius:12px;margin:8px 0" alt="শ্রীশ্রীঠাকুর">` : "").join("")}`); },
  links() { readerPage(`<h2>Notion ও অন্যান্য · Links</h2><ul class="list">${D.text.links.map(l => `<li><a href="${l.u}" target="_blank" rel="noopener"><span>${esc(l.t)}</span><span class="chev">↗</span></a></li>`).join("")}</ul>`); }
};
function compReader(key, title, bn) {
  const paras = D[key].split(/\n+/).filter(Boolean);
  readerPage(`<h2>${title}</h2><div class="search"><input id="q" placeholder="খুঁজুন · Search" type="search"></div><p class="note" id="qn"></p><div class="comp ${bn ? "bn" : ""}" id="cp"></div>`);
  const cp = $("#cp");
  const renderAll = () => { cp.innerHTML = paras.map(p => `<p>${esc(p)}</p>`).join(""); $("#qn").textContent = ""; };
  renderAll();
  let t;
  $("#q").oninput = e => {
    clearTimeout(t); t = setTimeout(() => {
      const q = e.target.value.trim();
      if (q.length < 2) return renderAll();
      const src = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/‌/g, "‌?");
      const test = new RegExp(src, "i"), re = new RegExp(src, "gi");
      const hits = paras.filter(p => test.test(p));
      $("#qn").textContent = hits.length + " টি অনুচ্ছেদ · paragraphs";
      cp.innerHTML = hits.map(p => `<p>${esc(p).replace(re, m => `<mark>${m}</mark>`)}</p>`).join("");
    }, 250);
  };
}
async function bookReader(id, page) {
  const b = D.text.books.find(x => x.id === id);
  page = Math.min(Math.max(1, page), b.pages); store.set("page:" + id, page);
  $("#view").innerHTML = `<button class="back" data-bk>← বই</button><h3>${esc(b.t)}</h3>
    <img class="book-page" id="pg" alt="page ${page}">
    <div class="book-nav"><button class="btn sm" data-p="-1">‹</button><input id="pn" inputmode="numeric" value="${page}"><span class="note">/ ${b.pages}</span><button class="btn sm" data-p="1">›</button></div>`;
  $("#view [data-bk]").onclick = () => readers.books();
  $("#view").querySelectorAll("[data-p]").forEach(x => x.onclick = () => bookReader(id, page + +x.dataset.p));
  $("#pn").onchange = e => bookReader(id, +e.target.value || 1);
  let sx = 0; const img = $("#pg");
  img.addEventListener("touchstart", e => { if (e.touches.length === 1) sx = e.touches[0].clientX; }, { passive: true });
  img.addEventListener("touchend", e => { if (!sx || e.changedTouches.length !== 1) return; const dx = e.changedTouches[0].clientX - sx; sx = 0; if (Math.abs(dx) > 60) bookReader(id, page + (dx < 0 ? 1 : -1)); });
  try {
    const buf = await openFile(`data/b/${id}/${page}.bin`);
    if ($("#pg") === img) img.src = URL.createObjectURL(new Blob([buf], { type: "image/jpeg" }));
  } catch { img.alt = "খোলা গেল না · Could not load page"; }
}

/* ---------- LOG ---------- */
views.log = (ym) => {
  const now = new Date();
  let [y, m] = (ym || `${now.getFullYear()}-${now.getMonth()}`).split("-").map(Number);
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  const pad = (first.getDay() + 6) % 7; // week starts Monday
  let sat = 0, mins = 0;
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push(`<div class="d empty"></div>`);
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, e = LOG[k] || {};
    const n = (e.dawn ? 1 : 0) + (e.night ? 1 : 0);
    if (n) sat++; mins += e.min || 0;
    cells.push(`<div class="d ${n === 2 ? "both" : n ? "sat" : ""} ${k === dkey() ? "today" : ""}" data-day="${k}">${bnDigits(d)}</div>`);
  }
  const title = first.toLocaleDateString("bn-IN", { month: "long", year: "numeric" });
  const prev = m === 0 ? `${y - 1}-11` : `${y}-${m - 1}`, next = m === 11 ? `${y + 1}-0` : `${y}-${m + 1}`;
  $("#view").innerHTML = `<h2>খাতা · Log</h2>
    <div class="card"><div class="row" style="justify-content:space-between"><button class="btn sm" data-ym="${prev}">‹</button><b class="bn">${title}</b><button class="btn sm" data-ym="${next}">›</button></div>
      <div class="cal" style="margin-top:12px">${["সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি", "রবি"].map(h => `<div class="h">${h}</div>`).join("")}${cells.join("")}</div>
      <div class="legend"><span class="l1">একবার · one sitting</span><span class="l2">ভোর ও রাত্রি · dawn and night</span></div>
      <p class="note" style="margin-bottom:0">${bnDigits(sat)} দিন বসা হয়েছে · ${bnDigits(mins)} মিনিট</p></div>
    <div class="card tint q">${pair(D.text.sayings[2].bn, D.text.sayings[2].en)}</div>
    <div id="dayDetail"></div>
    <div class="card"><p class="kicker">ব্যাকআপ · Backup</p><p class="note">খাতা শুধু এই ফোনে থাকে · The log lives only on this device.</p>
      <div class="row"><button class="btn sm" id="exp">Export</button><label class="btn sm">Import<input type="file" id="imp" accept="application/json" hidden></label></div></div>`;
  $("#view").querySelectorAll("[data-ym]").forEach(b => b.onclick = () => views.log(b.dataset.ym));
  $("#view").querySelectorAll("[data-day]").forEach(c => c.onclick = () => {
    const e = LOG[c.dataset.day] || {};
    $("#dayDetail").innerHTML = `<div class="card"><p class="kicker">${c.dataset.day}</p><ul class="checks">${CHECKS.map(k => `<li class="${(k.count ? e[k.k] >= 3 : e[k.k]) ? "done" : ""}"><span class="box">${(k.count ? e[k.k] >= 3 : e[k.k]) ? "✓" : ""}</span><span class="lbl bn">${k.bn}${k.count ? ` · ${bnDigits(e[k.k] || 0)}` : ""}</span></li>`).join("")}</ul>${e.min ? `<p class="note">${bnDigits(e.min)} মিনিট</p>` : ""}</div>`;
  });
  $("#exp").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ log: LOG, settings: S }, null, 1)], { type: "application/json" }));
    a.download = `sadhan-bhajan-${dkey()}.json`; a.click();
  };
  $("#imp").onchange = async e => {
    try { const j = JSON.parse(await e.target.files[0].text()); Object.assign(LOG, j.log || {}); saveLog(); views.log(); } catch { alert("Could not read that file"); }
  };
};

/* ---------- SETTINGS ---------- */
function openSettings() {
  const ov = $("#overlay"); ov.hidden = false;
  const opt = (k, vals) => `<div class="choice" data-k="${k}">${vals.map(([v, l]) => `<button data-v="${v}" class="${String(S[k]) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
  ov.innerHTML = `<div class="ov-inner"><div class="ov-top"><h2 style="margin:0">সেটিংস · Settings</h2><button class="back" data-x>✕</button></div><div class="ov-body">
    <h3>ভাষা · Language</h3>${opt("lang", [["both", "বাংলা + English"], ["bn", "শুধু বাংলা"], ["en", "English only"]])}
    <h3>রং · Theme</h3>${opt("theme", [["auto", "Auto (রাতে অন্ধকার)"], ["day", "Day"], ["night", "Night"]])}
    <h3>শেষে মৃদু ধ্বনি · End tone</h3>${opt("tone", [["true", "On"], ["false", "Off"]])}
    <p class="note">সময় শেষে একটি মৃদু ধ্বনি, যাতে চোখ খুলতে না হয়। আর কোনো শব্দ বা সঙ্গীত নেই। · One soft tone when time is up; no other sound.</p>
    <h3>বসার সময় · Default sitting</h3>${opt("dur", [[30, "৩০ মি"], [45, "৪৫ মি"], [60, "৬০ মি"], [90, "৯০ মি"]])}
    <h3>ছবি (ঘ) · Gaze photo</h3>${opt("gaze", [["gaze-chakra", "চক্র · Chakra"], ["gaze-portrait", "রঙিন · Colour"]])}
    <div class="row" style="margin-top:12px"><button class="btn sm" id="testTone">ধ্বনি শুনুন · Test tone</button></div>
    <h3>তালা · Lock</h3><button class="btn" id="lockNow">এখনই বন্ধ করুন · Lock now</button>
    <p class="note" style="margin-top:20px">Sadhan Bhajan (for Thakur &amp; Souvik). শুধু শ্রীশ্রীঠাকুর যা দিয়েছেন। Content is encrypted; the log stays on this device.</p>
  </div></div>`;
  ov.onclick = e => {
    const b = e.target.closest("[data-v]");
    if (b) {
      const k = b.parentElement.dataset.k; let v = b.dataset.v;
      if (k === "tone") v = v === "true"; else if (k === "dur") v = +v;
      S[k] = v; saveS(); applyPrefs();
      b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    }
    if (e.target.closest("#testTone")) { primeAudio(); const was = S.tone; S.tone = true; tone(); S.tone = was; }
    if (e.target.closest("#lockNow")) { ov.hidden = true; ov.onclick = null; lock(); }
    if (e.target.closest("[data-x]")) { ov.hidden = true; ov.innerHTML = ""; ov.onclick = null; go(location.hash.slice(1) || "today"); }
  };
}

/* ---------- offline ---------- */
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
setTimeout(() => $("#pass").focus(), 100);
