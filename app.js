/* PM Team Calendar: availability app. No invented data; the calendar starts empty. */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var AHLI = CFG.AHLI || [];
  var SB_URL = (CFG.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  var SB_KEY = (CFG.SUPABASE_KEY || "").trim();
  var MODE_TEAM = !!(SB_URL && SB_KEY);

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]; // by Date.getDay()
  var NOTE_MAX = 60;

  // ---------- small on-device storage (safe if blocked) ----------
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // ---------- dates ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function longLabel(k) { var d = fromKey(k); return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function shortLabel(k) { var d = fromKey(k); return DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function person(id) { for (var i = 0; i < AHLI.length; i++) if (AHLI[i].id === id) return AHLI[i]; return null; }
  function first(n) { return n.split(" ")[0]; }
  var KEY_IDS = AHLI.filter(function (a) { return a.wajib; }).map(function (a) { return a.id; });

  // Server messages are in Malay; show them in English
  function errText(m) {
    if (/PIN salah/i.test(m)) return "Wrong PIN";
    if (/belum ditetapkan/i.test(m)) return "Team PIN has not been set yet";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "No connection";
    return m;
  }

  // ---------- state ----------
  var state = {
    me: lsGet("pm_me"),
    pin: lsGet("pm_pin") || "",
    marks: [],          // [{date, person, slot, note, updated}]
    view: today(),
    sel: key(today()),
    mode: lsGet("pm_mode") === "view" ? "view" : "mark",
    findDays: 60,
    lastSync: null,
    busy: false
  };
  if (state.me && !person(state.me)) state.me = null;
  state.view = new Date(state.view.getFullYear(), state.view.getMonth(), 1);

  function byDate() {
    var m = {};
    state.marks.forEach(function (r) { (m[r.date] = m[r.date] || {})[r.person] = r; });
    return m;
  }
  // ok = everyone free, warn = someone away (boss asked for two colours only, no red)
  // Weekly team days (e.g. Thursday team meeting): everyone is locked, no shoot
  var TEAM_DAYS = CFG.TEAM_DAYS || [];
  function teamDay(k) {
    var dow = fromKey(k).getDay();
    for (var i = 0; i < TEAM_DAYS.length; i++) if (TEAM_DAYS[i].dow === dow) return TEAM_DAYS[i].label;
    return null;
  }
  function statusOf(dm, k) {
    if (k && teamDay(k)) return "lock";
    var ids = Object.keys(dm || {});
    if (!ids.length) return "ok";
    return ids.length ? "warn" : "ok";
  }

  // ---------- data storage ----------
  var LOCAL_KEY = "pm_marks_v1";
  var store = MODE_TEAM ? {
    call: function (fn, args) {
      args.p_pin = state.pin;
      var h = { "Content-Type": "application/json", apikey: SB_KEY };
      if (!/^sb_/.test(SB_KEY)) h.Authorization = "Bearer " + SB_KEY; // legacy anon key (JWT)
      return fetch(SB_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: h, body: JSON.stringify(args) })
        .then(function (r) {
          return r.json().catch(function () { return null; }).then(function (j) {
            if (!r.ok) throw new Error((j && j.message) || ("HTTP " + r.status));
            return j || [];
          });
        });
    },
    list: function () { return this.call("avail_list", {}); },
    toggle: function (date, who) { return this.call("avail_toggle", { p_date: date, p_person: who }); },
    note: function (date, who, note) { return this.call("avail_note", { p_date: date, p_person: who, p_note: note }); },
    check: function (pin) { state.pin = pin; return this.list(); }
  } : {
    read: function () { try { return JSON.parse(lsGet(LOCAL_KEY) || "[]"); } catch (e) { return []; } },
    write: function (a) { lsSet(LOCAL_KEY, JSON.stringify(a)); return Promise.resolve(a); },
    list: function () { return Promise.resolve(this.read()); },
    toggle: function (date, who) {
      var a = this.read(), i = a.findIndex(function (r) { return r.date === date && r.person === who; });
      if (i >= 0) a.splice(i, 1); else a.push({ date: date, person: who, slot: "hari", note: "", updated: new Date().toISOString() });
      return this.write(a);
    },
    note: function (date, who, note) {
      var a = this.read();
      a.forEach(function (r) { if (r.date === date && r.person === who) { r.note = note; r.updated = new Date().toISOString(); } });
      return this.write(a);
    },
    check: function () { return this.list(); }
  };

  function setMarks(m) { state.marks = Array.isArray(m) ? m : []; state.lastSync = new Date(); render(); return state.marks; }

  function refresh(silent) {
    if (!state.me || (MODE_TEAM && !state.pin)) return;
    return store.list().then(setMarks).catch(function (e) {
      if (!silent) toast("Couldn't load data: " + errText(e.message));
      if (/PIN/i.test(e.message)) { state.pin = ""; lsSet("pm_pin", ""); openWho(true); }
    });
  }

  // ---------- rendering ----------
  var $ = function (id) { return document.getElementById(id); };
  function dotHtml(a) {
    return '<span class="dot" style="background:' + a.warna + '" title="' + esc(a.nama) + '">' + esc(a.inisial) + "</span>";
  }

  function render() {
    var me = person(state.me);
    $("meBtn").innerHTML = me ? dotHtml(me) + "<span>" + esc(first(me.nama)) + "</span>" : "<span>Pick your name</span>";
    document.documentElement.style.setProperty("--me", me ? me.warna : "#999");
    $("modeMark").setAttribute("aria-pressed", state.mode === "mark");
    $("modeView").setAttribute("aria-pressed", state.mode === "view");
    $("hint").textContent = state.mode === "mark"
      ? "Mark mode: tap a date you are NOT available. Tap it again to remove."
      : "View mode: tap a date to see details without changing anything.";
    $("banner").innerHTML = MODE_TEAM ? "" : '<div class="banner">Demo mode: marks are saved on this device only.</div>';
    renderCalendar();
    renderFreePanel();
    renderDetail();
    var s = state.lastSync;
    $("sync").innerHTML = s ? "<i></i>" + (MODE_TEAM ? "Live · updated " : "Saved ") + pad(s.getHours()) + ":" + pad(s.getMinutes()) : "";
  }

  function renderCalendar() {
    var v = state.view, y = v.getFullYear(), mo = v.getMonth();
    $("monthTitle").innerHTML = esc(MONTHS[mo]) + " <span>" + y + "</span>";
    $("dow").innerHTML = DOW.map(function (h) { return '<div class="dow">' + h + "</div>"; }).join("");
    var lead = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday first
    var days = new Date(y, mo + 1, 0).getDate();
    var t = key(today()), map = byDate(), html = "";
    for (var i = 0; i < lead; i++) html += '<div class="day out" aria-hidden="true"></div>';
    for (var d = 1; d <= days; d++) {
      var k = key(new Date(y, mo, d)), dm = map[k] || {}, past = k < t;
      var cls = ["day", past ? "past" : statusOf(dm, k)];
      if (k === t) cls.push("today");
      if (k === state.sel) cls.push("sel");
      if (dm[state.me]) cls.push("mine");
      var team = teamDay(k);
      var away = team ? AHLI : AHLI.filter(function (a) { return dm[a.id]; });
      var aria = longLabel(k) + ". " + (team ? team + ", everyone busy" : away.length ? "Not available: " + away.map(function (a) { return a.nama; }).join(", ") : "Everyone available");
      html += '<button class="' + cls.join(" ") + '" data-k="' + k + '" aria-label="' + esc(aria) + '"><span class="num">' + d +
        '</span><span class="dots' + (away.length > 2 ? " many" : "") + '">' + away.map(dotHtml).join("") + "</span></button>";
    }
    $("grid").innerHTML = html;
  }

  function freeDays(n) {
    var t = today(), map = byDate(), out = [];
    for (var i = 0; i < n; i++) { var k = key(addDays(t, i)); if (statusOf(map[k], k) === "ok") out.push(k); }
    return out;
  }

  function renderFreePanel() {
    var list = freeDays(30);
    var chips = list.map(function (k) {
      var d = fromKey(k);
      return '<button class="chip' + (k === state.sel ? " sel" : "") + '" data-k="' + k + '"><span class="d">' + DOW[(d.getDay() + 6) % 7] + " · " + MONTHS[d.getMonth()].slice(0, 3) +
        "</span><b>" + d.getDate() + '</b><span class="t">All free</span></button>';
    }).join("");
    $("freePanel").innerHTML = '<div class="sec-h"><h3>Everyone available</h3><span class="sub">' + list.length + " days · next 30 days</span></div>" +
      (list.length ? '<div class="chips">' + chips + "</div>" : '<p class="empty">No day in the next 30 days where everyone is free.</p>');
    Array.prototype.forEach.call(document.querySelectorAll("#freePanel .chip"), function (b) {
      b.onclick = function () { goTo(b.dataset.k); };
    });
  }

  function renderDetail() {
    var k = state.sel, dm = byDate()[k] || {}, past = k < key(today()), st = statusOf(dm, k), team = teamDay(k);
    var pill = past ? ["past", "Past date"] : team ? ["lock", "🔒 " + team + " · everyone busy"] : st === "ok" ? ["ok", "● Everyone free · OK to lock shoot"] : ["warn", "● Someone is away"];
    var rows = AHLI.map(function (a) {
      var r = dm[a.id];
      if (team) return "<li>" + dotHtml(a) + '<span class="who">' + esc(a.nama) + '<span class="meta">' + esc(team) + '</span></span><span class="tag lock">Locked</span></li>';
      return "<li>" + dotHtml(a) + '<span class="who">' + esc(a.nama) + (r && r.note ? '<span class="meta">' + esc(r.note) + "</span>" : "") + "</span>" +
        (r ? '<span class="tag no">Away</span>' : '<span class="tag ok">Free</span>') + "</li>";
    }).join("");

    var act = "";
    var mine = dm[state.me];
    if (state.me && !past && !team) {
      if (mine) {
        act = '<div class="mine-box"><h4>My mark</h4>' +
          '<label class="f" for="noteIn" style="margin-top:0">Note (optional, everyone can see it)</label>' +
          '<div class="row2" style="grid-template-columns:1fr auto"><input type="text" id="noteIn" maxlength="' + NOTE_MAX + '" placeholder="e.g. other client shoot" value="' + esc(mine.note || "") + '">' +
          '<button class="btn" id="noteSave" style="width:auto">Save</button></div>' +
          '<div class="actions"><button class="btn danger" id="toggleBtn">Remove my mark (I\'m available)</button></div></div>';
      } else {
        act = '<div class="actions"><button class="btn ghost" id="toggleBtn">I\'m NOT available this day</button></div>';
      }
    }
    $("detail").innerHTML = '<h3 class="date">' + esc(longLabel(k)) + '</h3><span class="pill ' + pill[0] + '">' + pill[1] + '</span><ul class="people">' + rows + "</ul>" + act;

    var tb = $("toggleBtn"); if (tb) tb.onclick = function () { toggle(k); };
    var ns = $("noteSave"); if (ns) ns.onclick = saveNote;
    var ni = $("noteIn"); if (ni) ni.onkeydown = function (e) { if (e.key === "Enter") saveNote(); };
  }

  // ---------- actions ----------
  function toggle(k) {
    if (!state.me) return openWho();
    if (k < key(today())) return toast("That date has passed.");
    if (teamDay(k)) return toast("🔒 " + teamDay(k) + " day. Everyone is locked.");
    if (state.busy) return;
    var before = state.marks.slice();
    var had = state.marks.some(function (r) { return r.date === k && r.person === state.me; });
    if (had) state.marks = state.marks.filter(function (r) { return !(r.date === k && r.person === state.me); });
    else state.marks = state.marks.concat([{ date: k, person: state.me, slot: "hari", note: "" }]);
    render();
    toast(had ? "Removed: you're available " + shortLabel(k) : "Marked: you're NOT available " + shortLabel(k));
    state.busy = true;
    store.toggle(k, state.me).then(setMarks).catch(function (e) {
      state.marks = before; render(); toast("Couldn't save: " + errText(e.message));
    }).then(function () { state.busy = false; });
  }

  function saveNote() {
    var v = ($("noteIn").value || "").trim().slice(0, NOTE_MAX), k = state.sel;
    store.note(k, state.me, v).then(function (m) { setMarks(m); toast("Note saved"); })
      .catch(function (e) { toast("Couldn't save note: " + errText(e.message)); });
  }

  function onDayTap(k) {
    state.sel = k;
    if (state.mode === "mark") toggle(k); else render();
  }
  function goTo(k) {
    var d = fromKey(k);
    state.sel = k; state.view = new Date(d.getFullYear(), d.getMonth(), 1);
    render();
    $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- bottom sheets ----------
  function openSheet(html, locked) {
    $("sheet").innerHTML = html;
    $("sheetBg").classList.add("open");
    $("sheetBg").dataset.locked = locked ? "1" : "";
  }
  function closeSheet() { $("sheetBg").classList.remove("open"); }

  function openWho(force) {
    var chosen = state.me;
    var pinField = MODE_TEAM ? '<label class="f" for="pinIn">Team PIN</label><input inputmode="numeric" type="password" id="pinIn" autocomplete="off" maxlength="8" placeholder="••••" value="' + esc(state.pin) + '">' : "";
    var html = '<h3>Who are you?</h3><p class="hint" style="margin-top:0">You can only change your own marks. Everyone can see everyone\'s marks.</p>' +
      '<div class="pick" id="pickList">' + AHLI.map(function (a) {
        return '<button data-id="' + esc(a.id) + '" aria-pressed="' + (a.id === chosen) + '">' + dotHtml(a) + "<span>" + esc(a.nama) + "</span></button>";
      }).join("") + "</div>" + pinField +
      '<div class="actions"><button class="btn" id="whoOk">Continue</button>' + (state.me && !force ? '<button class="btn ghost" id="whoCancel">Cancel</button>' : "") + "</div>";
    openSheet(html, !state.me || force);
    $("pickList").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      chosen = b.dataset.id;
      Array.prototype.forEach.call(this.children, function (c) { c.setAttribute("aria-pressed", c.dataset.id === chosen); });
    };
    var c = $("whoCancel"); if (c) c.onclick = closeSheet;
    $("whoOk").onclick = function () {
      if (!chosen) return toast("Pick your name first");
      var pin = MODE_TEAM ? ($("pinIn").value || "").trim() : "";
      if (MODE_TEAM && !pin) return toast("Enter the team PIN");
      var btn = this; btn.disabled = true; btn.textContent = "Checking...";
      store.check(pin).then(function (m) {
        state.me = chosen; lsSet("pm_me", chosen);
        if (MODE_TEAM) lsSet("pm_pin", pin);
        closeSheet(); setMarks(m);
        if (window.PMCats) window.PMCats.greet(first(person(chosen).nama)); else toast("Hi " + first(person(chosen).nama) + "!");
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "Continue";
        toast(errText(e.message));
      });
    };
  }

  function openFind() {
    var list = freeDays(state.findDays);
    var html = '<h3>Free dates</h3><p class="hint" style="margin-top:0">Days when all 4 people are available.</p>' +
      '<div class="seg" id="findSeg"><button data-n="30" aria-pressed="' + (state.findDays === 30) + '">30 days</button><button data-n="60" aria-pressed="' + (state.findDays === 60) + '">60 days</button></div>' +
      (list.length
        ? '<p class="hint" style="margin:0 2px 10px">' + list.length + ' dates found. Tap one to open it in the calendar.</p><ul class="free-list">' + list.map(function (k) {
            var d = fromKey(k), wk = d.getDay() === 0 || d.getDay() === 6;
            return '<li><button data-k="' + k + '">' + (wk ? "<em>Weekend</em>" : "") + esc(longLabel(k)) + "</button></li>";
          }).join("") + "</ul>"
        : '<p class="empty">No date in the next ' + state.findDays + " days where everyone is free.</p>") +
      '<div class="actions"><button class="btn ghost" id="findClose">Close</button></div>';
    openSheet(html);
    $("findSeg").onclick = function (e) { var b = e.target.closest("button"); if (b) { state.findDays = +b.dataset.n; openFind(); } };
    $("findClose").onclick = closeSheet;
    Array.prototype.forEach.call(document.querySelectorAll(".free-list button"), function (b) {
      b.onclick = function () { closeSheet(); goTo(b.dataset.k); };
    });
  }

  var toastTimer;
  function toast(msg) {
    var el = $("toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  // ---------- lines for the neon cats (reminders from real data + wishes) ----------
  function catLines() {
    var t = today(), map = byDate(), lines = [], me = person(state.me);
    var tk = key(addDays(t, 1)), tomorrow = map[tk] || {}, todayDm = map[key(t)] || {};
    var awayTmr = AHLI.filter(function (a) { return tomorrow[a.id]; }).map(function (a) { return first(a.nama); });
    if (awayTmr.length) lines.push("Heads up: " + awayTmr.join(" & ") + (awayTmr.length > 1 ? " are" : " is") + " away tomorrow 👀");
    else lines.push("Everyone's free tomorrow 🐾");
    if (teamDay(key(t))) lines.push(teamDay(key(t)) + " today, everyone 📋");
    else if (statusOf(todayDm, key(t)) === "ok") lines.push("Everyone's free today. Good day to shoot! 🎬");
    var next = freeDays(30).filter(function (k) { return k > key(t); })[0];
    lines.push(next ? "Next day everyone's free: " + shortLabel(next) + " ✨" : "No full-team day in the next 30 days 😿");
    if (me) {
      var mine = state.marks.filter(function (r) { return r.person === me.id && r.date >= key(t); }).length;
      lines.push(mine ? "You have " + mine + " day" + (mine > 1 ? "s" : "") + " marked as away. Still correct? 🤔"
        : "Any days you can't make it? Tap them so the team knows 🐾");
    }
    if (me) {
      var nm = first(me.nama);
      lines.push("Hi " + nm + "! 👋", "Meow, " + nm + "! Nice to see you 😺");
      var extra = { Firdaus: "Boss " + nm + ", ready to lock the next shoot? 😼",
        Amin: nm + ", camera batteries charged? 🎥", Hana: nm + ", script ready for the next shoot? ✍️",
        Amalina: nm + ", any content ideas today? 💡" }[me.id];
      if (extra) lines.push(extra);
    }
    var dow = t.getDay();
    if (dow === 1) lines.push("New week, new content 💪");
    if (dow === 5) lines.push("Happy Friday, team PM! 🎉");
    lines.push("Have an awesome shoot! 🎬", "Drink some water 💧", "You're doing great, team PM 💙", "Meow. Lock that date, boss 😼", "Purr... good vibes only ✨");
    return lines;
  }
  window.PMApp = { catLines: catLines, me: function () { var p = person(state.me); return p ? first(p.nama) : null; } };

  // ---------- wire up ----------
  $("grid").onclick = function (e) { var b = e.target.closest(".day[data-k]"); if (b) onDayTap(b.dataset.k); };
  $("prevBtn").onclick = function () { state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1); render(); };
  $("nextBtn").onclick = function () { state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1); render(); };
  $("todayBtn").onclick = function () { goTo(key(today())); };
  $("modeMark").onclick = function () { state.mode = "mark"; lsSet("pm_mode", "mark"); render(); };
  $("modeView").onclick = function () { state.mode = "view"; lsSet("pm_mode", "view"); render(); };
  $("meBtn").onclick = function () { openWho(); };
  $("findBtn").onclick = openFind;
  $("sheetBg").onclick = function (e) { if (e.target === this && !this.dataset.locked) closeSheet(); };

  // Swipe left/right to change month
  var sx = null;
  $("grid").addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  $("grid").addEventListener("touchend", function (e) {
    if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 60) (dx < 0 ? $("nextBtn") : $("prevBtn")).click();
  });

  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(true); });
  if (MODE_TEAM) setInterval(function () { if (!document.hidden && !state.busy) refresh(true); }, 60000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});

  render();
  if (!state.me || (MODE_TEAM && !state.pin)) openWho(true); else refresh();
})();
