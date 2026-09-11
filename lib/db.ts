import fs from "fs";
import path from "path";

export type Warga = {
  id: string;
  nama: string;
  createdAt: string;
};

export type Transaksi = {
  id: string;
  wargaId: string;
  nama: string; // denormalisasi agar rekap mudah
  jumlah: number;
  tanggal: string; // YYYY-MM-DD
  bulan: string; // YYYY-MM (periode iuran)
  keterangan: string;
  createdAt: string;
};

// Pengeluaran kas: belanja barang (operasional) atau penarikan oleh warga
export type Pengeluaran = {
  id: string;
  jenis: "belanja" | "penarikan"; // belanja = beli barang/keperluan, penarikan = warga ambil uang
  wargaId: string | null; // diisi jika penarikan oleh warga terdaftar
  nama: string; // nama warga (penarikan) atau nama penerima/toko (belanja)
  jumlah: number;
  tanggal: string; // YYYY-MM-DD
  bulan: string; // YYYY-MM
  keterangan: string;
  createdAt: string;
};

type DBShape = {
  wargas: Warga[];
  transaksis: Transaksi[];
  pengeluarans: Pengeluaran[];
  // Saldo kas yang sudah ada sebelum aplikasi dipakai
  saldoAwal: number;
  saldoAwalKet: string;
  saldoAwalTanggal: string; // YYYY-MM-DD
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "koley.json");

function ensureDB(): DBShape {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const init: DBShape = { wargas: [], transaksis: [], pengeluarans: [], saldoAwal: 0, saldoAwalKet: "", saldoAwalTanggal: "" };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      wargas: Array.isArray(parsed.wargas) ? parsed.wargas : [],
      transaksis: Array.isArray(parsed.transaksis) ? parsed.transaksis : [],
      pengeluarans: Array.isArray(parsed.pengeluarans) ? parsed.pengeluarans : [],
      saldoAwal: Number(parsed.saldoAwal) > 0 ? Math.round(Number(parsed.saldoAwal)) : 0,
      saldoAwalKet: typeof parsed.saldoAwalKet === "string" ? parsed.saldoAwalKet.slice(0, 200) : "",
      saldoAwalTanggal: typeof parsed.saldoAwalTanggal === "string" ? parsed.saldoAwalTanggal : "",
    };
  } catch {
    return { wargas: [], transaksis: [], pengeluarans: [], saldoAwal: 0, saldoAwalKet: "", saldoAwalTanggal: "" };
  }
}

export function readDB(): DBShape {
  return ensureDB();
}

export function writeDB(db: DBShape) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function normalizeNama(nama: string) {
  return nama.trim().replace(/\s+/g, " ");
}

export function findWargaByNama(db: DBShape, nama: string) {
  const norm = normalizeNama(nama).toLowerCase();
  return db.wargas.find((w) => w.nama.toLowerCase() === norm);
}
