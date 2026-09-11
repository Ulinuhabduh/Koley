"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { rupiah, bulanLabel, toCSV, downloadCSV } from "@/lib/format";

function LaporanInner() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  const [bulan, setBulan] = useState("");
  const [jenis, setJenis] = useState<"semua" | "masuk" | "keluar">("semua");
  const [masuk, setMasuk] = useState<any[]>([]);
  const [keluar, setKeluar] = useState<any[]>([]);
  const [rekap, setRekap] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (bulan) p.set("bulan", bulan);
    p.set("limit", "1000");
    const [rm, rk, rr] = await Promise.all([
      fetch(`/api/transaksi?${p.toString()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/pengeluaran?${p.toString()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/rekap", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setMasuk(rm.data || []);
    setKeluar(rk.data || []);
    setRekap(rr);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalMasuk = masuk.reduce((s, t) => s + t.jumlah, 0);
  const totalKeluar = keluar.reduce((s, t) => s + t.jumlah, 0);

  const rows = [
    ...masuk.map((t) => ({ ...t, arah: "masuk" as const })),
    ...keluar.map((t) => ({ ...t, arah: "keluar" as const })),
  ].sort((a, b) => (b.tanggal + (b.createdAt || "")).localeCompare(a.tanggal + (a.createdAt || "")));

  const tampil = jenis === "masuk" ? rows.filter((r) => r.arah === "masuk") : jenis === "keluar" ? rows.filter((r) => r.arah === "keluar") : rows;

  function exportCSV() {
    const header = ["Tanggal", "Periode", "Jenis", "Nama", "Jumlah_Rp", "Keterangan"];
    const body = tampil.map((t: any) => [
      t.tanggal,
      t.bulan,
      t.arah === "masuk" ? "MASUK" : t.jenis === "penarikan" ? "PENARIKAN" : "BELANJA",
      t.nama,
      t.arah === "masuk" ? t.jumlah : -t.jumlah,
      t.keterangan || "",
    ]);
    downloadCSV(
      `laporan-kas${bulan ? "-" + bulan : ""}${q ? "-" + q : ""}.csv`,
      toCSV([header, ...body, [], ["TOTAL MASUK", "", "", "", totalMasuk], ["TOTAL KELUAR", "", "", "", totalKeluar], ["SALDO", "", "", "", totalMasuk - totalKeluar]])
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan Transparan</h1>
          <p className="text-sm text-stone-500">
            Masuk <b className="text-emerald-700">{rupiah(totalMasuk)}</b>
            {" • "}Keluar <b className="text-red-600">{rupiah(totalKeluar)}</b>
            {bulan ? ` • ${bulanLabel(bulan)}` : ""}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={exportCSV} className="btn-secondary text-sm">⬇ CSV</button>
          <button onClick={() => window.print()} className="btn-primary text-sm">🖨 Cetak</button>
        </div>
      </div>

      {/* Saldo */}
      {rekap && (
        <div className="card p-4 !bg-emerald-700 !border-emerald-700 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-200">Saldo kas saat ini</p>
            <p className="text-2xl font-bold text-white">{rupiah(rekap.saldo ?? 0)}</p>
          </div>
          <div className="text-right text-xs text-emerald-100">
            {rekap.saldoAwal > 0 && <p>Saldo awal {rupiah(rekap.saldoAwal)}</p>}
            <p>Masuk {rupiah(rekap.totalDana ?? 0)}</p>
            <p>Keluar {rupiah(rekap.totalKeluar ?? 0)}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card p-4 space-y-3 no-print">
        <div className="grid grid-cols-3 gap-1.5 bg-stone-100 rounded-xl p-1">
          {(["semua", "masuk", "keluar"] as const).map((j) => (
            <button
              key={j}
              onClick={() => setJenis(j)}
              className={`py-2 rounded-lg text-[13px] font-semibold transition ${jenis === j ? "bg-white shadow text-stone-900" : "text-stone-500"}`}
            >
              {j === "semua" ? "Semua" : j === "masuk" ? "Masuk" : "Keluar"}
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="🔍 Cari nama / keterangan..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <div className="space-y-2">
          <input type="month" className="input w-full" value={bulan} onChange={(e) => setBulan(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={load} className="btn-primary text-sm flex-1">Tampilkan</button>
            <button
              onClick={() => {
                setQ("");
                setBulan("");
                setJenis("semua");
                setTimeout(load, 50);
              }}
              className="btn-secondary text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Rekap 12 bulan */}
      {rekap && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-1">Rekap 12 Bulan</h2>
          <p className="text-[11px] text-stone-400 mb-3">Untuk ditempel di papan info desa</p>
          {/* Mobile: kartu per bulan */}
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {(rekap.perBulan || []).slice().reverse().map((b: any) => (
              <div key={b.bulan} className="rounded-xl border border-stone-200 p-2.5">
                <p className="text-xs font-bold text-stone-600">{bulanLabel(b.bulan)}</p>
                <p className="text-[13px] font-bold text-emerald-700 mt-1">+{b.total > 0 ? rupiah(b.total) : "–"}</p>
                {b.keluar > 0 && <p className="text-[13px] font-bold text-red-500">−{rupiah(b.keluar)}</p>}
                <p className="text-[10px] text-stone-400 mt-0.5">saldo {rupiah(b.total - b.keluar)}</p>
              </div>
            ))}
          </div>
          {/* Desktop: tabel */}
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Arus</th>
                  {(rekap.perBulan || []).map((b: any) => (
                    <th key={b.bulan} className="table-th text-center whitespace-nowrap">{bulanLabel(b.bulan)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="table-td font-semibold text-emerald-700">Masuk</td>
                  {(rekap.perBulan || []).map((b: any) => (
                    <td key={b.bulan} className="table-td text-center whitespace-nowrap">
                      {b.total > 0 ? rupiah(b.total) : <span className="text-stone-300">-</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="table-td font-semibold text-red-600">Keluar</td>
                  {(rekap.perBulan || []).map((b: any) => (
                    <td key={b.bulan} className="table-td text-center whitespace-nowrap">
                      {b.keluar > 0 ? rupiah(b.keluar) : <span className="text-stone-300">-</span>}
                    </td>
                  ))}
                </tr>
                <tr className="bg-stone-50 font-bold">
                  <td className="table-td">Saldo</td>
                  {(rekap.perBulan || []).map((b: any) => (
                    <td key={b.bulan} className="table-td text-center whitespace-nowrap">{rupiah(b.total - b.keluar)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daftar transaksi */}
      <div className="card px-2 py-1 sm:p-2">
        {loading ? (
          <p className="p-4 text-sm text-stone-500">Memuat...</p>
        ) : tampil.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Tidak ada catatan sesuai filter.</p>
        ) : (
          <>
            {/* Mobile: kartu */}
            <ul className="divide-y divide-stone-100 sm:hidden">
              {tampil.map((t: any) => (
                <li key={t.arah + t.id} className="px-3 py-2.5 flex items-center gap-2.5">
                  <span className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-sm font-bold ${t.arah === "masuk" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                    {t.arah === "masuk" ? "+" : "−"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{t.nama}</p>
                    <p className="text-[11px] text-stone-500">
                      {t.tanggal} • {t.arah === "masuk" ? bulanLabel(t.bulan) : t.jenis === "penarikan" ? "Penarikan" : "Belanja"}
                      {t.keterangan ? ` • ${t.keterangan}` : ""}
                    </p>
                  </div>
                  <p className={`font-bold text-[13px] whitespace-nowrap ${t.arah === "masuk" ? "text-emerald-700" : "text-red-600"}`}>
                    {t.arah === "masuk" ? "+" : "−"}{rupiah(t.jumlah)}
                  </p>
                </li>
              ))}
            </ul>
            {/* Desktop: tabel */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Tanggal</th>
                    <th className="table-th">Jenis</th>
                    <th className="table-th">Nama / Keperluan</th>
                    <th className="table-th">Keterangan</th>
                    <th className="table-th text-right">Masuk</th>
                    <th className="table-th text-right">Keluar</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((t: any) => (
                    <tr key={t.arah + t.id}>
                      <td className="table-td whitespace-nowrap">{t.tanggal}</td>
                      <td className="table-td">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${t.arah === "masuk" ? "bg-emerald-100 text-emerald-800" : t.jenis === "penarikan" ? "bg-amber-100 text-amber-800" : "bg-stone-200 text-stone-600"}`}>
                          {t.arah === "masuk" ? "MASUK" : t.jenis === "penarikan" ? "PENARIKAN" : "BELANJA"}
                        </span>
                      </td>
                      <td className="table-td font-medium">{t.nama}</td>
                      <td className="table-td text-stone-500">{t.keterangan || "-"}</td>
                      <td className="table-td text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {t.arah === "masuk" ? rupiah(t.jumlah) : <span className="text-stone-300">-</span>}
                      </td>
                      <td className="table-td text-right font-semibold text-red-600 whitespace-nowrap">
                        {t.arah === "keluar" ? rupiah(t.jumlah) : <span className="text-stone-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-3 border-t border-stone-200 text-sm space-y-1 bg-stone-50 rounded-b-2xl">
              <div className="flex justify-between"><span className="text-stone-500">Total masuk</span><b className="text-emerald-700">+{rupiah(totalMasuk)}</b></div>
              <div className="flex justify-between"><span className="text-stone-500">Total keluar</span><b className="text-red-600">−{rupiah(totalKeluar)}</b></div>
              <div className="flex justify-between text-base"><span className="font-semibold">Selisih</span><b>{rupiah(totalMasuk - totalKeluar)}</b></div>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-stone-400">
        Tips: cetak/Screenshot halaman ini tiap awal bulan lalu bagikan ke grup WhatsApp warga.
      </p>
    </div>
  );
}

export default function LaporanPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">Memuat laporan...</p>}>
      <LaporanInner />
    </Suspense>
  );
}
