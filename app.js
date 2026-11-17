/* Kalendar Team PM: app ketersediaan. Tiada data rekaan; kalendar bermula kosong. */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var AHLI = CFG.AHLI || [];
  var API = (CFG.API_URL || "").trim();
  var MODE_TEAM = !!API;

  var BULAN = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
  var HARI_PENDEK = ["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"];
  var HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"]; // ikut Date.getDay()
  var NOTE_MAX = 60;

  // ---------- simpanan kecil dalam peranti (selamat jika diblok) ----------
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }

  // ---------- tarikh ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fromKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function labelPanjang(k) { var d = fromKey(k); return HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear(); }
  function labelPendek(k) { var d = fromKey(k); return HARI[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + BULAN[d.getMonth()].slice(0, 3); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ahli(id) { for (var i = 0; i < AHLI.length; i++) if (AHLI[i].id === id) return AHLI[i]; return null; }

  // ---------- keadaan ----------
  var state = {
    me: lsGet("pm_me"),
    pin: lsGet("pm_pin") || "",
    marks: [],          // [{date, person, slot, note, updated}]
    view: today(),      // bulan yang dipaparkan
    sel: key(today()),
    mode: lsGet("pm_mode") === "view" ? "view" : "mark",
    findDays: 60,
    lastSync: null,
    busy: false
  };
  if (state.me && !ahli(state.me)) state.me = null;
  state.view = new Date(state.view.getFullYear(), state.view.getMonth(), 1);

  function byDate() {
    var m = {};
    state.marks.forEach(function (r) {
      (m[r.date] = m[r.date] || {})[r.person] = r;
    });
    return m;
  }

  // Status hari: ok (semua ada), warn (sebahagian tak ada), bad (orang wajib tak ada)
  function statusOf(dayMarks) {
    var ids = Object.keys(dayMarks || {});
    if (!ids.length) return "ok";
    for (var i = 0; i < ids.length; i++) { var a = ahli(ids[i]); if (a && a.wajib) return "bad"; }
    return "warn";
  }

  // ---------- storan data ----------
  var LOCAL_KEY = "pm_marks_v1";
  var store = MODE_TEAM ? {
    call: function (body) {
      body.pin = state.pin;
      return fetch(API, { method: "POST", body: JSON.stringify(body), redirect: "follow" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) { if (!j.ok) throw new Error(j.error || "Ralat pelayan"); return j; });
    },
    list: function () { return this.call({ action: "list" }).then(function (j) { return j.marks; }); },
    toggle: function (date, person) { return this.call({ action: "toggle", date: date, person: person }).then(function (j) { return j.marks; }); },
    note: function (date, person, note) { return this.call({ action: "note", date: date, person: person, note: note }).then(function (j) { return j.marks; }); },
    check: function (pin) { state.pin = pin; return this.call({ action: "list" }).then(function (j) { return j.marks; }); }
  } : {
    read: function () { try { return JSON.parse(lsGet(LOCAL_KEY) || "[]"); } catch (e) { return []; } },
    write: function (a) { lsSet(LOCAL_KEY, JSON.stringify(a)); return a; },
    list: function () { return Promise.resolve(this.read()); },
    toggle: function (date, person) {
      var a = this.read(), i = a.findIndex(function (r) { return r.date === date && r.person === person; });
      if (i >= 0) a.splice(i, 1); else a.push({ date: date, person: person, slot: "hari", note: "", updated: new Date().toISOString() });
      return Promise.resolve(this.write(a));
    },
    note: function (date, person, note) {
      var a = this.read();
      a.forEach(function (r) { if (r.date === date && r.person === person) { r.note = note; r.updated = new Date().toISOString(); } });
      return Promise.resolve(this.write(a));
    },
    check: function () { return this.list(); }
  };

  function setMarks(m) { state.marks = Array.isArray(m) ? m : []; state.lastSync = new Date(); render(); }

  function refresh(silent) {
    if (!state.me || (MODE_TEAM && !state.pin)) return;
    return store.list().then(setMarks).catch(function (e) {
      if (!silent) toast("Tak dapat muat data: " + e.message);
      if (/PIN/i.test(e.message)) { state.pin = ""; lsSet("pm_pin", ""); openWho(true); }
    });
  }

  // ---------- paparan ----------
  var $ = function (id) { return document.getElementById(id); };

  function dotHtml(a, big) {
    return '<span class="dot" style="background:' + a.warna + '" title="' + esc(a.nama) + '">' + esc(a.inisial) + "</span>";
  }

  function render() {
    var me = ahli(state.me);
    $("meBtn").innerHTML = me ? dotHtml(me) + "<span>" + esc(me.nama.split(" ")[0]) + "</span>" : "<span>Pilih nama</span>";
    document.documentElement.style.setProperty("--me", me ? me.warna : "#999");

    $("modeMark").setAttribute("aria-pressed", state.mode === "mark");
    $("modeView").setAttribute("aria-pressed", state.mode === "view");
    $("hint").textContent = state.mode === "mark"
      ? "Mod Tanda: tekan tarikh yang anda TAK available. Tekan sekali lagi untuk buang."
      : "Mod Lihat: tekan tarikh untuk tengok butiran tanpa ubah apa-apa.";

    var wajib = AHLI.filter(function (a) { return a.wajib; }).map(function (a) { return a.nama.split(" ")[0]; });
    $("legendBad").textContent = (wajib.join("/") || "Orang penting") + " tak ada";

    $("banner").innerHTML = MODE_TEAM ? "" :
      '<div class="banner">Mod cuba: tanda disimpan dalam peranti ini sahaja. Bila storan team disambung, semua orang akan nampak tanda yang sama.</div>';

    renderCalendar();
    renderFreePanel();
    renderDetail();
    $("sync").textContent = state.lastSync ? (MODE_TEAM ? "Dikemas kini " : "Disimpan ") + pad(state.lastSync.getHours()) + ":" + pad(state.lastSync.getMinutes()) : "";
  }

  function renderCalendar() {
    var v = state.view, y = v.getFullYear(), mo = v.getMonth();
    $("monthTitle").textContent = BULAN[mo] + " " + y;
    $("dow").innerHTML = HARI_PENDEK.map(function (h) { return '<div class="dow">' + h + "</div>"; }).join("");

    var first = new Date(y, mo, 1);
    var lead = (first.getDay() + 6) % 7; // Isnin = 0
    var days = new Date(y, mo + 1, 0).getDate();
    var t = key(today()), map = byDate(), html = "";

    for (var i = 0; i < lead; i++) html += '<div class="day out" aria-hidden="true"></div>';
    for (var d = 1; d <= days; d++) {
      var k = key(new Date(y, mo, d)), dm = map[k] || {};
      var past = k < t, st = statusOf(dm);
      var cls = ["day", past ? "past" : st];
      if (k === t) cls.push("today");
      if (k === state.sel) cls.push("sel");
      if (dm[state.me]) cls.push("mine");
      var dots = AHLI.filter(function (a) { return dm[a.id]; }).map(function (a) { return dotHtml(a); }).join("");
      var names = AHLI.filter(function (a) { return dm[a.id]; }).map(function (a) { return a.nama; });
      var aria = labelPanjang(k) + ". " + (names.length ? "Tak available: " + names.join(", ") : "Semua available");
      html += '<button class="' + cls.join(" ") + '" data-k="' + k + '" aria-label="' + esc(aria) + '"><span class="num">' + d + '</span><span class="dots">' + dots + "</span></button>";
    }
    $("grid").innerHTML = html;
  }

  // Panel sentiasa nampak: hari semua orang masih available (30 hari depan)
  function freeDays(n) {
    var t = today(), map = byDate(), list = [];
    for (var i = 0; i <= n; i++) { var k = key(addDays(t, i)); if (statusOf(map[k]) === "ok") list.push(k); }
    return list;
  }
  function renderFreePanel() {
    var list = freeDays(30);
    var chips = list.map(function (k) {
      var d = fromKey(k);
      return '<button class="chip' + (k === state.sel ? " sel" : "") + '" data-k="' + k + '"><small>' + HARI_PENDEK[(d.getDay() + 6) % 7] + "</small><b>" + d.getDate() + "</b><small>" + BULAN[d.getMonth()].slice(0, 3) + "</small></button>";
    }).join("");
    $("freePanel").innerHTML = "<h3>✅ Semua masih available</h3><p class=\"sub\">" +
      (list.length ? list.length + " hari dalam 30 hari depan. Tekan untuk tengok." : "Tiada hari di mana semua available dalam 30 hari depan.") +
      "</p>" + (list.length ? '<div class="chips">' + chips + "</div>" : "");
    Array.prototype.forEach.call(document.querySelectorAll("#freePanel .chip"), function (b) {
      b.onclick = function () { var d = fromKey(b.dataset.k); state.sel = b.dataset.k; state.view = new Date(d.getFullYear(), d.getMonth(), 1); render(); };
    });
  }

  function renderDetail() {
    var k = state.sel, dm = byDate()[k] || {}, past = k < key(today());
    var st = statusOf(dm);
    var pill = past ? ["past", "Dah lepas"] : st === "ok" ? ["ok", "✅ Semua ada, boleh lock shoot"] : st === "warn" ? ["warn", "⚠️ Ada yang tak ada"] : ["bad", "⛔ Orang penting tak ada"];
    var rows = AHLI.map(function (a) {
      var r = dm[a.id];
      return "<li>" + dotHtml(a) + '<span class="who">' + esc(a.nama) + (r && r.note ? '<span class="note">' + esc(r.note) + "</span>" : "") + "</span>" +
        (r ? '<span class="tag no">Tak ada</span>' : '<span class="tag ok">Ada</span>') + "</li>";
    }).join("");

    var act = "";
    var mine = dm[state.me];
    if (state.me && !past) {
      if (mine) {
        act = '<div class="actions">' +
          '<div class="note-row"><input type="text" id="noteIn" maxlength="' + NOTE_MAX + '" placeholder="Nota (pilihan), cth: shoot klien lain" value="' + esc(mine.note || "") + '">' +
          '<button class="btn" id="noteSave" style="width:auto">Simpan</button></div>' +
          '<button class="btn danger" id="toggleBtn">Buang tanda saya (saya available)</button></div>';
      } else {
        act = '<div class="actions"><button class="btn ghost" id="toggleBtn">Saya TAK available hari ni</button></div>';
      }
    }
    $("detail").innerHTML = "<h3>" + esc(labelPanjang(k)) + '</h3><span class="pill ' + pill[0] + '">' + pill[1] + '</span><ul class="people">' + rows + "</ul>" + act;

    var tb = $("toggleBtn"); if (tb) tb.onclick = function () { toggle(k); };
    var ns = $("noteSave"); if (ns) ns.onclick = saveNote;
    var ni = $("noteIn"); if (ni) ni.onkeydown = function (e) { if (e.key === "Enter") saveNote(); };
  }

  // ---------- tindakan ----------
  function toggle(k) {
    if (!state.me) return openWho();
    if (k < key(today())) return toast("Tarikh dah lepas, tak boleh ubah.");
    if (state.busy) return;
    var before = state.marks.slice();
    var had = state.marks.some(function (r) { return r.date === k && r.person === state.me; });
    // Kemas kini terus di skrin, kemudian simpan
    if (had) state.marks = state.marks.filter(function (r) { return !(r.date === k && r.person === state.me); });
    else state.marks = state.marks.concat([{ date: k, person: state.me, slot: "hari", note: "", updated: new Date().toISOString() }]);
    render();
    toast(had ? "Tanda dibuang: anda available " + labelPendek(k) : "Ditanda: anda TAK available " + labelPendek(k));
    state.busy = true;
    store.toggle(k, state.me).then(setMarks).catch(function (e) {
      state.marks = before; render(); toast("Tak berjaya simpan: " + e.message);
    }).then(function () { state.busy = false; });
  }

  function saveNote() {
    var v = ($("noteIn").value || "").trim().slice(0, NOTE_MAX), k = state.sel;
    store.note(k, state.me, v).then(function (m) { setMarks(m); toast("Nota disimpan"); })
      .catch(function (e) { toast("Tak berjaya simpan nota: " + e.message); });
  }

  function onDayTap(k) {
    state.sel = k;
    if (state.mode === "mark") toggle(k); else render();
  }

  // ---------- lembaran bawah ----------
  function openSheet(html, locked) {
    $("sheet").innerHTML = html;
    $("sheetBg").classList.add("open");
    $("sheetBg").dataset.locked = locked ? "1" : "";
  }
  function closeSheet() { $("sheetBg").classList.remove("open"); }

  function openWho(force) {
    var chosen = state.me;
    var pinField = MODE_TEAM ? '<p class="hint">PIN team (boss akan beri):</p><input inputmode="numeric" type="password" id="pinIn" autocomplete="off" maxlength="8" placeholder="PIN" value="' + esc(state.pin) + '">' : "";
    var html = "<h3>Siapa anda?</h3><p class=\"hint\" style=\"margin-top:0\">Anda cuma boleh ubah tanda sendiri. Semua orang nampak tanda semua orang.</p>" +
      '<div class="pick" id="pickList">' + AHLI.map(function (a) {
        return '<button data-id="' + esc(a.id) + '" aria-pressed="' + (a.id === chosen) + '">' + dotHtml(a) + "<span>" + esc(a.nama) + "</span></button>";
      }).join("") + "</div>" + pinField +
      '<div class="actions"><button class="btn" id="whoOk">Teruskan</button>' + (state.me && !force ? '<button class="btn ghost" id="whoCancel">Batal</button>' : "") + "</div>";
    openSheet(html, !state.me || force);
    $("pickList").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      chosen = b.dataset.id;
      Array.prototype.forEach.call(this.children, function (c) { c.setAttribute("aria-pressed", c.dataset.id === chosen); });
    };
    var c = $("whoCancel"); if (c) c.onclick = closeSheet;
    $("whoOk").onclick = function () {
      if (!chosen) return toast("Pilih nama dulu");
      var pin = MODE_TEAM ? ($("pinIn").value || "").trim() : "";
      if (MODE_TEAM && !pin) return toast("Masukkan PIN team");
      var btn = this; btn.disabled = true; btn.textContent = "Menyemak...";
      store.check(pin).then(function (m) {
        state.me = chosen; lsSet("pm_me", chosen);
        if (MODE_TEAM) lsSet("pm_pin", pin);
        closeSheet(); setMarks(m);
        toast("Hai " + ahli(chosen).nama.split(" ")[0] + "!");
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "Teruskan";
        toast(/PIN/i.test(e.message) ? "PIN salah" : "Tak dapat sambung: " + e.message);
      });
    };
  }

  function openFind() {
    var list = freeDays(state.findDays);
    var html = "<h3>Tarikh kosong</h3><p class=\"hint\" style=\"margin-top:0\">Hari di mana semua 4 orang available.</p>" +
      '<div class="seg" id="findSeg"><button data-n="30" aria-pressed="' + (state.findDays === 30) + '">30 hari</button><button data-n="60" aria-pressed="' + (state.findDays === 60) + '">60 hari</button></div>' +
      (list.length
        ? '<p class="hint" style="margin:0 2px 8px">' + list.length + " tarikh dijumpai. Tekan untuk tengok dalam kalendar.</p><ul class=\"free-list\">" +
          list.map(function (k) {
            var d = fromKey(k), wk = d.getDay() === 0 || d.getDay() === 6;
            return '<li><button data-k="' + k + '"><span>' + esc(labelPanjang(k)) + "</span>" + (wk ? "<small>Hujung minggu</small>" : "") + "</button></li>";
          }).join("") + "</ul>"
        : '<p class="hint">Tiada tarikh di mana semua available dalam ' + state.findDays + " hari ni.</p>") +
      '<div class="actions"><button class="btn ghost" id="findClose">Tutup</button></div>';
    openSheet(html);
    $("findSeg").onclick = function (e) { var b = e.target.closest("button"); if (b) { state.findDays = +b.dataset.n; openFind(); } };
    $("findClose").onclick = closeSheet;
    Array.prototype.forEach.call(document.querySelectorAll(".free-list button"), function (b) {
      b.onclick = function () {
        var d = fromKey(b.dataset.k);
        state.sel = b.dataset.k; state.view = new Date(d.getFullYear(), d.getMonth(), 1);
        closeSheet(); render();
        $("detail").scrollIntoView({ behavior: "smooth", block: "center" });
      };
    });
  }

  var toastTimer;
  function toast(msg) {
    var el = $("toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  // ---------- sambung butang ----------
  $("grid").onclick = function (e) { var b = e.target.closest(".day[data-k]"); if (b) onDayTap(b.dataset.k); };
  $("prevBtn").onclick = function () { state.view = new Date(state.view.getFullYear(), state.view.getMonth() - 1, 1); render(); };
  $("nextBtn").onclick = function () { state.view = new Date(state.view.getFullYear(), state.view.getMonth() + 1, 1); render(); };
  $("todayBtn").onclick = function () { var t = today(); state.view = new Date(t.getFullYear(), t.getMonth(), 1); state.sel = key(t); render(); };
  $("modeMark").onclick = function () { state.mode = "mark"; lsSet("pm_mode", "mark"); render(); };
  $("modeView").onclick = function () { state.mode = "view"; lsSet("pm_mode", "view"); render(); };
  $("meBtn").onclick = function () { openWho(); };
  $("findBtn").onclick = openFind;
  $("sheetBg").onclick = function (e) { if (e.target === this && !this.dataset.locked) closeSheet(); };

  // Leret kiri/kanan untuk tukar bulan
  var sx = null;
  $("grid").addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  $("grid").addEventListener("touchend", function (e) {
    if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 60) (dx < 0 ? $("nextBtn") : $("prevBtn")).click();
  });

  // Segarkan data team bila app dibuka semula, dan setiap minit
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(true); });
  if (MODE_TEAM) setInterval(function () { if (!document.hidden) refresh(true); }, 60000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});

  render();
  if (!state.me || (MODE_TEAM && !state.pin)) openWho(true); else refresh();
})();
