"use client";

import { useEffect, useState } from "react";
import { rupiah, todayISO } from "@/lib/format";
import { listTempat, listTransfer, addTempat, updateTempat, deleteTempat, addTransfer, deleteTransfer, seedFromServerIfEmpty } from "@/lib/localdb";
import RupiahInput from "@/components/RupiahInput";

type Tempat = {
  id: string;
  nama: string;
  keterangan: string;
  saldoAwal: number;
  saldoAwalKet: string;
  saldoAwalTanggal: string;
  saldo: number;
  masuk: number;
  keluar: number;
  transferMasuk: number;
  transferKeluar: number;
  trxMasuk: number;
  trxKeluar: number;
};

type Transfer = {
  id: string;
  dariId: string;
  keId: string;
  dariNama: string;
  keNama: string;
  jumlah: number;
  tanggal: string;
  bulan: string;
  keterangan: string;
};

export default function TempatPage() {
  const [list, setList] = useState<Tempat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // form tambah
  const [nama, setNama] = useState("");
  const [ket, setKet] = useState("");
  const [awal, setAwal] = useState("");
  const [awalTgl, setAwalTgl] = useState("");
  const [saving, setSaving] = useState(false);

  // edit inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editKet, setEditKet] = useState("");
  const [editAwal, setEditAwal] = useState("");

  // transfer
  const [dariId, setDariId] = useState("");
  const [keId, setKeId] = useState("");
  const [pindahJumlah, setPindahJumlah] = useState("");
  const [pindahTgl, setPindahTgl] = useState(todayISO());
  const [pindahKet, setPindahKet] = useState("");
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  function load() {
    setLoading(true);
    try {
      const rt = listTempat();
      const rm = listTransfer(20);
      setList(rt.data || []);
      setTotal(rt.total ?? 0);
      setTransfers(rm.data || []);
      if ((rt.data || []).length > 0) {
        if (!dariId) setDariId(rt.data[0].id);
        if (!keId && rt.data.length > 1) setKeId(rt.data[1].id);
      }
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    seedFromServerIfEmpty().finally(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tambah(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (nama.trim().length < 2) return setMsg({ ok: false, text: "Nama tempat minimal 2 huruf (cth: Kas Tunai, BRI, DANA)." });
    setSaving(true);
    try {
      const j = addTempat({ nama: nama.trim(), keterangan: ket.trim(), saldoAwal: Number(awal) || 0, saldoAwalTanggal: awalTgl });
      setMsg({ ok: true, text: `"${j.data.nama}" ditambahkan.` });
      setNama("");
      setKet("");
      setAwal("");
      setAwalTgl("");
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function mulaiEdit(t: Tempat) {
    setEditId(t.id);
    setEditNama(t.nama);
    setEditKet(t.keterangan || "");
    setEditAwal(String(t.saldoAwal || 0));
  }

  function simpanEdit(id: string) {
    setMsg(null);
    try {
      updateTempat(id, { nama: editNama.trim(), keterangan: editKet.trim(), saldoAwal: Number(editAwal) || 0 });
      setMsg({ ok: true, text: "Perubahan tersimpan." });
      setEditId(null);
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  }

  function hapus(id: string, nm: string) {
    if (!confirm(`Hapus tempat "${nm}"?`)) return;
    setMsg(null);
    try {
      deleteTempat(id);
      setMsg({ ok: true, text: `"${nm}" dihapus.` });
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  }

  function submitPindah(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!dariId || !keId) return setMsg({ ok: false, text: "Pilih tempat asal & tujuan." });
    if (dariId === keId) return setMsg({ ok: false, text: "Asal & tujuan tidak boleh sama." });
    if (!Number(pindahJumlah) || Number(pindahJumlah) <= 0) return setMsg({ ok: false, text: "Jumlah pindah harus > 0." });
    try {
      const j = addTransfer({ dariId, keId, jumlah: Number(pindahJumlah), tanggal: pindahTgl, keterangan: pindahKet });
      setMsg({ ok: true, text: `${rupiah(j.data.jumlah)} dipindah: ${j.data.dariNama} → ${j.data.keNama}.` });
      setPindahJumlah("");
      setPindahKet("");
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  }

  function hapusTransfer(id: string) {
    if (!confirm("Hapus catatan pindah saldo ini? Saldo akan kembali seperti sebelum dipindah.")) return;
    try {
      deleteTransfer(id);
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Tempat Penyimpanan Saldo</h1>
          <p className="text-sm text-stone-500">
            Pisahkan kas ke beberapa dompet — cth: Kas Tunai, Bank BRI, DANA. Total semua:{" "}
            <b className="text-emerald-700">{rupiah(total)}</b>
          </p>
        </div>
      </div>

      {msg && (
        <div className={`text-sm rounded-xl px-3.5 py-2.5 ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Memuat...</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((t) => (
            <div key={t.id} className="card p-4">
              {editId === t.id ? (
                <div className="space-y-2.5">
                  <div>
                    <label className="label">Nama tempat</label>
                    <input className="input" value={editNama} onChange={(e) => setEditNama(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Keterangan</label>
                    <input className="input" value={editKet} onChange={(e) => setEditKet(e.target.value)} placeholder="cth: No. rek 1234 a.n. Bendahara" />
                  </div>
                  <div>
                    <label className="label">Saldo awal (Rp)</label>
                    <RupiahInput className="input" value={editAwal} onChange={setEditAwal} placeholder="0" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => simpanEdit(t.id)} className="btn-primary text-sm flex-1">Simpan</button>
                    <button onClick={() => setEditId(null)} className="btn-secondary text-sm">Batal</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[15px] truncate">💰 {t.nama}</p>
                      {t.keterangan && <p className="text-xs text-stone-500 truncate">{t.keterangan}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0 no-print">
                      <button onClick={() => mulaiEdit(t)} className="text-xs text-emerald-700 hover:underline px-1.5 py-1">ubah</button>
                      <button onClick={() => hapus(t.id, t.nama)} className="text-xs text-red-500 hover:underline px-1.5 py-1">hapus</button>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-emerald-800 mt-2">{rupiah(t.saldo)}</p>
                  <div className="text-xs text-stone-500 mt-1.5 space-y-0.5">
                    <div className="flex justify-between"><span>Awal</span><span>{rupiah(t.saldoAwal)}</span></div>
                    <div className="flex justify-between"><span>Masuk ({t.trxMasuk}x)</span><span className="text-emerald-700 font-semibold">+{rupiah(t.masuk)}</span></div>
                    <div className="flex justify-between"><span>Keluar ({t.trxKeluar}x)</span><span className="text-red-600 font-semibold">−{rupiah(t.keluar)}</span></div>
                    {(t.transferMasuk > 0 || t.transferKeluar > 0) && (
                      <>
                        <div className="flex justify-between"><span>Pindah masuk</span><span className="text-emerald-700">+{rupiah(t.transferMasuk)}</span></div>
                        <div className="flex justify-between"><span>Pindah keluar</span><span className="text-red-600">−{rupiah(t.transferKeluar)}</span></div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tambah tempat baru */}
      <div className="card p-4 sm:p-5">
        <h2 className="font-semibold">+ Tambah Tempat Baru</h2>
        <p className="text-[13px] text-stone-500 mt-0.5 mb-3">Contoh: Kas Tunai, Bank BRI, Bank BCA, DANA, OVO, Brankas.</p>
        <form onSubmit={tambah} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Nama tempat *</label>
              <input className="input" placeholder="cth: Bank BRI" value={nama} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div>
              <label className="label">Keterangan</label>
              <input className="input" placeholder="cth: Rek 0021-... a.n. Kas Desa" value={ket} onChange={(e) => setKet(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Saldo awal (Rp)</label>
              <RupiahInput className="input" placeholder="0" value={awal} onChange={setAwal} />
            </div>
            <div>
              <label className="label">Tanggal dihitung</label>
              <input className="input" type="date" value={awalTgl} onChange={(e) => setAwalTgl(e.target.value)} />
            </div>
          </div>
          <button disabled={saving} className="btn-primary text-sm w-full sm:w-auto">
            {saving ? "Menyimpan..." : "Tambah Tempat"}
          </button>
        </form>
      </div>

      {/* Pindah saldo */}
      <div className="card p-4 sm:p-5">
        <h2 className="font-semibold">🔄 Pindah Saldo Antar Tempat</h2>
        <p className="text-[13px] text-stone-500 mt-0.5 mb-3">Misal: setoran tunai disetor ke bank, atau tarik tunai dari bank.</p>
        <form onSubmit={submitPindah} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dari</label>
              <select className="input" value={dariId} onChange={(e) => setDariId(e.target.value)}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>{t.nama} • {rupiah(t.saldo)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ke</label>
              <select className="input" value={keId} onChange={(e) => setKeId(e.target.value)}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>{t.nama}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Jumlah (Rp)</label>
              <RupiahInput className="input" placeholder="0" value={pindahJumlah} onChange={setPindahJumlah} />
            </div>
            <div>
              <label className="label">Tanggal</label>
              <input className="input" type="date" value={pindahTgl} onChange={(e) => setPindahTgl(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Keterangan</label>
            <input className="input" placeholder="cth: setoran tunai ke bank" value={pindahKet} onChange={(e) => setPindahKet(e.target.value)} />
          </div>
          <button className="btn-primary text-sm w-full sm:w-auto">Pindahkan</button>
        </form>

        {transfers.length > 0 && (
          <div className="mt-4">
            <p className="font-semibold text-sm mb-1.5">Riwayat pindah saldo</p>
            <ul className="divide-y divide-stone-100 text-sm">
              {transfers.map((m) => (
                <li key={m.id} className="py-2 flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.dariNama} → {m.keNama}</p>
                    <p className="text-xs text-stone-500">{m.tanggal}{m.keterangan ? ` • ${m.keterangan}` : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{rupiah(m.jumlah)}</p>
                    <button onClick={() => hapusTransfer(m.id)} className="text-[11px] text-red-400 hover:underline">hapus</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-xs text-stone-400">
        Tips: saat Input Iuran pilih tempat tujuan (uangnya disimpan di mana), saat Kas Keluar pilih sumber dana. Saldo tiap tempat dicek otomatis agar tidak minus.
      </p>
    </div>
  );
}
