// Tetapan app. Fail ini AWAM (repo GitHub Pages), jadi JANGAN letak kata laluan atau PIN di sini.
//
// Storan team (Supabase). Kunci "anon / publishable" MEMANG awam dan selamat diletak di sini:
// ia tak boleh baca/tulis data tanpa PIN team (PIN disimpan dalam Supabase, bukan dalam kod).
//   - Kosong ""  = mod cuba: data disimpan dalam telefon/komputer ini sahaja (orang lain tak nampak).
//   - Diisi     = mod team: semua orang kongsi data yang sama.
// JANGAN letak kunci "service_role" / "secret" di sini.
window.APP_CONFIG = {
  SUPABASE_URL: "https://rfxqslkmzammmitgrbdt.supabase.co",
  SUPABASE_KEY: "sb_publishable_iaOE2on1je3m66_G8vqS2A_3hgApJ-F", // kunci publishable (awam)

  // Hari tetap setiap minggu di mana semua orang dikunci (dow: 0=Ahad, 1=Isnin ... 4=Khamis).
  TEAM_DAYS: [{ dow: 4, label: "Team meeting" }],

  // Ahli team. Warna mesti konsisten. `wajib: true` = hari jadi MERAH bila orang ini tak available.
  AHLI: [
    { id: "Firdaus", nama: "Firdaus", inisial: "F", warna: "#2DBBF9", wajib: true },
    { id: "Amin", nama: "Amin", inisial: "A", warna: "#F97316", wajib: true },
    { id: "Hana", nama: "Hana", inisial: "H", warna: "#A855F7", wajib: false },
    { id: "Amalina", nama: "Amalina (Emma)", inisial: "E", warna: "#EC4899", wajib: false }
  ]
};
