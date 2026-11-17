/**
 * Kalendar Team PM: storan data (Google Apps Script + Google Sheet).
 * Team tak perlu buka Sheet ni; semua orang guna app sahaja. Sheet cuma "laci" simpanan.
 *
 * PIN team TIDAK ditulis dalam kod. Ia disimpan dalam Project Settings > Script Properties
 * dengan nama TEAM_PIN (lihat SETUP.md).
 */

var SHEET_NAME = "tanda";
var HEADERS = ["tarikh", "orang", "slot", "nota", "dikemaskini"];
var AHLI = ["Firdaus", "Amin", "Hana", "Amalina"];
var NOTE_MAX = 60;

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var pin = PropertiesService.getScriptProperties().getProperty("TEAM_PIN");
    if (!pin) return out({ ok: false, error: "TEAM_PIN belum ditetapkan" });
    if (String(body.pin || "") !== String(pin)) return out({ ok: false, error: "PIN salah" });

    var action = body.action;
    if (action === "list") return out({ ok: true, marks: readAll() });

    var date = String(body.date || "");
    var person = String(body.person || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return out({ ok: false, error: "Tarikh tak sah" });
    if (AHLI.indexOf(person) < 0) return out({ ok: false, error: "Nama tak sah" });

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (action === "toggle") toggle(date, person);
      else if (action === "note") setNote(date, person, String(body.note || "").slice(0, NOTE_MAX));
      else return out({ ok: false, error: "Tindakan tak dikenali" });
    } finally {
      lock.releaseLock();
    }
    return out({ ok: true, marks: readAll() });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return out({ ok: true, info: "Kalendar Team PM API. Guna app untuk lihat data." });
}

function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange("A:A").setNumberFormat("@"); // simpan tarikh sebagai teks YYYY-MM-DD
  }
  return sh;
}

function readAll() {
  var sh = sheet();
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEADERS.length).getDisplayValues()
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return { date: r[0], person: r[1], slot: r[2] || "hari", note: r[3], updated: r[4] }; });
}

function findRow(sh, date, person) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  var v = sh.getRange(2, 1, n, 2).getDisplayValues();
  for (var i = 0; i < v.length; i++) if (v[i][0] === date && v[i][1] === person) return i + 2;
  return -1;
}

function toggle(date, person) {
  var sh = sheet(), row = findRow(sh, date, person);
  if (row > 0) sh.deleteRow(row);
  else sh.appendRow([date, person, "hari", "", new Date().toISOString()]);
}

function setNote(date, person, note) {
  var sh = sheet(), row = findRow(sh, date, person);
  if (row < 0) return;
  sh.getRange(row, 4, 1, 2).setValues([[note, new Date().toISOString()]]);
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
