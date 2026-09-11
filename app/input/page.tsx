"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { rupiah, todayISO, currentBulan } from "@/lib/format";

type WargaOpt = { id: string; nama: string; total: number; count: number };

function InputInner() {
  const sp = useSearchParams();
  const [nama, setNama] = useState(sp.get("nama") || "");
  const [opts, setOpts] = useState<WargaOpt[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [jumlah, setJumlah] = useState("50000");
  const [tanggal, setTanggal] = useState(todayISO());
  const [bulan, setBulan] = useState(currentBulan());
  const [keterangan, setKeterangan] = useState("");
  const [showKet, setShowKet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const timer = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // autocomplete: cari saat ketik
  useEffect(() => {
    clearTimeout(timer.current);
    if (!nama.trim()) {
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
  }, [nama]);

  // tutup dropdown saat klik di luar
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function loadRecent() {
    const r = await fetch("/api/transaksi?limit=8", { cache: "no-store" });
    const j = await r.json();
    setRecent(j.data || []);
  }
  useEffect(() => {
    loadRecent();
  }, []);

  const exactMatch = opts.some((o) => o.nama.toLowerCase() === nama.trim().toLowerCase());
  const isNew = nama.trim().length >= 2 && !exactMatch;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!nama.trim()) return setMsg({ ok: false, text: "Nama wajib diisi." });
    if (!Number(jumlah) || Number(jumlah) <= 0) return setMsg({ ok: false, text: "Jumlah harus lebih dari 0." });

    setSaving(true);
    try {
      const r = await fetch("/api/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama.trim(), jumlah: Number(jumlah), tanggal, bulan, keterangan }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan");
      setMsg({
        ok: true,
        text: j.wargaBaru
          ? `Warga baru "${j.warga.nama}" otomatis tersimpan + iuran ${rupiah(j.data.jumlah)} tercatat.`
          : `Iuran ${rupiah(j.data.jumlah)} untuk "${j.warga.nama}" tercatat.`,
      });
      setNama("");
      setKeterangan("");
      setShowKet(false);
      setOpts([]);
      loadRecent();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function hapus(id: string) {
    if (!confirm("Hapus transaksi ini? (untuk koreksi salah input)")) return;
    await fetch(`/api/transaksi?id=${id}`, { method: "DELETE" });
    loadRecent();
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="card p-4 sm:p-5 lg:col-span-3 h-fit">
        <h1 className="text-xl font-bold">Input Iuran</h1>
        <p className="text-[13px] text-stone-500 mb-5">
          Nama baru otomatis tersimpan sebagai warga.
        </p>

        <form onSubmit={submit} className="space-y-5">
          <div ref={boxRef} className="relative">
            <label className="label">Nama warga</label>
            <input
              className="input"
              placeholder="cth: Budi Santoso"
              value={nama}
              onChange={(e) => {
                setNama(e.target.value);
                setHighlight(-1);
              }}
              onFocus={() => nama.trim() && setShowDrop(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, opts.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, -1));
                } else if (e.key === "Enter" && highlight >= 0 && opts[highlight]) {
                  e.preventDefault();
                  setNama(opts[highlight].nama);
                  setShowDrop(false);
                } else if (e.key === "Escape") {
                  setShowDrop(false);
                }
              }}
              autoComplete="off"
            />
            {showDrop && nama.trim() && (
              <div className="absolute z-10 mt-1.5 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                {opts.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowDrop(false)}
                    className="w-full text-left px-3.5 py-3 text-sm hover:bg-emerald-50"
                  >
                    <span className="inline-block text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 mr-2">
                      BARU
                    </span>
                    Tambah <b>“{nama.trim()}”</b> sebagai warga baru
                  </button>
                ) : (
                  <ul className="max-h-64 overflow-auto">
                    {opts.map((o, i) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setNama(o.nama);
                            setShowDrop(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-sm flex justify-between gap-2 ${
                            i === highlight ? "bg-emerald-50" : "hover:bg-stone-50"
                          }`}
                        >
                          <span className="font-medium">{o.nama}</span>
                          <span className="text-xs text-stone-500 whitespace-nowrap">
                            {o.count}x • {rupiah(o.total)}
                          </span>
                        </button>
                      </li>
                    ))}
                    {isNew && (
                      <li className="border-t border-stone-100">
                        <div className="px-3.5 py-2.5 text-sm text-stone-600">
                          <span className="inline-block text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 mr-2">
                            BARU
                          </span>
                          “{nama.trim()}” belum terdaftar — akan otomatis tersimpan saat Simpan.
                        </div>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
            {nama.trim() &&
              (isNew ? (
                <p className="text-xs text-amber-700 mt-1.5">
                  Nama baru — akan disimpan ke database saat tombol Simpan ditekan.
                </p>
              ) : (
                <p className="text-xs text-emerald-700 mt-1.5">
                  Nama sudah terdaftar — tinggal simpan iurannya.
                </p>
              ))}
          </div>

          {/* Jumlah: full width + pilihan nominal sejajar */}
          <div>
            <label className="label">Jumlah</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">
                Rp
              </span>
              <input
                className="input !pl-10 !text-lg !font-bold !py-3"
                type="number"
                min={1000}
                step={500}
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[10000, 20000, 50000, 100000].map((n) => {
                const aktif = Number(jumlah) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setJumlah(String(n))}
                    className={`text-xs font-semibold px-1 py-2 rounded-xl border transition ${
                      aktif
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "border-stone-300 text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {n / 1000}rb
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tanggal & periode: berdampingan, lega */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tanggal bayar</label>
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
              <input
                className="input"
                type="month"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
              />
            </div>
          </div>

          {/* Keterangan: disembunyikan di balik toggle agar form lega */}
          {!showKet ? (
            <button
              type="button"
              onClick={() => setShowKet(true)}
              className="text-[13px] font-medium text-emerald-700 hover:underline"
            >
              + Tambah keterangan (opsional)
            </button>
          ) : (
            <div>
              <label className="label">Keterangan</label>
              <input
                className="input"
                placeholder="cth: iuran September, denda..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>
          )}

          {msg && (
            <div
              className={`text-sm rounded-xl px-3.5 py-2.5 ${
                msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button disabled={saving} className="btn-primary w-full !py-3.5 !text-base !rounded-2xl">
            {saving ? "Menyimpan..." : `Simpan ${jumlah ? rupiah(Number(jumlah) || 0) : ""}`}
          </button>
        </form>
      </div>

      <div className="card p-4 sm:p-5 lg:col-span-2 h-fit">
        <h2 className="font-semibold mb-1">Baru Saja Diinput</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-500">Belum ada data.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recent.map((t: any) => (
              <li key={t.id} className="py-2 flex justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{t.nama}</p>
                  <p className="text-xs text-stone-500">
                    {t.tanggal} • {t.bulan}
                    {t.keterangan ? ` • ${t.keterangan}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-700">{rupiah(t.jumlah)}</p>
                  <button
                    onClick={() => hapus(t.id)}
                    className="text-[11px] text-red-500 hover:underline"
                  >
                    hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function InputPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">Memuat form...</p>}>
      <InputInner />
    </Suspense>
  );
}
