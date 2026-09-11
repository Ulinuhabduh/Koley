"use client";

import { useEffect, useMemo, useState } from "react";
import { rupiah, bulanLabel, currentBulan, toCSV, downloadCSV } from "@/lib/format";

type Warga = { id: string; nama: string; total: number; count: number; createdAt: string };
type Trx = { id: string; wargaId: string; nama: string; jumlah: number; tanggal: string; bulan: string; keterangan: string };

const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function WargaPage() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Warga[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [bulan, setBulan] = useState(currentBulan());
  const [bayarBulanIni, setBayarBulanIni] = useState<Set<string>>(new Set());

  // --- detail per warga ---
  const [selected, setSelected] = useState<Warga | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [detailTrx, setDetailTrx] = useState<Trx[]>([]);
  const [detailKeluar, setDetailKeluar] = useState<Trx[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load(search = "") {
    setLoading(true);
    const r = await fetch(`/api/warga?q=${encodeURIComponent(search)}`, { cache: "no-store" });
    const j = await r.json();
    setList(j.data || []);
    setLoading(false);
  }

  async function loadStatus(b: string) {
    const r = await fetch(`/api/transaksi?bulan=${b}&limit=1000`, { cache: "no-store" });
    const j = await r.json();
    setBayarBulanIni(new Set((j.data || []).map((t: any) => t.wargaId)));
  }

  async function loadDetail(wargaId: string) {
    setDetailLoading(true);
    const [rm, rk] = await Promise.all([
      fetch(`/api/transaksi?wargaId=${wargaId}&limit=1000`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/pengeluaran?wargaId=${wargaId}&limit=1000`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setDetailTrx(rm.data || []);
    setDetailKeluar(rk.data || []);
    setDetailLoading(false);
  }

  useEffect(() => {
    load("");
  }, []);
  useEffect(() => {
    loadStatus(bulan);
  }, [bulan]);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (selected) loadDetail(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // filter tahun berjalan (client-side)
  const trxTahun = useMemo(() => detailTrx.filter((t) => t.bulan.startsWith(tahun)), [detailTrx, tahun]);
  const keluarTahun = useMemo(() => detailKeluar.filter((t) => t.bulan.startsWith(tahun)), [detailKeluar, tahun]);
  const totalKeluarSemua = useMemo(() => detailKeluar.reduce((s, t) => s + t.jumlah, 0), [detailKeluar]);

  // agregasi 12 bulan untuk warga terpilih (masuk + penarikan)
  const perBulanDetail = useMemo(() => {
    const map = new Map<string, { total: number; count: number; keluar: number; countKeluar: number }>();
    for (const t of trxTahun) {
      const cur = map.get(t.bulan) || { total: 0, count: 0, keluar: 0, countKeluar: 0 };
      cur.total += t.jumlah;
      cur.count += 1;
      map.set(t.bulan, cur);
    }
    for (const t of keluarTahun) {
      const cur = map.get(t.bulan) || { total: 0, count: 0, keluar: 0, countKeluar: 0 };
      cur.keluar += t.jumlah;
      cur.countKeluar += 1;
      map.set(t.bulan, cur);
    }
    return Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const key = `${tahun}-${mm}`;
      const v = map.get(key) || { total: 0, count: 0, keluar: 0, countKeluar: 0 };
      return { bulan: key, ...v, lunas: v.total > 0 };
    });
  }, [trxTahun, keluarTahun, tahun]);

  const riwayatTahun = useMemo(
    () =>
      [
        ...trxTahun.map((t) => ({ ...t, arah: "masuk" as const })),
        ...keluarTahun.map((t) => ({ ...t, arah: "keluar" as const })),
      ].sort((a, b) => (b.tanggal + b.bulan).localeCompare(a.tanggal + a.bulan)),
    [trxTahun, keluarTahun]
  );

  const totalTahun = perBulanDetail.reduce((s, b) => s + b.total, 0);
  const keluarTahunTotal = perBulanDetail.reduce((s, b) => s + b.keluar, 0);
  const bulanLunas = perBulanDetail.filter((b) => b.lunas).length;

  function pilih(w: Warga) {
    setSelected(w);
    document.getElementById("detail-warga")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportDetailCSV() {
    if (!selected) return;
    const header = ["Bulan", "Status", "Masuk_Rp", "Keluar_Rp", "Sisa_Rp"];
    const body = perBulanDetail.map((b) => [
      bulanLabel(b.bulan),
      b.lunas ? "LUNAS" : "BELUM",
      b.total,
      b.keluar,
      b.total - b.keluar,
    ]);
    const riwayat: (string | number)[][] = riwayatTahun.map((t) => [
      t.tanggal,
      t.bulan,
      t.arah === "masuk" ? "MASUK" : "PENARIKAN",
      t.arah === "masuk" ? t.jumlah : -t.jumlah,
      t.keterangan || "",
    ]);
    downloadCSV(
      `riwayat-${selected.nama}-${tahun}.csv`,
      toCSV([
        [`RIWAYAT ${selected.nama.toUpperCase()} TAHUN ${tahun}`],
        [],
        header,
        ...body,
        [],
        ["TOTAL MASUK", "", totalTahun],
        ["TOTAL KELUAR", "", keluarTahunTotal],
        ["SISA", "", totalTahun - keluarTahunTotal],
        [],
        ["Tanggal", "Periode", "Jenis", "Jumlah_Rp", "Keterangan"],
        ...riwayat,
      ])
    );
  }

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    if (!newNama.trim()) return;
    const r = await fetch("/api/warga", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama: newNama.trim() }),
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error || "Gagal");
    setNewNama("");
    setShowAdd(false);
    load(q);
    if (j.existed) alert(`"${j.data.nama}" sudah terdaftar.`);
  }

  async function hapus(id: string, nama: string) {
    if (!confirm(`Hapus warga "${nama}"? Riwayat iurannya tetap tersimpan.`)) return;
    await fetch(`/api/warga?id=${id}`, { method: "DELETE" });
    if (selected?.id === id) {
      setSelected(null);
      setDetailTrx([]);
      setDetailKeluar([]);
    }
    load(q);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Data Warga</h1>
        <p className="text-sm text-stone-500">
          Pencet salah satu nama untuk melihat tabel 12 bulannya.
        </p>
      </div>

      {/* ===== DETAIL 12 BULAN ===== */}
      {selected && (
        <div id="detail-warga" className="card p-5 border-2 border-emerald-500 scroll-mt-20">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Detail warga</p>
              <h2 className="text-xl font-bold">{selected.nama}</h2>
              <p className="text-sm text-stone-500">
                Setor <b className="text-emerald-700">{rupiah(selected.total)}</b>
                {totalKeluarSemua > 0 && (
                  <> • Tarik <b className="text-red-600">{rupiah(totalKeluarSemua)}</b></>
                )} • Sisa <b>{rupiah(selected.total - totalKeluarSemua)}</b>
                {" • "}{tahun}: <b>{rupiah(totalTahun - keluarTahunTotal)}</b> ({bulanLunas}/12 bln)
              </p>
            </div>
            <div className="flex items-center gap-2 no-print flex-wrap">
              <button onClick={() => setTahun(String(Number(tahun) - 1))} className="btn-secondary text-sm px-3">‹</button>
              <input
                className="input !w-24 text-center"
                value={tahun}
                onChange={(e) => setTahun(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="2026"
              />
              <button onClick={() => setTahun(String(Number(tahun) + 1))} className="btn-secondary text-sm px-3">›</button>
              <button
                onClick={() => setTahun(String(new Date().getFullYear()))}
                className="btn-secondary text-sm"
              >
                Tahun ini
              </button>
              <button onClick={exportDetailCSV} className="btn-secondary text-sm">⬇ CSV</button>
              <button onClick={() => window.print()} className="btn-secondary text-sm">🖨 Cetak</button>
              <button onClick={() => hapus(selected.id, selected.nama)} className="text-sm text-red-500 hover:underline px-2 sm:hidden">
                Hapus
              </button>
              <button onClick={() => setSelected(null)} className="text-sm text-stone-500 hover:underline px-2">
                ✕ Tutup
              </button>
            </div>
          </div>

          {detailLoading ? (
            <p className="text-sm text-stone-500">Memuat riwayat {tahun}...</p>
          ) : (
            <>
              {/* Tabel 12 bulan: desktop */}
              <div className="overflow-x-auto hidden sm:block">
                <table className="w-full">
                  <thead>
                    <tr>
                      {perBulanDetail.map((b) => (
                        <th key={b.bulan} className="table-th text-center whitespace-nowrap">
                          {NAMA_BULAN[Number(b.bulan.slice(5, 7)) - 1]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {perBulanDetail.map((b) => (
                        <td
                          key={b.bulan}
                          className={`table-td text-center font-semibold whitespace-nowrap ${
                            b.lunas ? "bg-emerald-50 text-emerald-800" : b.keluar > 0 ? "bg-red-50" : "text-stone-300"
                          }`}
                        >
                          {b.lunas ? (
                            <>
                              ✓<div className="text-xs font-bold">{rupiah(b.total)}</div>
                              {b.keluar > 0 && <div className="text-xs font-bold text-red-600">−{rupiah(b.keluar)}</div>}
                              <div className="text-[10px] font-normal text-stone-500">{b.count}x</div>
                            </>
                          ) : b.keluar > 0 ? (
                            <>
                              <div className="text-xs font-bold text-red-600">−{rupiah(b.keluar)}</div>
                              <div className="text-[10px] font-normal text-stone-500">tarik {b.countKeluar}x</div>
                            </>
                          ) : (
                            <>–<div className="text-[10px] font-normal">belum</div></>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Grid 12 bulan: mobile */}
              <div className="grid grid-cols-3 gap-2 sm:hidden">
                {perBulanDetail.map((b, i) => (
                  <div
                    key={b.bulan}
                    className={`rounded-xl border p-2.5 text-center ${
                      b.lunas ? "bg-emerald-50 border-emerald-300" : b.keluar > 0 ? "bg-red-50 border-red-200" : "bg-stone-50 border-stone-200"
                    }`}
                  >
                    <p className="text-xs font-semibold text-stone-500">{NAMA_BULAN[i]}</p>
                    <p className={`text-sm font-bold ${b.lunas ? "text-emerald-800" : "text-stone-300"}`}>
                      {b.lunas ? rupiah(b.total) : "–"}
                    </p>
                    {b.keluar > 0 && <p className="text-xs font-bold text-red-600">−{rupiah(b.keluar)}</p>}
                    <p className="text-[10px] text-stone-400">{b.lunas ? `${b.count}x bayar` : b.keluar > 0 ? "penarikan" : "belum"}</p>
                  </div>
                ))}
              </div>

              {/* Ringkasan + riwayat */}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="rounded-xl bg-stone-50 border border-stone-200 p-3.5 text-sm">
                  <p className="font-semibold mb-1.5">Ringkasan {tahun}</p>
                  <div className="flex justify-between py-1"><span className="text-stone-500">Bulan lunas</span><b>{bulanLunas} / 12</b></div>
                  <div className="flex justify-between py-1"><span className="text-stone-500">Total masuk {tahun}</span><b className="text-emerald-700">+{rupiah(totalTahun)}</b></div>
                  <div className="flex justify-between py-1"><span className="text-stone-500">Total ditarik {tahun}</span><b className="text-red-600">−{rupiah(keluarTahunTotal)}</b></div>
                  <div className="flex justify-between py-1"><span className="text-stone-500">Sisa {tahun}</span><b>{rupiah(totalTahun - keluarTahunTotal)}</b></div>
                  <div className="flex justify-between py-1 border-t border-stone-200 mt-1 pt-2"><span className="text-stone-500">Sisa semua waktu</span><b>{rupiah(selected.total - totalKeluarSemua)}</b></div>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1.5">Riwayat {tahun} ({riwayatTahun.length})</p>
                  {riwayatTahun.length === 0 ? (
                    <p className="text-sm text-stone-500">Belum ada catatan di tahun {tahun}.</p>
                  ) : (
                    <ul className="divide-y divide-stone-100 max-h-56 overflow-auto text-sm">
                      {riwayatTahun.map((t) => (
                        <li key={t.arah + t.id} className="py-1.5 flex justify-between gap-2">
                          <span className="text-stone-600">
                            {t.arah === "keluar" && <span className="inline-block text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mr-1">TARIK</span>}
                            {t.tanggal} • {bulanLabel(t.bulan)}{t.keterangan ? ` • ${t.keterangan}` : ""}
                          </span>
                          <b className={`whitespace-nowrap ${t.arah === "masuk" ? "text-emerald-700" : "text-red-600"}`}>
                            {t.arah === "masuk" ? "+" : "−"}{rupiah(t.jumlah)}
                          </b>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2 mt-2 no-print">
                    <a href={`/input?nama=${encodeURIComponent(selected.nama)}`} className="btn-primary text-xs !py-2 flex-1 text-center">
                      + Iuran {selected.nama.split(" ")[0]}
                    </a>
                    <a href={`/keluar?nama=${encodeURIComponent(selected.nama)}&jenis=penarikan`} className="btn-secondary text-xs !py-2 !text-red-600 !border-red-200">
                      − Tarik
                    </a>
                    <a href={`/laporan?q=${encodeURIComponent(selected.nama)}`} className="btn-secondary text-xs !py-2">
                      Laporan
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== KONTROL: 1 kartu ringkas ===== */}
      <div className="card p-4 space-y-3">
        <input
          className="input"
          placeholder="🔍 Cari nama..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="flex items-center gap-2">
          <label className="text-[13px] text-stone-500 whitespace-nowrap">Periode</label>
          <input
            type="month"
            className="input !py-2 flex-1"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
          />
        </div>
      </div>

      <div className="card px-2 py-1 sm:p-2">
        {loading ? (
          <p className="p-4 text-sm text-stone-500">Memuat...</p>
        ) : list.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">
            Tidak ada hasil{q ? ` untuk “${q}”` : ""}. Tambahkan lewat tombol + Warga di atas.
          </p>
        ) : (
          <>
            {/* Mobile: daftar kompak, pencet untuk 12 bulan */}
            <ul className="divide-y divide-stone-100 sm:hidden">
              {list.map((w) => {
                const sudah = bayarBulanIni.has(w.id);
                const aktif = selected?.id === w.id;
                return (
                  <li key={w.id}>
                    <button
                      onClick={() => pilih(w)}
                      className={`w-full text-left px-3 py-3 flex items-center gap-3 ${aktif ? "bg-emerald-50" : "active:bg-stone-50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[15px] truncate">
                          {w.nama}
                          {aktif && <span className="ml-1.5 text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">12 BLN ↓</span>}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {rupiah(w.total)} • {w.count}x bayar
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${sudah ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                        {sudah ? "Lunas" : "Belum"}
                      </span>
                      <span className="text-stone-300 font-bold">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* Desktop: tabel */}
            <div className="overflow-x-auto hidden sm:block">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Nama</th>
                  <th className="table-th">Status {bulanLabel(bulan)}</th>
                  <th className="table-th">Kali Bayar</th>
                  <th className="table-th text-right">Total Setoran</th>
                  <th className="table-th text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => {
                  const sudah = bayarBulanIni.has(w.id);
                  const aktif = selected?.id === w.id;
                  return (
                    <tr
                      key={w.id}
                      onClick={() => pilih(w)}
                      className={`cursor-pointer ${aktif ? "bg-emerald-50" : "hover:bg-stone-50"}`}
                      title="Pencet untuk lihat 12 bulan"
                    >
                      <td className="table-td font-medium">
                        <span className="text-emerald-700 underline underline-offset-2">{w.nama}</span>
                        {aktif && <span className="ml-2 text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">DIPILIH</span>}
                      </td>
                      <td className="table-td">
                        {sudah ? (
                          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                            SUDAH BAYAR
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                            BELUM
                          </span>
                        )}
                      </td>
                      <td className="table-td">{w.count}x</td>
                      <td className="table-td text-right font-semibold">{rupiah(w.total)}</td>
                      <td className="table-td text-right" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => hapus(w.id, w.nama)} className="text-xs text-red-500 hover:underline">
                          hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* Tambah manual: dipindah ke bawah, tidak mengganggu */}
      <div className="text-center no-print">
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="text-[13px] font-medium text-stone-400 hover:text-emerald-700">
            + Tambah warga manual
          </button>
        ) : (
          <form onSubmit={tambah} className="card p-3 flex gap-2">
            <input
              className="input !py-2"
              placeholder="Nama warga baru..."
              value={newNama}
              onChange={(e) => setNewNama(e.target.value)}
              autoFocus
            />
            <button className="btn-primary whitespace-nowrap text-sm !py-2">Simpan</button>
            <button type="button" onClick={() => { setShowAdd(false); setNewNama(""); }} className="text-sm text-stone-400 px-1">
              ✕
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
