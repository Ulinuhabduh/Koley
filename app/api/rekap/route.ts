import { NextResponse } from "next/server";
import { readDB, saldoTempat } from "@/lib/db";
import { currentBulan, bulanKeyTahunBulan } from "@/lib/format";

// GET /api/rekap -> ringkasan dashboard + laporan transparan
export async function GET() {
  const db = readDB();
  const saldoAwal = db.tempats.reduce((s, t) => s + (t.saldoAwal || 0), 0);
  const totalDana = db.transaksis.reduce((s, t) => s + t.jumlah, 0);
  const totalKeluar = db.pengeluarans.reduce((s, t) => s + t.jumlah, 0);
  const saldo = saldoAwal + totalDana - totalKeluar;
  const totalWarga = db.wargas.length;
  const totalTransaksi = db.transaksis.length;

  // rincian per tempat penyimpanan
  const perTempat = db.tempats.map((t) => ({
    id: t.id,
    nama: t.nama,
    keterangan: t.keterangan,
    ...saldoTempat(db, t.id),
  }));

  const bulanIni = currentBulan();
  const trxBulanIni = db.transaksis.filter((t) => t.bulan === bulanIni);
  const totalBulanIni = trxBulanIni.reduce((s, t) => s + t.jumlah, 0);
  const keluarBulanIni = db.pengeluarans
    .filter((t) => t.bulan === bulanIni)
    .reduce((s, t) => s + t.jumlah, 0);

  // rekap 12 bulan terakhir (pakai waktu lokal agar tak geser di WIB)
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(bulanKeyTahunBulan(dt.getFullYear(), dt.getMonth()));
  }
  const perBulan = months.map((m) => ({
    bulan: m,
    total: db.transaksis.filter((t) => t.bulan === m).reduce((s, t) => s + t.jumlah, 0),
    count: db.transaksis.filter((t) => t.bulan === m).length,
    keluar: db.pengeluarans.filter((t) => t.bulan === m).reduce((s, t) => s + t.jumlah, 0),
    countKeluar: db.pengeluarans.filter((t) => t.bulan === m).length,
  }));

  // rekap per warga (urut total terbesar)
  const agg = new Map<string, { nama: string; total: number; count: number; terakhir: string }>();
  for (const t of db.transaksis) {
    const cur = agg.get(t.wargaId) || { nama: t.nama, total: 0, count: 0, terakhir: t.tanggal };
    cur.total += t.jumlah;
    cur.count += 1;
    if (t.tanggal > cur.terakhir) cur.terakhir = t.tanggal;
    cur.nama = t.nama;
    agg.set(t.wargaId, cur);
  }
  // warga yang belum pernah bayar tetap muncul
  for (const w of db.wargas) {
    if (!agg.has(w.id)) agg.set(w.id, { nama: w.nama, total: 0, count: 0, terakhir: "-" });
  }
  const perWarga = [...agg.entries()]
    .map(([wargaId, v]) => ({ wargaId, ...v }))
    .sort((a, b) => b.total - a.total);

  // status bayar bulan ini
  const sudahBayarIds = new Set(trxBulanIni.map((t) => t.wargaId));
  const statusBulanIni = {
    bulan: bulanIni,
    sudah: sudahBayarIds.size,
    belum: Math.max(0, totalWarga - sudahBayarIds.size),
  };

  const recent = [...db.transaksis]
    .sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt))
    .slice(0, 10);

  const recentKeluar = [...db.pengeluarans]
    .sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt))
    .slice(0, 5);

  const recentTransfer = [...db.transfers]
    .sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt))
    .slice(0, 5);

  return NextResponse.json({
    saldoAwal,
    totalDana,
    totalKeluar,
    saldo,
    totalWarga,
    totalTransaksi,
    totalBulanIni,
    keluarBulanIni,
    bulanIni,
    statusBulanIni,
    perBulan,
    perWarga,
    perTempat,
    recent,
    recentKeluar,
    recentTransfer,
  });
}
