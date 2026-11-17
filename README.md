# Kalendar Team PM

App ringkas untuk team Produksi Mayasari: setiap orang tekan tarikh yang mereka **TAK available**, dan semua orang nampak hari mana boleh lock shoot.

- 🟢 Hijau: semua 4 orang ada, boleh lock shoot
- 🟡 Kuning: ada yang tak ada (bulatan inisial tunjuk siapa)
- 🔴 Merah: Firdaus atau Amin tak ada
- Panel "Semua masih available": hari kosong 30 hari depan, sentiasa nampak
- Butang "Cari tarikh kosong": senarai 30 atau 60 hari

App ini **tidak** bersambung dengan Google Calendar. Jemputan shoot tetap dihantar macam biasa.

## Cara guna (iPhone)

1. Buka pautan app dalam Safari.
2. Pilih nama anda (dan PIN team bila mod team dah dihidupkan).
3. Mod **✋ Tanda saya**: tekan tarikh anda tak available. Tekan sekali lagi untuk buang.
4. Mod **👀 Lihat sahaja**: tekan tarikh untuk tengok siapa ada, tanpa ubah apa-apa.
5. Butang Kongsi (petak dengan anak panah) > **Add to Home Screen** supaya jadi macam app.

## Fail

| Fail | Guna |
| --- | --- |
| `index.html`, `app.js` | App |
| `config.js` | Tetapan: senarai ahli, warna, siapa "wajib", pautan storan (`API_URL`) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Supaya boleh Add to Home Screen (PWA) |
| `apps-script/Code.gs` | Kod storan data team (Google Apps Script) |

## Storan data

- `API_URL` kosong = **mod cuba**: tanda disimpan dalam peranti itu sahaja.
- `API_URL` diisi = **mod team**: semua orang kongsi data yang sama. Data disimpan dalam satu Google Sheet di belakang tabir; team cuma guna app.
- Tiada PIN atau kata laluan dalam repo ini. PIN team disimpan dalam Script Properties Apps Script.

### Hidupkan mod team (sekali sahaja, ~5 minit, akaun Google boss)

1. Buka https://sheets.new, namakan Sheet "Kalendar Team PM (data)".
2. Menu **Extensions > Apps Script**. Padam kod contoh, tampal isi `apps-script/Code.gs`, tekan Save.
3. Ikon gear **Project Settings** > **Script Properties** > Add property: nama `TEAM_PIN`, nilai PIN 4-6 digit pilihan boss. Save.
4. **Deploy > New deployment** > jenis **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, benarkan akses.
5. Salin pautan Web app (berakhir `/exec`) dan beri kepada Claude untuk dimasukkan ke `config.js`.
