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
- **Multi tempat saldo**: kas bisa dipecah ke beberapa dompet (Kas Tunai, Bank BRI, DANA, dll). Ada transfer/pindah saldo antar tempat, saldo tiap tempat dijaga agar tidak minus.
- **Database**: satu file JSON lokal `data/koley.json` (otomatis dibuat). Backup cukup copy file itu.

## Deploy / menjalankan di server sendiri
Aplikasi ini menyimpan data di file lokal, jadi jalankan di PC/laptop/VPS yang punya disk
(bukan platform serverless seperti Vercel — filesystem-nya read-only):
```bash
npm install
npm run build
npm start   # jalankan di port 3000, agar bisa diakses jaringan: npx next start -H 0.0.0.0
```
Semua data tersimpan di `data/koley.json`; restore & backup otomatis juga menulis ke folder `data/` di server.

## Struktur
- `app/` → halaman Dashboard, Input, Warga, Laporan
- `app/api/` → API warga, transaksi, rekap, tempat saldo, transfer
- `lib/db.ts` → penyimpanan file JSON
- `data/koley.json` → database (jangan dihapus)
