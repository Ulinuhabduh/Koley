"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { rupiah, todayISO, currentBulan, bulanLabel } from "@/lib/format";

type WargaOpt = { id: string; nama: string; total: number; count: number };
type Keluar = { id: string; jenis: string; nama: string; jumlah: number; tanggal: string; bulan: string; keterangan: string };

function KeluarInner() {
  const sp = useSearchParams();
  const [jenis, setJenis] = useState<"belanja" | "penarikan">("belanja");
  const [nama, setNama] = useState("");

  // prefill dari Data Warga (?nama=...&jenis=penarikan)
  useEffect(() => {
    const n = sp.get("nama");
    if (n) {
      setNama(n);
      if (sp.get("jenis") !== "belanja") setJenis("penarikan");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [opts, setOpts] = useState<WargaOpt[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [jumlah, setJumlah] = useState("");
  const [tanggal, setTanggal] = useState(todayISO());
  const [bulan, setBulan] = useState(currentBulan());
  const [keterangan, setKeterangan] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent] = useState<Keluar[]>([]);
  const [saldo, setSaldo] = useState<number | null>(null);
  const timer = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // autocomplete warga (khusus penarikan)
  useEffect(() => {
    clearTimeout(timer.current);
    if (jenis !== "penarikan" || !nama.trim()) {
      setOpts([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/warga?q=${encodeURIComponent(nama.trim())}`);
      const j = await r.json();
      setOpts(j.data || []);
      setShowDrop(true);
    }, 200);
    return () => clearTimeout(timer.current);
  }, [nama, jenis]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function loadRecent() {
    const r = await fetch("/api/pengeluaran?limit=10", { cache: "no-store" });
    const j = await r.json();
    setRecent(j.data || []);
    const rr = await fetch("/api/rekap", { cache: "no-store" });
    const rj = await rr.json();
    setSaldo(rj.saldo ?? 0);
  }
  useEffect(() => {
    loadRecent();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!nama.trim()) return setMsg({ ok: false, text: jenis === "belanja" ? "Keperluan/tujuan wajib diisi." : "Nama warga wajib diisi." });
    if (!Number(jumlah) || Number(jumlah) <= 0) return setMsg({ ok: false, text: "Jumlah harus lebih dari 0." });

    setSaving(true);
    try {
      const r = await fetch("/api/pengeluaran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenis, nama: nama.trim(), jumlah: Number(jumlah), tanggal, bulan, keterangan }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan");
      setMsg({ ok: true, text: `Kas keluar ${rupiah(j.data.jumlah)} tercatat.` });
      setNama("");
      setJumlah("");
      setKeterangan("");
      setOpts([]);
      loadRecent();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function hapus(id: string) {
    if (!confirm("Hapus catatan pengeluaran ini?")) return;
    await fetch(`/api/pengeluaran?id=${id}`, { method: "DELETE" });
    loadRecent();
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="card p-4 sm:p-5 lg:col-span-3 h-fit">
        <h1 className="text-xl font-bold">Kas Keluar</h1>
        <p className="text-[13px] text-stone-500 mb-4">
          Sisa saldo kas: <b className="text-emerald-700">{saldo === null ? "..." : rupiah(saldo)}</b>
        </p>

        {/* Pilih jenis */}
        <div className="grid grid-cols-2 gap-2 mb-5 no-print">
          <button
            type="button"
            onClick={() => { setJenis("belanja"); setNama(""); setOpts([]); }}
            className={`rounded-2xl border p-3 text-left transition ${jenis === "belanja" ? "border-red-500 bg-red-50" : "border-stone-200 hover:bg-stone-50"}`}
          >
            <p className="font-bold text-sm">🛒 Belanja</p>
            <p className="text-[11px] text-stone-500 mt-0.5">Beli barang / keperluan desa</p>
          </button>
          <button
            type="button"
            onClick={() => { setJenis("penarikan"); setNama(""); setOpts([]); }}
            className={`rounded-2xl border p-3 text-left transition ${jenis === "penarikan" ? "border-red-500 bg-red-50" : "border-stone-200 hover:bg-stone-50"}`}
          >
            <p className="font-bold text-sm">💸 Penarikan</p>
            <p className="text-[11px] text-stone-500 mt-0.5">Warga mengambil uangnya</p>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div ref={boxRef} className="relative">
            <label className="label">{jenis === "belanja" ? "Untuk apa / ke siapa" : "Nama warga yang menarik"}</label>
            <input
              className="input"
              placeholder={jenis === "belanja" ? "cth: Beli semen 5 sak" : "cth: Budi Santoso"}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              onFocus={() => nama.trim() && jenis === "penarikan" && setShowDrop(true)}
              autoComplete="off"
            />
            {jenis === "penarikan" && showDrop && nama.trim() && opts.length > 0 && (
              <div className="absolute z-10 mt-1.5 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                <ul className="max-h-56 overflow-auto">
                  {opts.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setNama(o.nama);
                          setShowDrop(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-sm flex justify-between gap-2 hover:bg-stone-50"
                      >
                        <span className="font-medium">{o.nama}</span>
                        <span className="text-xs text-stone-500 whitespace-nowrap">saldo setor {rupiah(o.total)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label className="label">Jumlah</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">Rp</span>
              <input
                className="input !pl-10 !text-lg !font-bold !py-3"
                type="number"
                min={1000}
                step={500}
                placeholder="0"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tanggal</label>
              <input
                className="input"
                type="date"
                value={tanggal}
                onChange={(e) => {
                  setTanggal(e.target.value);
                  if (e.target.value) setBulan(e.target.value.slice(0, 7));
                }}
              />
            </div>
            <div>
              <label className="label">Periode bulan</label>
              <input className="input" type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Keterangan</label>
            <input
              className="input"
              placeholder={jenis === "belanja" ? "cth: nota toko Jaya, 5 sak" : "cth: ambil tabungan"}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>

          {msg && (
            <div className={`text-sm rounded-xl px-3.5 py-2.5 ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {msg.text}
            </div>
          )}

          <button disabled={saving} className="w-full !py-3.5 !text-base !rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold transition disabled:opacity-50">
            {saving ? "Menyimpan..." : `Catat Keluar ${jumlah ? rupiah(Number(jumlah) || 0) : ""}`}
          </button>
        </form>
      </div>

      <div className="card p-4 sm:p-5 lg:col-span-2 h-fit">
        <h2 className="font-semibold mb-1">Terakhir Keluar</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-500">Belum ada pengeluaran.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recent.map((t) => (
              <li key={t.id} className="py-2 flex justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mr-1.5 ${t.jenis === "penarikan" ? "bg-amber-100 text-amber-800" : "bg-stone-200 text-stone-600"}`}>
                      {t.jenis === "penarikan" ? "TARIK" : "BELANJA"}
                    </span>
                    {t.nama}
                  </p>
                  <p className="text-xs text-stone-500">
                    {t.tanggal} • {bulanLabel(t.bulan)}{t.keterangan ? ` • ${t.keterangan}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-red-600">−{rupiah(t.jumlah)}</p>
                  <button onClick={() => hapus(t.id)} className="text-[11px] text-red-400 hover:underline">hapus</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function KeluarPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">Memuat...</p>}>
      <KeluarInner />
    </Suspense>
  );
}
