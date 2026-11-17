/**
 * PM Team Calendar: Google Calendar lock feed (READ ONLY).
 *
 * Runs as boss's own Google Apps Script web app. It only READS boss's main
 * Google Calendar and returns events coloured TANGERINE (PM events) so the app
 * can lock those dates. It never creates, changes or deletes any event.
 *
 * Security: the caller must send the team PIN. The PIN is checked against
 * Supabase (same check the app uses), so no PIN or secret is stored here.
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me    Who has access: Anyone
 * Then put the /exec URL into config.js (CALENDAR_URL).
 */

var SUPABASE_URL = "https://rfxqslkmzammmitgrbdt.supabase.co";
var SUPABASE_KEY = "sb_publishable_iaOE2on1je3m66_G8vqS2A_3hgApJ-F"; // public publishable key
var TZ = "Asia/Kuala_Lumpur";
var DAYS_BACK = 7, DAYS_AHEAD = 180;
var PM_COLOR = "6"; // Tangerine

function doGet() {
  return json_({ ok: true, info: "PM calendar lock feed. POST {pin} to read." });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var pin = String(body.pin || "");
    if (!pin || !pinOk_(pin)) return json_({ ok: false, error: "Wrong PIN" });
    return json_({ ok: true, locks: locks_() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function pinOk_(pin) {
  var cache = CacheService.getScriptCache();
  var h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "pm:" + pin));
  if (cache.get("pin:" + h) === "1") return true;
  var r = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/rpc/avail_list", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { apikey: SUPABASE_KEY }, payload: JSON.stringify({ p_pin: pin })
  });
  var ok = r.getResponseCode() === 200;
  if (ok) cache.put("pin:" + h, "1", 600);
  return ok;
}

function locks_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get("locks");
  if (hit) return JSON.parse(hit);
  var now = new Date();
  var from = new Date(now.getTime() - DAYS_BACK * 864e5), to = new Date(now.getTime() + DAYS_AHEAD * 864e5);
  var out = [];
  CalendarApp.getDefaultCalendar().getEvents(from, to).forEach(function (ev) {
    if (String(ev.getColor()) !== PM_COLOR) return;
    var title = ev.getTitle() || "PM";
    if (ev.isAllDayEvent()) {
      // all-day end date is exclusive; expand multi-day events into each date
      for (var d = new Date(ev.getAllDayStartDate()); d < ev.getAllDayEndDate(); d.setDate(d.getDate() + 1)) {
        out.push({ date: Utilities.formatDate(d, TZ, "yyyy-MM-dd"), title: title, time: null });
      }
    } else {
      var s = ev.getStartTime(), en = ev.getEndTime();
      out.push({ date: Utilities.formatDate(s, TZ, "yyyy-MM-dd"), title: title,
        time: Utilities.formatDate(s, TZ, "HH:mm") + "–" + Utilities.formatDate(en, TZ, "HH:mm") });
    }
  });
  out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.time).localeCompare(String(b.time)); });
  cache.put("locks", JSON.stringify(out), 300);
  return out;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
