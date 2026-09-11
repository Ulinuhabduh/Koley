# Koley — Iuran Rutin Desa

Web pencatatan dana kolektif / iuran rutin warga. Peran: **admin saja**.

## Cara jalan
```bash
npm install
npm run dev
# buka http://localhost:3000
```

## Fitur sesuai permintaan
- **Input nama manual + autocomplete**: ketik nama → kalau belum ada, otomatis disimpan sebagai warga baru saat Simpan. Kalau sudah ada, tinggal pencet dari daftar.
- **Transaksi kas masuk**: nama, jumlah, tanggal bayar, periode bulan, keterangan. Tanpa upload bukti/foto.
- **Data warga**: tambah manual, cari, status Sudah/Belum bayar per periode, total setoran.
- **Laporan transparan**: dashboard total dana + grafik 12 bulan, rekap per bulan & per warga, filter nama/bulan, Export CSV (bisa dibuka di Excel), Cetak/PDF.
- **Database**: file lokal `data/koley.json` (otomatis dibuat). Backup cukup copy file itu.

## Struktur
- `app/` → halaman Dashboard, Input, Warga, Laporan
- `app/api/` → API warga, transaksi, rekap
- `lib/db.ts` → penyimpanan file JSON
- `data/koley.json` → database (jangan dihapus)
