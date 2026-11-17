# Kalendar Team PM

Antara muka app dalam English, rupa gelap futuristik (neon biru PM).

App ringkas untuk team Produksi Mayasari: setiap orang tekan tarikh yang mereka **TAK available**, dan semua orang nampak hari mana boleh lock shoot.

- 🟢 Hijau: semua 4 orang ada, boleh lock shoot
- 🟡 Kuning: ada yang tak ada (bulatan inisial tunjuk siapa)
- 🔴 Merah: Firdaus atau Amin tak ada
- Panel "Everyone available": hari kosong 30 hari depan, sentiasa nampak
- Butang "Find free dates": senarai 30 atau 60 hari

App ini **tidak** bersambung dengan Google Calendar. Jemputan shoot tetap dihantar macam biasa.

## Cara guna (iPhone)

1. Buka pautan app dalam Safari.
2. Pilih nama anda (dan PIN team bila mod team dah dihidupkan).
3. Mod **✋ Mark me**: tekan tarikh anda tak available. Tekan sekali lagi untuk buang.
4. Mod **👁 View only**: tekan tarikh untuk tengok siapa ada, tanpa ubah apa-apa.
5. Butang Kongsi (petak dengan anak panah) > **Add to Home Screen** supaya jadi macam app.

## Fail

| Fail | Guna |
| --- | --- |
| `index.html`, `app.js` | App |
| `config.js` | Tetapan: senarai ahli, warna, siapa "wajib", sambungan Supabase (`SUPABASE_URL`, `SUPABASE_KEY`) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Supaya boleh Add to Home Screen (PWA) |
| `supabase/setup.sql` | Skrip sekali jalan untuk sediakan storan data team di Supabase |

## Storan data (Supabase)

- `SUPABASE_URL`/`SUPABASE_KEY` kosong = **mod cuba**: tanda disimpan dalam peranti itu sahaja.
- Diisi = **mod team**: semua orang kongsi data yang sama.
- Kunci anon/publishable dalam `config.js` memang awam. Ia hanya boleh panggil 3 fungsi (`avail_list`, `avail_toggle`, `avail_note`) yang semak PIN team dulu; jadual tak boleh dibaca terus.
- PIN team disimpan dalam Supabase (skema `private`), bukan dalam repo.
- Semua jadual/fungsi app ini berawalan `avail_` supaya projek Supabase yang sama boleh dikongsi dengan app lain.

### Setup (sekali sahaja)

1. Supabase > **SQL Editor** > New query. Tampal isi `supabase/setup.sql`, tekan **Run**.
2. Query baharu untuk tetapkan PIN team (tukar `1234`):
   ```sql
   insert into private.avail_settings (key, value) values ('team_pin', '1234')
   on conflict (key) do update set value = excluded.value;
   ```
   Jalankan semula baris ini bila-bila untuk tukar PIN.
3. Masukkan Project URL dan kunci publishable/anon ke `config.js`.
