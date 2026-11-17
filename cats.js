/* Neon cats: two cats walk and climb over the calendar dates, fight when they meet face to face,
   and show a reminder or a wish when tapped. Pure decoration; never changes any data. */
(function () {
  "use strict";

  var cal = document.querySelector(".cal");
  var grid = document.getElementById("grid");
  if (!cal || !grid) return;

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 40, H = 28, FEET = 26; // cat box and where its feet are inside it

  var SVG =
    '<svg viewBox="0 0 40 28" width="40" height="28" aria-hidden="true">' +
    '<path class="tail" d="M10 14 C3 12 3 5 7 2"/>' +
    '<rect x="8" y="10" width="21" height="10" rx="5"/>' +
    '<circle cx="31" cy="9" r="6"/>' +
    '<path d="M26 5 L27 0 L30 4 M32 4 L35 0 L36 5"/>' +
    '<circle class="eye" cx="30" cy="8.5" r="0.9"/><circle class="eye" cx="33.2" cy="8.5" r="0.9"/>' +
    '<path d="M37 10.5 h3 M37 12 l2.6 1"/>' +
    '<g class="legs a"><path d="M12 20 L11 26 M25 20 L26 26"/></g>' +
    '<g class="legs b"><path d="M14 20 L15 26 M23 20 L22 26"/></g>' +
    "</svg>";

  var layer = document.createElement("div");
  layer.className = "cat-layer";
  cal.appendChild(layer);

  // ---------- platforms: the top edge of each row of date cells, plus the floor under the grid ----------
  var plats = [], platsAt = 0;
  function platforms() {
    var now = Date.now();
    if (now - platsAt < 400 && plats.length) return plats;
    platsAt = now;
    var c = cal.getBoundingClientRect(), rows = {};
    Array.prototype.forEach.call(grid.querySelectorAll(".day[data-k]"), function (el) {
      var r = el.getBoundingClientRect(), y = Math.round(r.top - c.top);
      var row = rows[y] || (rows[y] = { y: y, x0: Infinity, x1: -Infinity });
      row.x0 = Math.min(row.x0, r.left - c.left); row.x1 = Math.max(row.x1, r.right - c.left);
    });
    var g = grid.getBoundingClientRect();
    plats = Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (a, b) { return a.y - b.y; });
    plats.push({ y: Math.round(g.bottom - c.top) + 4, x0: g.left - c.left, x1: g.right - c.left, floor: true });
    return plats;
  }

  // ---------- cats ----------
  function makeCat(name, color, startRow, startX, dir) {
    var el = document.createElement("button");
    el.className = "cat";
    el.type = "button";
    el.setAttribute("aria-label", name + " the neon cat. Tap for a message.");
    el.style.color = color;
    el.innerHTML = SVG;
    layer.appendChild(el);
    var cat = { name: name, el: el, row: startRow, x: startX, dir: dir, speed: 0.35 + Math.random() * 0.15,
      mode: "walk", until: 0, jump: null, step: 0, cool: 0 };
    el.addEventListener("click", function (e) { e.stopPropagation(); tapCat(cat); });
    return cat;
  }

  var cats = [];
  function init() {
    var p = platforms();
    if (!p.length) return;
    var floor = p.length - 1;
    cats = [
      makeCat("Neko", "#2DBBF9", floor, p[floor].x0 + 10, 1),
      makeCat("Momo", "#ff4fd8", Math.max(0, floor - 2), p[Math.max(0, floor - 2)].x1 - W - 10, -1)
    ];
  }

  function place(cat, x, yFeet) {
    cat.el.style.transform = "translate(" + Math.round(x) + "px," + Math.round(yFeet - FEET) + "px)" + (cat.dir < 0 ? " scaleX(-1)" : "");
  }

  function startJump(cat, now) {
    // Usually head toward the other cat's row, so they meet (and fight) now and then
    var other = cats[0] === cat ? cats[1] : cats[0], step = Math.random() < 0.5 ? -1 : 1;
    if (other && other.row !== cat.row && Math.random() < 0.7) step = other.row > cat.row ? 1 : -1;
    var p = platforms(), to = cat.row + step;
    if (to < 0) to = cat.row + 1;
    if (to >= p.length) to = cat.row - 1;
    if (to < 0 || to >= p.length || to === cat.row) return;
    var tp = p[to];
    var tx = Math.min(Math.max(cat.x + cat.dir * 30, tp.x0 + 2), tp.x1 - W - 2);
    cat.jump = { from: cat.row, to: to, x0: cat.x, x1: tx, t0: now, dur: 650 };
    cat.mode = "jump";
    cat.el.classList.add("jumping");
  }

  // ---------- tap: bubble with a reminder or a wish ----------
  var bubble = document.createElement("div");
  bubble.className = "cat-bubble";
  bubble.setAttribute("role", "status");
  layer.appendChild(bubble);
  var bubbleTimer = null, bubbleCat = null, lastLine = "";

  function tapCat(cat) {
    var lines = (window.PMApp && window.PMApp.catLines) ? window.PMApp.catLines() : ["Meow! 🐾"];
    var pick;
    do { pick = lines[Math.floor(Math.random() * lines.length)]; } while (lines.length > 1 && pick === lastLine);
    lastLine = pick;
    bubble.textContent = pick;
    bubble.classList.add("show");
    bubbleCat = cat;
    if (!REDUCED) { cat.mode = "sit"; cat.until = performance.now() + 3500; }
    cat.el.classList.add("happy");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); bubbleCat = null; cat.el.classList.remove("happy"); }, 3600);
  }
  function placeBubble() {
    if (!bubbleCat) return;
    var p = platforms()[bubbleCat.row]; if (!p) return;
    var bw = bubble.offsetWidth, cw = cal.clientWidth;
    var x = Math.min(Math.max(bubbleCat.x + W / 2 - bw / 2, 6), cw - bw - 6);
    var y = p.y - FEET - bubble.offsetHeight - 8;
    if (y < 4) y = p.y + 8; // no room above: show below
    bubble.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  // ---------- fight when face to face on the same row ----------
  var cloud = document.createElement("div");
  cloud.className = "cat-fight";
  cloud.innerHTML = "<span>💥</span><i>✦</i><i>✧</i><i>✦</i>";
  layer.appendChild(cloud);

  function checkFight(now) {
    if (cats.length < 2) return;
    var a = cats[0], b = cats[1];
    if (a.mode !== "walk" || b.mode !== "walk" || a.row !== b.row || now < a.cool || now < b.cool) return;
    var left = a.x < b.x ? a : b, right = left === a ? b : a;
    if (right.x - left.x > W - 4) return;
    if (left.dir !== 1 || right.dir !== -1) return; // must face each other
    [a, b].forEach(function (c) { c.mode = "fight"; c.until = now + 1700; c.el.classList.add("angry"); });
    var p = platforms()[a.row];
    cloud.style.transform = "translate(" + Math.round((left.x + right.x) / 2 + W / 2 - 22) + "px," + Math.round(p.y - FEET - 10) + "px)";
    cloud.classList.add("show");
    setTimeout(function () { cloud.classList.remove("show"); }, 1700);
  }

  // ---------- loop ----------
  var last = 0;
  function tick(now) {
    var dt = Math.min(50, now - (last || now)); last = now;
    var p = platforms();
    cats.forEach(function (cat) {
      if (cat.row >= p.length) cat.row = p.length - 1;
      var pl = p[cat.row];
      if (cat.mode === "jump") {
        var j = cat.jump, t = Math.min(1, (now - j.t0) / j.dur), a = p[j.from], b = p[j.to];
        if (!a || !b) { cat.mode = "walk"; return; }
        var x = j.x0 + (j.x1 - j.x0) * t;
        var y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * 34;
        cat.x = x; place(cat, x, y);
        if (t >= 1) { cat.row = j.to; cat.mode = "walk"; cat.jump = null; cat.el.classList.remove("jumping"); }
        return;
      }
      if (cat.mode === "sit" || cat.mode === "fight" || cat.mode === "rest") {
        cat.el.classList.remove("walking");
        if (now > cat.until) {
          if (cat.mode === "fight") { cat.dir *= -1; cat.cool = now + 6000; cat.el.classList.remove("angry"); }
          cat.mode = "walk";
        }
        place(cat, cat.x, pl.y);
        return;
      }
      // walk
      cat.el.classList.add("walking");
      cat.x += cat.dir * cat.speed * dt / 16;
      if (cat.x < pl.x0) { cat.x = pl.x0; cat.dir = 1; }
      if (cat.x > pl.x1 - W) { cat.x = pl.x1 - W; cat.dir = -1; }
      var o = cats[0] === cat ? cats[1] : cats[0];
      if (o && o.row === cat.row && now > cat.cool && Math.random() < 0.01) cat.dir = o.x > cat.x ? 1 : -1;
      var r = Math.random();
      if (r < 0.004) startJump(cat, now);
      else if (r < 0.0035) { cat.mode = "rest"; cat.until = now + 1200 + Math.random() * 1800; }
      if (cat.mode === "walk") place(cat, cat.x, pl.y);
    });
    checkFight(now);
    placeBubble();
    requestAnimationFrame(tick);
  }

  function start() {
    init();
    if (!cats.length) return;
    if (REDUCED) cats.forEach(function (c) { c.mode = "rest"; c.until = Infinity; });
    requestAnimationFrame(tick);
  }
  // Wait until the calendar has drawn its cells
  if (grid.querySelector(".day[data-k]")) start(); else setTimeout(start, 300);
})();
