// Penyimpanan 100% di browser (localStorage) agar jalan di Vercel.
//
// Kenapa: Vercel memakai filesystem read-only + ephemeral. Kode lama menyimpan
// ke data/koley.json via fs sehingga di localhost bisa (filesystem writable),
// tapi di Vercel: (1) data/koley.json tidak ikut deploy (di .gitignore),
// (2) writeDB/snapshotBackup gagal (EROFS), sehingga Import/Restore selalu gagal.
// Solusi: simpan di localStorage browser admin ("koley-db-v1").
// Alur tetap sederhana seperti permintaan user: Unduh backup JSON -> Impor lagi kapan saja.
// Konsekuensi: data menempel di 1 browser/HP. Ganti perangkat -> impor file backup JSON.
//

export type Warga = { id: string; nama: string; createdAt: string };

export type Tempat = {
  id: string;
  nama: string;
  keterangan: string;
  saldoAwal: number;
  saldoAwalKet: string;
  saldoAwalTanggal: string;
  createdAt: string;
};

export type Transfer = {
  id: string;
  dariId: string;
  keId: string;
  dariNama: string;
  keNama: string;
  jumlah: number;
  tanggal: string;
  bulan: string;
  keterangan: string;
  createdAt: string;
};

export type Transaksi = {
  id: string;
  wargaId: string;
  nama: string;
  jumlah: number;
  tanggal: string;
  bulan: string;
  keterangan: string;
  tempatId: string;
  tempatNama: string;
  createdAt: string;
};

export type Pengeluaran = {
  id: string;
  jenis: "belanja" | "penarikan";
  wargaId: string | null;
  nama: string;
  jumlah: number;
  tanggal: string;
  bulan: string;
  keterangan: string;
  tempatId: string;
  tempatNama: string;
  createdAt: string;
};

export type DBShape = {
  wargas: Warga[];
  transaksis: Transaksi[];
  pengeluarans: Pengeluaran[];
  tempats: Tempat[];
  transfers: Transfer[];
  saldoAwal: number;
  saldoAwalKet: string;
  saldoAwalTanggal: string;
};

const KEY = "koley-db-v1";

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeNama(nama: string) {
  return nama.trim().replace(/\s+/g, " ");
}

function defaultDB(): DBShape {
  return {
    wargas: [],
    transaksis: [],
    pengeluarans: [],
    tempats: [
      {
        id: uid("tmp"),
        nama: "Kas Tunai",
        keterangan: "Uang tunai di tangan bendahara",
        saldoAwal: 0,
        saldoAwalKet: "",
        saldoAwalTanggal: "",
        createdAt: new Date().toISOString(),
      },
    ],
    transfers: [],
    saldoAwal: 0,
    saldoAwalKet: "",
    saldoAwalTanggal: "",
  };
}

function cleanTempat(t: any): Tempat | null {
  if (!t || typeof t.nama !== "string" || t.nama.trim().length < 2) return null;
  return {
    id: typeof t.id === "string" && t.id ? t.id : uid("tmp"),
    nama: t.nama.trim().replace(/\s+/g, " ").slice(0, 60),
    keterangan: typeof t.keterangan === "string" ? t.keterangan.slice(0, 200) : "",
    saldoAwal: Number(t.saldoAwal) > 0 ? Math.round(Number(t.saldoAwal)) : 0,
    saldoAwalKet: typeof t.saldoAwalKet === "string" ? t.saldoAwalKet.slice(0, 200) : "",
    saldoAwalTanggal: /^\d{4}-\d{2}-\d{2}$/.test(t.saldoAwalTanggal || "") ? t.saldoAwalTanggal : "",
    createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
  };
}

// Samakan dengan logika migrasi di lib/db.ts agar file backup lama tetap terbaca.
function normalizeDB(parsed: any): DBShape {
  const wargas: Warga[] = Array.isArray(parsed?.wargas) ? parsed.wargas : [];
  const transfers: Transfer[] = Array.isArray(parsed?.transfers)
    ? parsed.transfers.filter(
        (t: any) => t && typeof t.dariId === "string" && typeof t.keId === "string" && Number(t.jumlah) > 0
      )
    : [];

  let tempats: Tempat[] = Array.isArray(parsed?.tempats)
    ? parsed.tempats.map(cleanTempat).filter((t: Tempat | null): t is Tempat => !!t)
    : [];
  if (tempats.length === 0) {
    const legacyAwal = Number(parsed?.saldoAwal) > 0 ? Math.round(Number(parsed.saldoAwal)) : 0;
    tempats = [
      {
        id: uid("tmp"),
        nama: "Kas Tunai",
        keterangan: "Uang tunai di tangan bendahara",
        saldoAwal: legacyAwal,
        saldoAwalKet: typeof parsed?.saldoAwalKet === "string" ? parsed.saldoAwalKet.slice(0, 200) : "",
        saldoAwalTanggal: typeof parsed?.saldoAwalTanggal === "string" ? parsed.saldoAwalTanggal : "",
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const tempatById = new Map(tempats.map((t) => [t.id, t]));
  const defId = tempats[0].id;

  const transaksis: Transaksi[] = Array.isArray(parsed?.transaksis) ? parsed.transaksis : [];
  for (const t of transaksis) {
    if (!t.tempatId || !tempatById.has(t.tempatId)) t.tempatId = defId;
    const tp = tempatById.get(t.tempatId);
    if (tp) t.tempatNama = tp.nama;
  }

  const pengeluarans: Pengeluaran[] = Array.isArray(parsed?.pengeluarans) ? parsed.pengeluarans : [];
  for (const t of pengeluarans) {
    if (!t.tempatId || !tempatById.has(t.tempatId)) t.tempatId = defId;
    const tp = tempatById.get(t.tempatId);
    if (tp) t.tempatNama = tp.nama;
  }

  const totalAwal = tempats.reduce((s, t) => s + (t.saldoAwal || 0), 0);
  return {
    wargas,
    transaksis,
    pengeluarans,
    tempats,
    transfers,
    saldoAwal: totalAwal,
    saldoAwalKet: "",
    saldoAwalTanggal: tempats[0]?.saldoAwalTanggal || "",
  };
}

export function loadDB(): DBShape {
  if (typeof window === "undefined") return defaultDB();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const init = defaultDB();
      window.localStorage.setItem(KEY, JSON.stringify(init));
      return init;
    }
    return normalizeDB(JSON.parse(raw));
  } catch {
    return defaultDB();
  }
}

export function saveDB(db: DBShape) {
  if (!Array.isArray(db.tempats) || db.tempats.length === 0) {
    db.tempats = [
      {
        id: uid("tmp"),
        nama: "Kas Tunai",
        keterangan: "",
        saldoAwal: db.saldoAwal || 0,
        saldoAwalKet: db.saldoAwalKet || "",
        saldoAwalTanggal: db.saldoAwalTanggal || "",
        createdAt: new Date().toISOString(),
      },
    ];
  }
  if (!Array.isArray(db.transfers)) db.transfers = [];
  db.saldoAwal = db.tempats.reduce((s, t) => s + (Number(t.saldoAwal) || 0), 0);
  window.localStorage.setItem(KEY, JSON.stringify(db));
}

// Dipanggil sekali saat halaman dimuat (localhost): bila browser masih kosong tapi
// server lama (data/koley.json) punya isi, salin ke browser agar data tidak "hilang".
// Di Vercel server selalu kosong sehingga fungsi ini no-op dan aman.
export async function seedFromServerIfEmpty(): Promise<boolean> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        const adaIsi =
          (Array.isArray(p?.wargas) && p.wargas.length > 0) ||
          (Array.isArray(p?.transaksis) && p.transaksis.length > 0) ||
          (Array.isArray(p?.pengeluarans) && p.pengeluarans.length > 0);
        if (adaIsi) return false;
      } catch {
        /* lanjut seed */
      }
    }
    const r = await fetch("/api/backup", { cache: "no-store" });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    if (!j || !Array.isArray(j.wargas)) return false;
    const adaServer =
      j.wargas.length > 0 || (j.transaksis || []).length > 0 || (j.pengeluarans || []).length > 0;
    if (!adaServer) return false;
    saveDB(normalizeDB(j));
    return true;
  } catch {
    return false;
  }
}

// ---------- saldo ----------
export function saldoTempat(
  db: DBShape,
  tempatId: string
): { saldoAwal: number; masuk: number; keluar: number; transferMasuk: number; transferKeluar: number; saldo: number } {
  const tp = db.tempats.find((t) => t.id === tempatId);
  const saldoAwal = tp?.saldoAwal || 0;
  const masuk = db.transaksis.filter((t) => t.tempatId === tempatId).reduce((s, t) => s + t.jumlah, 0);
  const keluar = db.pengeluarans.filter((t) => t.tempatId === tempatId).reduce((s, t) => s + t.jumlah, 0);
  const transferMasuk = db.transfers.filter((t) => t.keId === tempatId).reduce((s, t) => s + t.jumlah, 0);
  const transferKeluar = db.transfers.filter((t) => t.dariId === tempatId).reduce((s, t) => s + t.jumlah, 0);
  return { saldoAwal, masuk, keluar, transferMasuk, transferKeluar, saldo: saldoAwal + masuk - keluar + transferMasuk - transferKeluar };
}

function todayBulan(tanggal: string) {
  return tanggal.slice(0, 7);
}

function bulanKeyTahunBulan(year: number, monthIndex0: number) {
  const d = new Date(year, monthIndex0, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function currentBulan() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- rekap (mirror /api/rekap) ----------
export function getRekap() {
  const db = loadDB();
  const saldoAwal = db.tempats.reduce((s, t) => s + (t.saldoAwal || 0), 0);
  const totalDana = db.transaksis.reduce((s, t) => s + t.jumlah, 0);
  const totalKeluar = db.pengeluarans.reduce((s, t) => s + t.jumlah, 0);
  const saldo = saldoAwal + totalDana - totalKeluar;
  const totalWarga = db.wargas.length;
  const totalTransaksi = db.transaksis.length;

  const perTempat = db.tempats.map((t) => ({
    id: t.id,
    nama: t.nama,
    keterangan: t.keterangan,
    ...saldoTempat(db, t.id),
  }));

  const bulanIni = currentBulan();
  const trxBulanIni = db.transaksis.filter((t) => t.bulan === bulanIni);
  const totalBulanIni = trxBulanIni.reduce((s, t) => s + t.jumlah, 0);
  const keluarBulanIni = db.pengeluarans.filter((t) => t.bulan === bulanIni).reduce((s, t) => s + t.jumlah, 0);

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

  const agg = new Map<string, { nama: string; total: number; count: number; terakhir: string }>();
  for (const t of db.transaksis) {
    const cur = agg.get(t.wargaId) || { nama: t.nama, total: 0, count: 0, terakhir: t.tanggal };
    cur.total += t.jumlah;
    cur.count += 1;
    if (t.tanggal > cur.terakhir) cur.terakhir = t.tanggal;
    cur.nama = t.nama;
    agg.set(t.wargaId, cur);
  }
  for (const w of db.wargas) {
    if (!agg.has(w.id)) agg.set(w.id, { nama: w.nama, total: 0, count: 0, terakhir: "-" });
  }
  const perWarga = [...agg.entries()]
    .map(([wargaId, v]) => ({ wargaId, ...v }))
    .sort((a, b) => b.total - a.total);

  const sudahBayarIds = new Set(trxBulanIni.map((t) => t.wargaId));
  const statusBulanIni = { bulan: bulanIni, sudah: sudahBayarIds.size, belum: Math.max(0, totalWarga - sudahBayarIds.size) };

  const recent = [...db.transaksis].sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt)).slice(0, 10);
  const recentKeluar = [...db.pengeluarans].sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt)).slice(0, 5);
  const recentTransfer = [...db.transfers].sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt)).slice(0, 5);

  return { saldoAwal, totalDana, totalKeluar, saldo, totalWarga, totalTransaksi, totalBulanIni, keluarBulanIni, bulanIni, statusBulanIni, perBulan, perWarga, perTempat, recent, recentKeluar, recentTransfer };
}

// ---------- warga ----------
export function listWarga(q = "") {
  const db = loadDB();
  const query = q.trim().toLowerCase();
  let list = [...db.wargas].sort((a, b) => a.nama.localeCompare(b.nama));
  if (query) list = list.filter((w) => w.nama.toLowerCase().includes(query));
  const totalByWarga = new Map<string, { total: number; count: number }>();
  for (const t of db.transaksis) {
    const cur = totalByWarga.get(t.wargaId) || { total: 0, count: 0 };
    cur.total += t.jumlah;
    cur.count += 1;
    totalByWarga.set(t.wargaId, cur);
  }
  return list.slice(0, 50).map((w) => ({
    ...w,
    total: totalByWarga.get(w.id)?.total || 0,
    count: totalByWarga.get(w.id)?.count || 0,
  }));
}

export function addWarga(namaInput: string) {
  const nama = normalizeNama(namaInput || "");
  if (!nama) throw new Error("Nama wajib diisi");
  if (nama.length < 2) throw new Error("Nama minimal 2 huruf");
  const db = loadDB();
  const norm = nama.toLowerCase();
  const existing = db.wargas.find((w) => w.nama.toLowerCase() === norm);
  if (existing) return { data: existing, existed: true };
  const warga = { id: uid("w"), nama, createdAt: new Date().toISOString() };
  db.wargas.push(warga);
  saveDB(db);
  return { data: warga, existed: false };
}

export function deleteWarga(id: string) {
  const db = loadDB();
  db.wargas = db.wargas.filter((w) => w.id !== id);
  saveDB(db);
}

// ---------- transaksi masuk ----------
export function listTransaksi(opts: { q?: string; bulan?: string; wargaId?: string; tahun?: string; tempatId?: string; limit?: number } = {}) {
  const db = loadDB();
  let list = [...db.transaksis].sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt));
  const q = (opts.q || "").trim().toLowerCase();
  if (q) list = list.filter((t) => (t.nama + " " + (t.keterangan || "")).toLowerCase().includes(q));
  if (opts.bulan) list = list.filter((t) => t.bulan === opts.bulan);
  if (opts.wargaId) list = list.filter((t) => t.wargaId === opts.wargaId);
  if (opts.tahun) list = list.filter((t) => t.bulan.startsWith(opts.tahun!));
  if (opts.tempatId) list = list.filter((t) => t.tempatId === opts.tempatId);
  const limit = opts.limit ?? 200;
  return { data: list.slice(0, limit), total: list.length };
}

export function addTransaksi(input: { nama: string; jumlah: number; tanggal: string; bulan: string; keterangan?: string; tempatId?: string }) {
  const nama = normalizeNama(input.nama || "");
  const jumlah = Number(input.jumlah);
  const tanggal = input.tanggal;
  const bulan = input.bulan || (tanggal ? tanggal.slice(0, 7) : "");
  const keterangan = (input.keterangan || "").toString().slice(0, 200);
  if (!nama) throw new Error("Nama wajib diisi");
  if (!jumlah || jumlah <= 0) throw new Error("Jumlah harus > 0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error("Format tanggal YYYY-MM-DD");
  if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error("Format bulan YYYY-MM");

  const db = loadDB();
  let tempat = db.tempats.find((t) => t.id === input.tempatId);
  if (!tempat) {
    if (input.tempatId) throw new Error("Tempat penyimpanan tidak ditemukan");
    tempat = db.tempats[0];
  }
  if (!tempat) throw new Error("Belum ada tempat penyimpanan");

  let warga = db.wargas.find((w) => w.nama.toLowerCase() === nama.toLowerCase());
  let wargaBaru = false;
  if (!warga) {
    warga = { id: uid("w"), nama, createdAt: new Date().toISOString() };
    db.wargas.push(warga);
    wargaBaru = true;
  }
  const trx: Transaksi = {
    id: uid("t"),
    wargaId: warga.id,
    nama: warga.nama,
    jumlah: Math.round(jumlah),
    tanggal,
    bulan,
    keterangan,
    tempatId: tempat.id,
    tempatNama: tempat.nama,
    createdAt: new Date().toISOString(),
  };
  db.transaksis.push(trx);
  saveDB(db);
  return { data: trx, warga, wargaBaru };
}

export function deleteTransaksi(id: string) {
  const db = loadDB();
  db.transaksis = db.transaksis.filter((t) => t.id !== id);
  saveDB(db);
}

// ---------- pengeluaran ----------
export function listPengeluaran(opts: { q?: string; bulan?: string; tahun?: string; jenis?: string; wargaId?: string; tempatId?: string; limit?: number } = {}) {
  const db = loadDB();
  let list = [...db.pengeluarans].sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt));
  const q = (opts.q || "").trim().toLowerCase();
  if (q) list = list.filter((t) => (t.nama + " " + t.keterangan).toLowerCase().includes(q));
  if (opts.bulan) list = list.filter((t) => t.bulan === opts.bulan);
  if (opts.tahun) list = list.filter((t) => t.bulan.startsWith(opts.tahun!));
  if (opts.jenis) list = list.filter((t) => t.jenis === opts.jenis);
  if (opts.wargaId) list = list.filter((t) => t.wargaId === opts.wargaId);
  if (opts.tempatId) list = list.filter((t) => t.tempatId === opts.tempatId);
  const limit = opts.limit ?? 200;
  return { data: list.slice(0, limit), total: list.length };
}

function rupiahShort(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
}

export function addPengeluaran(input: { jenis: "belanja" | "penarikan"; nama: string; jumlah: number; tanggal: string; bulan: string; keterangan?: string; tempatId?: string }) {
  const jenis = input.jenis === "penarikan" ? "penarikan" : "belanja";
  const nama = normalizeNama(input.nama || "");
  const jumlah = Number(input.jumlah);
  const tanggal = input.tanggal;
  const bulan = input.bulan || (tanggal ? tanggal.slice(0, 7) : "");
  const keterangan = (input.keterangan || "").toString().slice(0, 200);
  if (!nama) throw new Error("Nama/keperluan wajib diisi");
  if (!jumlah || jumlah <= 0) throw new Error("Jumlah harus > 0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error("Format tanggal YYYY-MM-DD");
  if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error("Format bulan YYYY-MM");

  const db = loadDB();
  let tempat = db.tempats.find((t) => t.id === input.tempatId);
  if (!tempat) {
    if (input.tempatId) throw new Error("Tempat penyimpanan tidak ditemukan");
    tempat = db.tempats[0];
  }
  if (!tempat) throw new Error("Belum ada tempat penyimpanan");

  const s = saldoTempat(db, tempat.id);
  if (Math.round(jumlah) > s.saldo) throw new Error(`Saldo "${tempat.nama}" tidak cukup (sisa ${rupiahShort(s.saldo)})`);

  let wargaId: string | null = null;
  let namaFinal = nama;
  if (jenis === "penarikan") {
    const warga = db.wargas.find((w) => w.nama.toLowerCase() === nama.toLowerCase());
    if (warga) {
      wargaId = warga.id;
      namaFinal = warga.nama;
    }
  }
  const out: Pengeluaran = {
    id: uid("k"),
    jenis,
    wargaId,
    nama: namaFinal,
    jumlah: Math.round(jumlah),
    tanggal,
    bulan,
    keterangan,
    tempatId: tempat.id,
    tempatNama: tempat.nama,
    createdAt: new Date().toISOString(),
  };
  db.pengeluarans.push(out);
  saveDB(db);
  return { data: out };
}

export function deletePengeluaran(id: string) {
  const db = loadDB();
  db.pengeluarans = db.pengeluarans.filter((t) => t.id !== id);
  saveDB(db);
}

// ---------- tempat & transfer ----------
export function listTempat() {
  const db = loadDB();
  const data = db.tempats.map((t) => ({
    ...t,
    ...saldoTempat(db, t.id),
    trxMasuk: db.transaksis.filter((x) => x.tempatId === t.id).length,
    trxKeluar: db.pengeluarans.filter((x) => x.tempatId === t.id).length,
  }));
  const total = data.reduce((s, t) => s + t.saldo, 0);
  return { data, total };
}

export function addTempat(input: { nama: string; keterangan?: string; saldoAwal?: number; saldoAwalTanggal?: string }) {
  const nama = normalizeNama(input.nama || "");
  if (!nama || nama.length < 2) throw new Error("Nama tempat minimal 2 huruf");
  if (nama.length > 60) throw new Error("Nama tempat maksimal 60 huruf");
  const db = loadDB();
  if (db.tempats.some((t) => t.nama.toLowerCase() === nama.toLowerCase())) throw new Error(`Tempat "${nama}" sudah ada`);
  if (db.tempats.length >= 20) throw new Error("Maksimal 20 tempat penyimpanan");
  const tempat: Tempat = {
    id: uid("tmp"),
    nama,
    keterangan: String(input.keterangan || "").slice(0, 200),
    saldoAwal: Number(input.saldoAwal) > 0 ? Math.round(Number(input.saldoAwal)) : 0,
    saldoAwalKet: String(input.keterangan || "").slice(0, 200),
    saldoAwalTanggal: /^\d{4}-\d{2}-\d{2}$/.test(input.saldoAwalTanggal || "") ? input.saldoAwalTanggal! : "",
    createdAt: new Date().toISOString(),
  };
  db.tempats.push(tempat);
  saveDB(db);
  return { data: tempat };
}

export function updateTempat(id: string, input: { nama?: string; keterangan?: string; saldoAwal?: number }) {
  const db = loadDB();
  const t = db.tempats.find((x) => x.id === id);
  if (!t) throw new Error("Tempat tidak ditemukan");
  if (input.nama !== undefined) {
    const nama = normalizeNama(String(input.nama || ""));
    if (!nama || nama.length < 2) throw new Error("Nama minimal 2 huruf");
    if (db.tempats.some((x) => x.id !== id && x.nama.toLowerCase() === nama.toLowerCase())) throw new Error(`Nama "${nama}" sudah dipakai tempat lain`);
    t.nama = nama.slice(0, 60);
    for (const tr of db.transaksis) if (tr.tempatId === id) tr.tempatNama = t.nama;
    for (const tr of db.pengeluarans) if (tr.tempatId === id) tr.tempatNama = t.nama;
    for (const tr of db.transfers) {
      if (tr.dariId === id) tr.dariNama = t.nama;
      if (tr.keId === id) tr.keNama = t.nama;
    }
  }
  if (input.keterangan !== undefined) t.keterangan = String(input.keterangan || "").slice(0, 200);
  if (input.saldoAwal !== undefined) {
    const n = Number(input.saldoAwal);
    if (!Number.isFinite(n) || n < 0) throw new Error("Saldo awal harus angka ≥ 0");
    t.saldoAwal = Math.round(n);
  }
  saveDB(db);
  return { data: t };
}

export function deleteTempat(id: string) {
  const db = loadDB();
  if (db.tempats.length <= 1) throw new Error("Minimal harus ada 1 tempat. Tidak bisa hapus yang terakhir.");
  const t = db.tempats.find((x) => x.id === id);
  if (!t) throw new Error("Tempat tidak ditemukan");
  const dipakaiMasuk = db.transaksis.filter((x) => x.tempatId === id).length;
  const dipakaiKeluar = db.pengeluarans.filter((x) => x.tempatId === id).length;
  const dipakaiTransfer = db.transfers.filter((x) => x.dariId === id || x.keId === id).length;
  const s = saldoTempat(db, id);
  if (dipakaiMasuk + dipakaiKeluar + dipakaiTransfer > 0 || s.saldo !== 0 || s.saldoAwal !== 0) {
    throw new Error(`"${t.nama}" masih dipakai (${dipakaiMasuk} masuk, ${dipakaiKeluar} keluar, ${dipakaiTransfer} transfer, saldo ${rupiahShort(s.saldo)}). Pindahkan dulu saldonya via Transfer lalu hapus riwayatnya, atau kosongkan saldo awal menjadi 0.`);
  }
  db.tempats = db.tempats.filter((x) => x.id !== id);
  saveDB(db);
}

export function listTransfer(limit = 50) {
  const db = loadDB();
  const list = [...db.transfers].sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt)).slice(0, limit);
  return { data: list, total: db.transfers.length };
}

export function addTransfer(input: { dariId: string; keId: string; jumlah: number; tanggal: string; keterangan?: string }) {
  const dariId = String(input.dariId || "");
  const keId = String(input.keId || "");
  const jumlah = Number(input.jumlah);
  const tanggal = input.tanggal;
  const bulan = tanggal ? tanggal.slice(0, 7) : "";
  const keterangan = String(input.keterangan || "").slice(0, 200);
  if (!dariId || !keId) throw new Error("Tempat asal & tujuan wajib dipilih");
  if (dariId === keId) throw new Error("Tempat asal & tujuan tidak boleh sama");
  if (!jumlah || jumlah <= 0) throw new Error("Jumlah harus > 0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error("Format tanggal YYYY-MM-DD");
  if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error("Format bulan YYYY-MM");
  const db = loadDB();
  const dari = db.tempats.find((t) => t.id === dariId);
  const ke = db.tempats.find((t) => t.id === keId);
  if (!dari || !ke) throw new Error("Tempat tidak ditemukan");
  const s = saldoTempat(db, dariId);
  if (Math.round(jumlah) > s.saldo) throw new Error(`Saldo "${dari.nama}" tidak cukup (sisa ${rupiahShort(s.saldo)})`);
  const tr: Transfer = {
    id: uid("m"),
    dariId,
    keId,
    dariNama: dari.nama,
    keNama: ke.nama,
    jumlah: Math.round(jumlah),
    tanggal,
    bulan,
    keterangan,
    createdAt: new Date().toISOString(),
  };
  db.transfers.push(tr);
  saveDB(db);
  return { data: tr };
}

export function deleteTransfer(id: string) {
  const db = loadDB();
  db.transfers = db.transfers.filter((t) => t.id !== id);
  saveDB(db);
}

// ---------- backup / restore (murni lokal, tanpa server -> jalan di Vercel) ----------
export function exportData() {
  const db = loadDB();
  return { exportedAt: new Date().toISOString(), app: "koley", ...db };
}

export function importData(body: any) {
  if (!body || typeof body !== "object") throw new Error("File tidak valid (bukan JSON object)");
  const cleanStr = (v: any, max = 200) => String(v ?? "").slice(0, max);
  const cleanNum = (v: any) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);

  if (!Array.isArray(body.wargas)) throw new Error("Field 'wargas' tidak ditemukan");
  const wargas = body.wargas
    .filter((w: any) => w && typeof w.nama === "string" && w.nama.trim().length >= 2)
    .slice(0, 10000)
    .map((w: any) => ({
      id: typeof w.id === "string" && w.id ? w.id : `w_imp_${Math.random().toString(36).slice(2, 9)}`,
      nama: w.nama.trim().replace(/\s+/g, " ").slice(0, 100),
      createdAt: typeof w.createdAt === "string" ? w.createdAt : new Date().toISOString(),
    }));

  let tempats: any[] = [];
  if (Array.isArray(body.tempats) && body.tempats.length > 0) {
    tempats = body.tempats
      .filter((t: any) => t && typeof t.nama === "string" && t.nama.trim().length >= 2)
      .slice(0, 20)
      .map((t: any) => ({
        id: typeof t.id === "string" && t.id ? t.id : `tmp_imp_${Math.random().toString(36).slice(2, 9)}`,
        nama: t.nama.trim().replace(/\s+/g, " ").slice(0, 60),
        keterangan: cleanStr(t.keterangan),
        saldoAwal: cleanNum(t.saldoAwal),
        saldoAwalKet: cleanStr(t.saldoAwalKet),
        saldoAwalTanggal: /^\d{4}-\d{2}-\d{2}$/.test(t.saldoAwalTanggal || "") ? t.saldoAwalTanggal : "",
        createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
      }));
  }
  if (tempats.length === 0) {
    tempats = [
      {
        id: `tmp_imp_${Math.random().toString(36).slice(2, 9)}`,
        nama: "Kas Tunai",
        keterangan: "",
        saldoAwal: cleanNum(body.saldoAwal),
        saldoAwalKet: cleanStr(body.saldoAwalKet),
        saldoAwalTanggal: typeof body.saldoAwalTanggal === "string" ? body.saldoAwalTanggal : "",
        createdAt: new Date().toISOString(),
      },
    ];
  }
  const tempatIds = new Set(tempats.map((t) => t.id));
  const namaById = new Map(tempats.map((t) => [t.id, t.nama]));
  const defTempatId: string = tempats[0].id;
  const resolveTempat = (v: any) => {
    if (typeof v === "string" && tempatIds.has(v)) return { id: v, nama: namaById.get(v) || "" };
    return { id: defTempatId, nama: namaById.get(defTempatId) || "Kas Tunai" };
  };

  if (!Array.isArray(body.transaksis)) throw new Error("Field 'transaksis' tidak ditemukan");
  const transaksis = body.transaksis
    .filter((t: any) => t && typeof t.nama === "string" && cleanNum(t.jumlah) > 0)
    .slice(0, 50000)
    .map((t: any) => {
      const tp = resolveTempat(t.tempatId);
      return {
        id: typeof t.id === "string" && t.id ? t.id : `t_imp_${Math.random().toString(36).slice(2, 9)}`,
        wargaId: typeof t.wargaId === "string" ? t.wargaId : "",
        nama: cleanStr(t.nama, 100),
        jumlah: cleanNum(t.jumlah),
        tanggal: /^\d{4}-\d{2}-\d{2}$/.test(t.tanggal || "") ? t.tanggal : "2000-01-01",
        bulan: /^\d{4}-\d{2}$/.test(t.bulan || "") ? t.bulan : String(t.tanggal || "").slice(0, 7) || "2000-01",
        keterangan: cleanStr(t.keterangan),
        tempatId: tp.id,
        tempatNama: typeof t.tempatNama === "string" && t.tempatNama ? cleanStr(t.tempatNama, 60) : tp.nama,
        createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
      };
    });

  const pengeluarans = Array.isArray(body.pengeluarans)
    ? body.pengeluarans
        .filter((t: any) => t && typeof t.nama === "string" && cleanNum(t.jumlah) > 0)
        .slice(0, 50000)
        .map((t: any) => {
          const tp = resolveTempat(t.tempatId);
          return {
            id: typeof t.id === "string" && t.id ? t.id : `k_imp_${Math.random().toString(36).slice(2, 9)}`,
            jenis: t.jenis === "penarikan" ? ("penarikan" as const) : ("belanja" as const),
            wargaId: typeof t.wargaId === "string" && t.wargaId ? t.wargaId : null,
            nama: cleanStr(t.nama, 100),
            jumlah: cleanNum(t.jumlah),
            tanggal: /^\d{4}-\d{2}-\d{2}$/.test(t.tanggal || "") ? t.tanggal : "2000-01-01",
            bulan: /^\d{4}-\d{2}$/.test(t.bulan || "") ? t.bulan : String(t.tanggal || "").slice(0, 7) || "2000-01",
            keterangan: cleanStr(t.keterangan),
            tempatId: tp.id,
            tempatNama: typeof t.tempatNama === "string" && t.tempatNama ? cleanStr(t.tempatNama, 60) : tp.nama,
            createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
          };
        })
    : [];

  const transfers = Array.isArray(body.transfers)
    ? body.transfers
        .filter((t: any) => t && typeof t.dariId === "string" && typeof t.keId === "string" && cleanNum(t.jumlah) > 0)
        .slice(0, 10000)
        .map((t: any) => ({
          id: typeof t.id === "string" && t.id ? t.id : `m_imp_${Math.random().toString(36).slice(2, 9)}`,
          dariId: tempatIds.has(t.dariId) ? t.dariId : defTempatId,
          keId: tempatIds.has(t.keId) ? t.keId : defTempatId,
          dariNama: cleanStr(t.dariNama, 60) || namaById.get(t.dariId) || "",
          keNama: cleanStr(t.keNama, 60) || namaById.get(t.keId) || "",
          jumlah: cleanNum(t.jumlah),
          tanggal: /^\d{4}-\d{2}-\d{2}$/.test(t.tanggal || "") ? t.tanggal : "2000-01-01",
          bulan: /^\d{4}-\d{2}$/.test(t.bulan || "") ? t.bulan : String(t.tanggal || "").slice(0, 7) || "2000-01",
          keterangan: cleanStr(t.keterangan),
          createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
        }))
        .filter((t: any) => t.dariId !== t.keId)
    : [];

  const db: DBShape = {
    wargas,
    transaksis,
    pengeluarans,
    tempats,
    transfers,
    saldoAwal: tempats.reduce((s: number, t: any) => s + (t.saldoAwal || 0), 0),
    saldoAwalKet: "",
    saldoAwalTanggal: tempats[0]?.saldoAwalTanggal || "",
  };
  saveDB(db);
  void todayBulan;
  return { wargas: wargas.length, transaksis: transaksis.length, pengeluarans: pengeluarans.length, tempats: tempats.length, transfers: transfers.length };
}
