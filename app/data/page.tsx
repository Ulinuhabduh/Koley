"use client";

import { useEffect, useRef, useState } from "react";
import { rupiah, todayISO } from "@/lib/format";
import { exportData, getRekap, importData, seedFromServerIfEmpty } from "@/lib/localdb";

type Preview = {
  fileName: string;
  wargas: number;
  transaksis: number;
  pengeluarans: number;
  tempats: number;
  transfers: number;
  totalMasuk: number;
  totalKeluar: number;
  parsed: any;
};

export default function DataPage() {
  const [info, setInfo] = useState<any>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function loadInfo() {
    try {
      setInfo(getRekap());
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  }
  useEffect(() => {
    seedFromServerIfEmpty().finally(loadInfo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Murni lokal: unduh dari localStorage browser, tanpa lewat server.
  // Dijamin jalan di Vercel (server Vercel read-only, jadi API lama gagal).
  function downloadBackup() {
    setMsg(null);
    try {
      const j = exportData();
      const blob = new Blob([JSON.stringify(j, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `koley-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: "File backup terunduh. Simpan di tempat aman (HP/laptop/flashdisk)." });
    } catch (err: any) {
      setMsg({ ok: false, text: `Gagal mengunduh: ${err.message}` });
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(null);
    setPreview(null);
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      if (!text.trim()) throw new Error("File kosong (0 byte). Kemungkinan proses unduh backup sebelumnya terputus — unduh ulang.");
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.wargas) || !Array.isArray(parsed.transaksis)) {
        throw new Error("Bukan file backup Koley (wajib ada 'wargas' & 'transaksis').");
      }
      const sum = (arr: any[]) => arr.reduce((s, t) => s + (Number(t.jumlah) > 0 ? Math.round(Number(t.jumlah)) : 0), 0);
      setPreview({
        fileName: f.name,
        wargas: parsed.wargas.length,
        transaksis: parsed.transaksis.length,
        pengeluarans: Array.isArray(parsed.pengeluarans) ? parsed.pengeluarans.length : 0,
        tempats: Array.isArray(parsed.tempats) ? parsed.tempats.length : 0,
        transfers: Array.isArray(parsed.transfers) ? parsed.transfers.length : 0,
        totalMasuk: sum(parsed.transaksis),
        totalKeluar: Array.isArray(parsed.pengeluarans) ? sum(parsed.pengeluarans) : 0,
        parsed,
      });
    } catch (err: any) {
      setMsg({ ok: false, text: `Gagal membaca file: ${err.message}` });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Murni lokal: tulis ke localStorage browser, tanpa lewat server.
  async function doRestore() {
    if (!preview) return;
    if (!confirm(`Ganti SELURUH data di perangkat ini dengan isi "${preview.fileName}"?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const imported = importData(preview.parsed);
      setMsg({
        ok: true,
        text: `Restore berhasil: ${imported.wargas} warga, ${imported.transaksis} iuran masuk, ${imported.pengeluarans} pengeluaran, ${imported.tempats ?? 0} tempat.`,
      });
      setPreview(null);
      loadInfo();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Backup & Restore</h1>
        <p className="text-sm text-stone-500">Unduh data JSON untuk arsip, dan impor kembali kapan saja.</p>
      </div>

      {info && (
        <div className="card p-4 text-sm">
          <p className="font-semibold mb-1.5">Data saat ini di perangkat ini</p>
          {info.saldoAwal > 0 && (
            <div className="flex justify-between py-1"><span className="text-stone-500">Saldo awal</span><b>{rupiah(info.saldoAwal)}</b></div>
          )}
          <div className="flex justify-between py-1"><span className="text-stone-500">Warga</span><b>{info.totalWarga}</b></div>
          <div className="flex justify-between py-1"><span className="text-stone-500">Iuran masuk</span><b className="text-emerald-700">{rupiah(info.totalDana ?? 0)}</b></div>
          <div className="flex justify-between py-1"><span className="text-stone-500">Pengeluaran</span><b className="text-red-600">{rupiah(info.totalKeluar ?? 0)}</b></div>
          <div className="flex justify-between py-1 border-t border-stone-200 mt-1 pt-2"><span className="text-stone-500">Saldo</span><b>{rupiah(info.saldo ?? 0)}</b></div>
        </div>
      )}

      {(info?.perTempat || []).length > 0 && (
        <div className="card p-4 text-sm">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-semibold">Tempat penyimpanan</p>
            <a href="/tempat" className="text-[13px] text-emerald-700 underline">Kelola →</a>
          </div>
          {(info.perTempat || []).map((t: any) => (
            <div key={t.id} className="flex justify-between py-1">
              <span className="text-stone-500">💰 {t.nama}</span>
              <b>{rupiah(t.saldo)}</b>
            </div>
          ))}
          <p className="text-[11px] text-stone-400 mt-1">Saldo awal & pindah saldo diatur di halaman Tempat Saldo.</p>
        </div>
      )}

      <div className="card p-4 sm:p-5">
        <h2 className="font-semibold">⬇ Unduh Backup (JSON)</h2>
        <p className="text-[13px] text-stone-500 mt-1 mb-3">
          Berisi seluruh data: warga, iuran masuk, pengeluaran, tempat saldo & pindah saldo. Lakukan rutin tiap bulan.
        </p>
        <button onClick={downloadBackup} className="btn-primary text-sm w-full sm:w-auto">
          Unduh koley-backup-{todayISO()}.json
        </button>
      </div>

      <div className="card p-4 sm:p-5">
        <h2 className="font-semibold">⬆ Impor / Restore (JSON)</h2>
        <p className="text-[13px] text-stone-500 mt-1 mb-3">
          Pilih file backup Koley dari perangkat. Isi file ditampilkan dulu untuk dicek sebelum mengganti data.
        </p>
        <label className="btn-secondary text-sm inline-block cursor-pointer text-center w-full sm:w-auto">
          Pilih file backup...
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
        </label>

        {preview && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-sm">
            <p className="font-semibold">Pratinjau: {preview.fileName}</p>
            <div className="flex justify-between py-1 mt-1"><span className="text-stone-500">Warga</span><b>{preview.wargas}</b></div>
            <div className="flex justify-between py-1"><span className="text-stone-500">Iuran masuk</span><b>{preview.transaksis} • {rupiah(preview.totalMasuk)}</b></div>
            <div className="flex justify-between py-1"><span className="text-stone-500">Pengeluaran</span><b>{preview.pengeluarans} • {rupiah(preview.totalKeluar)}</b></div>
            <div className="flex justify-between py-1"><span className="text-stone-500">Tempat saldo</span><b>{preview.tempats} tempat{preview.transfers > 0 ? ` • ${preview.transfers} transfer` : ""}</b></div>
            <p className="text-xs text-amber-700 mt-2">
              ⚠️ Restore akan MENGGANTI seluruh data di perangkat ini.
            </p>
            <div className="flex gap-2 mt-3">
              <button disabled={busy} onClick={doRestore} className="btn-primary text-sm flex-1">
                {busy ? "Memulihkan..." : "Ya, ganti data dengan file ini"}
              </button>
              <button onClick={() => setPreview(null)} className="btn-secondary text-sm">Batal</button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div className={`text-sm rounded-xl px-3.5 py-2.5 ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      <p className="text-xs text-stone-400">
        Tips: data tersimpan di browser perangkat ini (tetap ada walau offline setelah dibuka sekali).
        Ganti HP/browser? Unduh backup dulu di perangkat lama, lalu Impor di perangkat baru.
      </p>
    </div>
  );
}
