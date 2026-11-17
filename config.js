// Tetapan app. Fail ini AWAM (repo GitHub Pages), jadi JANGAN letak kata laluan atau PIN di sini.
//
// API_URL: pautan "Web app" Google Apps Script (berakhir dengan /exec).
//   - Kosong ""  = mod cuba: data disimpan dalam telefon/komputer ini sahaja (orang lain tak nampak).
//   - Diisi     = mod team: semua orang kongsi data yang sama dalam Google Sheet.
window.APP_CONFIG = {
  API_URL: "",

  // Ahli team. Warna mesti konsisten. `wajib: true` = hari jadi MERAH bila orang ini tak available.
  AHLI: [
    { id: "Firdaus", nama: "Firdaus", inisial: "F", warna: "#2DBBF9", wajib: true },
    { id: "Amin", nama: "Amin", inisial: "A", warna: "#F97316", wajib: true },
    { id: "Hana", nama: "Hana", inisial: "H", warna: "#A855F7", wajib: false },
    { id: "Amalina", nama: "Amalina (Emma)", inisial: "E", warna: "#EC4899", wajib: false }
  ]
};
