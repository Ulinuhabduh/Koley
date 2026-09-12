"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rupiah, bulanLabel } from "@/lib/format";
import { getRekap, seedFromServerIfEmpty } from "@/lib/localdb";

type TempatSaldo = {
  id: string;
  nama: string;
  keterangan: string;
  saldoAwal: number;
  masuk: number;
  keluar: number;
  transferMasuk: number;
  transferKeluar: number;
  saldo: number;
};

type Rekap = {
  saldoAwal: number;
  totalDana: number;
  totalKeluar: number;
  saldo: number;
  totalWarga: number;
  totalTransaksi: number;
  totalBulanIni: number;
  keluarBulanIni: number;
  bulanIni: string;
  statusBulanIni: { bulan: string; sudah: number; belum: number };
  perBulan: { bulan: string; total: number; count: number; keluar: number; countKeluar: number }[];
  perWarga: { wargaId: string; nama: string; total: number; count: number; terakhir: string }[];
  perTempat?: TempatSaldo[];
  recent: { id: string; nama: string; jumlah: number; tanggal: string; bulan: string; keterangan: string; tempatNama?: string }[];
  recentKeluar: { id: string; jenis: string; nama: string; jumlah: number; tanggal: string; bulan: string; keterangan: string; tempatNama?: string }[];
};

export default function Dashboard() {
  const [data, setData] = useState<Rekap | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    try {
      setData(getRekap() as Rekap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Sekali saja: salin data server lama (localhost) ke browser bila browser masih kosong.
    // Di Vercel ini no-op sehingga aman.
    seedFromServerIfEmpty().finally(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBar = Math.max(1, ...(data?.perBulan.flatMap((b) => [b.total, b.keluar]) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Iuran</h1>
          <p className="text-stone-500 text-sm">
            Pantauan dana kolektif • periode berjalan{" "}
            <b>{data ? bulanLabel(data.bulanIni) : "..."}</b>
          </p>
        </div>
        <div className="flex gap-2 no-print flex-wrap">
          <Link href="/input" className="btn-primary text-sm">
            + Iuran Masuk
          </Link>
          <Link href="/keluar" className="btn-secondary text-sm !text-red-600 !border-red-200">
            − Kas Keluar
          </Link>
          <Link href="/laporan" className="btn-secondary text-sm">
            Lihat Laporan
          </Link>
        </div>
      </div>

      {loading || !data ? (
        <p className="text-stone-500">Memuat data...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Saldo Kas (sisa)" value={rupiah(data.saldo)} big highlight sub={data.saldoAwal > 0 ? `termasuk saldo awal ${rupiah(data.saldoAwal)}` : undefined} />
            <Stat label="Total Masuk" value={rupiah(data.totalDana)} />
            <Stat label="Total Keluar" value={rupiah(data.totalKeluar)} />
            <Stat
              label={`Bayar ${bulanLabel(data.bulanIni)}`}
              value={`${data.statusBulanIni.sudah} / ${data.totalWarga} warga`}
            />
          </div>

          {/* Rincian per tempat penyimpanan */}
          {data.perTempat && data.perTempat.length > 0 && (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Saldo per Tempat</h2>
                <Link href="/tempat" className="text-[13px] font-medium text-emerald-700 hover:underline no-print">
                  Kelola tempat →
                </Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {data.perTempat.map((t) => (
                  <Link key={t.id} href="/tempat" className="rounded-xl border border-stone-200 p-3 hover:border-emerald-300 hover:bg-emerald-50/50 transition">
                    <p className="text-xs font-semibold text-stone-500 truncate">💰 {t.nama}</p>
                    <p className="font-bold text-emerald-800 mt-0.5">{rupiah(t.saldo)}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      +{rupiah(t.masuk)}{t.keluar > 0 ? ` • −${rupiah(t.keluar)}` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="card p-4 sm:p-5 lg:col-span-3">
              <h2 className="font-semibold mb-1">Arus Kas — 12 Bulan Terakhir</h2>
              <p className="text-xs text-stone-500 mb-4">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 mr-1 align-middle" /> Masuk
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400 ml-3 mr-1 align-middle" /> Keluar
              </p>
              <div className="flex items-end gap-1.5 h-44">
                {data.perBulan.map((b) => (
                  <div key={b.bulan} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: "124px" }}>
                      <div
                        title={`${bulanLabel(b.bulan)} masuk: ${rupiah(b.total)}`}
                        className="flex-1 max-w-4 rounded-t-md bg-emerald-500/90"
                        style={{ height: `${Math.max(3, (b.total / maxBar) * 124)}px` }}
                      />
                      <div
                        title={`${bulanLabel(b.bulan)} keluar: ${rupiah(b.keluar)}`}
                        className="flex-1 max-w-4 rounded-t-md bg-red-400/90"
                        style={{ height: `${Math.max(3, (b.keluar / maxBar) * 124)}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-stone-500">
                      {bulanLabel(b.bulan).split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4 sm:p-5 lg:col-span-2">
              <h2 className="font-semibold mb-1">Transaksi Terakhir</h2>
              {data.recent.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Belum ada transaksi. Mulai dari{" "}
                  <Link href="/input" className="text-emerald-700 underline">
                    Input Iuran
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {data.recent.slice(0, 5).map((t) => (
                    <li key={t.id} className="py-2 flex justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.nama}</p>
                        <p className="text-xs text-stone-500">
                          {t.tanggal} • {bulanLabel(t.bulan)}
                          {t.keterangan ? ` • ${t.keterangan}` : ""}
                        </p>
                      </div>
                      <p className="font-semibold text-emerald-700 whitespace-nowrap">
                        +{rupiah(t.jumlah)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {(data.recentKeluar || []).length > 0 && (
                <>
                  <h3 className="font-semibold text-sm mt-4 mb-1">Kas Keluar Terakhir</h3>
                  <ul className="divide-y divide-stone-100">
                    {data.recentKeluar.map((t) => (
                      <li key={t.id} className="py-2 flex justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.nama}</p>
                          <p className="text-xs text-stone-500">
                            {t.tanggal}{t.keterangan ? ` • ${t.keterangan}` : ""}
                          </p>
                        </div>
                        <p className="font-semibold text-red-600 whitespace-nowrap">
                          −{rupiah(t.jumlah)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h2 className="font-semibold mb-3">Top Penyetor</h2>
            {/* Mobile: daftar kompak */}
            <ul className="divide-y divide-stone-100 sm:hidden">
              {data.perWarga.slice(0, 8).map((w, i) => (
                <li key={w.wargaId} className="py-2 flex items-center gap-2.5 text-sm">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-100 text-emerald-800 grid place-items-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{w.nama}</p>
                    <p className="text-[11px] text-stone-500">{w.count}x bayar • terakhir {w.terakhir}</p>
                  </div>
                  <p className="font-semibold text-emerald-700 whitespace-nowrap text-[13px]">
                    {rupiah(w.total)}
                  </p>
                </li>
              ))}
            </ul>
            {/* Desktop: tabel */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th rounded-l-lg">Nama</th>
                    <th className="table-th">Kali Bayar</th>
                    <th className="table-th">Terakhir</th>
                    <th className="table-th rounded-r-lg text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perWarga.slice(0, 8).map((w) => (
                    <tr key={w.wargaId}>
                      <td className="table-td font-medium">{w.nama}</td>
                      <td className="table-td">{w.count}x</td>
                      <td className="table-td">{w.terakhir}</td>
                      <td className="table-td text-right font-semibold">{rupiah(w.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, big, highlight, sub }: { label: string; value: string; big?: boolean; highlight?: boolean; sub?: string }) {
  return (
    <div className={`card p-4 ${highlight ? "!bg-emerald-700 !border-emerald-700" : ""}`}>
      <p className={`text-xs ${highlight ? "text-emerald-200" : "text-stone-500"}`}>{label}</p>
      <p className={`font-bold mt-1 ${highlight ? "text-white" : "text-emerald-800"} ${big ? "text-xl lg:text-2xl" : "text-lg"}`}>
        {value}
      </p>
      {sub && <p className={`text-[11px] mt-0.5 ${highlight ? "text-emerald-200" : "text-stone-400"}`}>{sub}</p>}
    </div>
  );
}
