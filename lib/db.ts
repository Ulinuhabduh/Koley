import fs from "fs";
import path from "path";

export type Warga = {
  id: string;
  nama: string;
  createdAt: string;
};

// Tempat penyimpanan saldo (dompet): Kas Tunai, Bank, E-Wallet, dll.
export type Tempat = {
  id: string;
  nama: string;
  keterangan: string;
  saldoAwal: number;
  saldoAwalKet: string;
  saldoAwalTanggal: string; // YYYY-MM-DD
  createdAt: string;
};

// Mutasi / pindah saldo antar tempat
export type Transfer = {
  id: string;
  dariId: string;
  keId: string;
  dariNama: string;
  keNama: string;
  jumlah: number;
  tanggal: string; // YYYY-MM-DD
  bulan: string; // YYYY-MM
  keterangan: string;
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
  tempatId: string; // tempat penyimpanan tujuan
  tempatNama: string; // denormalisasi
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
  tempatId: string; // sumber dana
  tempatNama: string; // denormalisasi
  createdAt: string;
};

type DBShape = {
  wargas: Warga[];
  transaksis: Transaksi[];
  pengeluarans: Pengeluaran[];
  tempats: Tempat[];
  transfers: Transfer[];
  // Legacy (tetap disimpan agar backup lama terbaca; sumber utama kini tempats[].saldoAwal)
  saldoAwal: number;
  saldoAwalKet: string;
  saldoAwalTanggal: string; // YYYY-MM-DD
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "koley.json");

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

function ensureDB(): DBShape {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const defTempat: Tempat = {
      id: uid("tmp"),
      nama: "Kas Tunai",
      keterangan: "Uang tunai di tangan bendahara",
      saldoAwal: 0,
      saldoAwalKet: "",
      saldoAwalTanggal: "",
      createdAt: new Date().toISOString(),
    };
    const init: DBShape = {
      wargas: [],
      transaksis: [],
      pengeluarans: [],
      tempats: [defTempat],
      transfers: [],
      saldoAwal: 0,
      saldoAwalKet: "",
      saldoAwalTanggal: "",
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);

    const wargas: Warga[] = Array.isArray(parsed.wargas) ? parsed.wargas : [];
    const transfers: Transfer[] = Array.isArray(parsed.transfers)
      ? parsed.transfers.filter(
          (t: any) => t && typeof t.dariId === "string" && typeof t.keId === "string" && Number(t.jumlah) > 0
        )
      : [];

    // --- tempats: migrasi dari saldoAwal tunggal bila belum ada ---
    let tempats: Tempat[] = Array.isArray(parsed.tempats)
      ? parsed.tempats.map(cleanTempat).filter((t: Tempat | null): t is Tempat => !!t)
      : [];
    let perluTulis = false;
    if (tempats.length === 0) {
      const legacyAwal = Number(parsed.saldoAwal) > 0 ? Math.round(Number(parsed.saldoAwal)) : 0;
      tempats = [
        {
          id: uid("tmp"),
          nama: "Kas Tunai",
          keterangan: "Uang tunai di tangan bendahara",
          saldoAwal: legacyAwal,
          saldoAwalKet: typeof parsed.saldoAwalKet === "string" ? parsed.saldoAwalKet.slice(0, 200) : "",
          saldoAwalTanggal: typeof parsed.saldoAwalTanggal === "string" ? parsed.saldoAwalTanggal : "",
          createdAt: new Date().toISOString(),
        },
      ];
      perluTulis = true;
    }

    const tempatById = new Map(tempats.map((t) => [t.id, t]));
    const defId = tempats[0].id;

    // --- transaksis: pastikan ada tempatId ---
    const transaksis: Transaksi[] = Array.isArray(parsed.transaksis) ? parsed.transaksis : [];
    for (const t of transaksis) {
      if (!t.tempatId || !tempatById.has(t.tempatId)) {
        t.tempatId = defId;
        perluTulis = true;
      }
      const tp = tempatById.get(t.tempatId);
      if (!t.tempatNama && tp) {
        t.tempatNama = tp.nama;
        perluTulis = true;
      } else if (tp && t.tempatNama !== tp.nama) {
        // sinkronkan nama bila tempat diganti namanya (ringan, tidak wajib tulis tiap baca)
        t.tempatNama = tp.nama;
      }
    }

    // --- pengeluarans: pastikan ada tempatId ---
    const pengeluarans: Pengeluaran[] = Array.isArray(parsed.pengeluarans) ? parsed.pengeluarans : [];
    for (const t of pengeluarans) {
      if (!t.tempatId || !tempatById.has(t.tempatId)) {
        t.tempatId = defId;
        perluTulis = true;
      }
      const tp = tempatById.get(t.tempatId);
      if (!t.tempatNama && tp) {
        t.tempatNama = tp.nama;
        perluTulis = true;
      } else if (tp && t.tempatNama !== tp.nama) {
        t.tempatNama = tp.nama;
      }
    }

    const totalAwal = tempats.reduce((s, t) => s + (t.saldoAwal || 0), 0);

    const db: DBShape = {
      wargas,
      transaksis,
      pengeluarans,
      tempats,
      transfers,
      saldoAwal: totalAwal,
      saldoAwalKet: "",
      saldoAwalTanggal: tempats[0]?.saldoAwalTanggal || "",
    };

    if (perluTulis) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
      } catch {
        /* abaikan */
      }
    }
    return db;
  } catch {
    const defTempat: Tempat = {
      id: uid("tmp"),
      nama: "Kas Tunai",
      keterangan: "",
      saldoAwal: 0,
      saldoAwalKet: "",
      saldoAwalTanggal: "",
      createdAt: new Date().toISOString(),
    };
    return {
      wargas: [],
      transaksis: [],
      pengeluarans: [],
      tempats: [defTempat],
      transfers: [],
      saldoAwal: 0,
      saldoAwalKet: "",
      saldoAwalTanggal: "",
    };
  }
}

export function readDB(): DBShape {
  return ensureDB();
}

export function writeDB(db: DBShape) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // jaga agar minimal selalu ada 1 tempat
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
  // sinkronkan field legacy = total saldo awal semua tempat (untuk kompatibilitas backup lama)
  db.saldoAwal = db.tempats.reduce((s, t) => s + (Number(t.saldoAwal) || 0), 0);
  // tulis atomik: simpan ke file sementara dulu, baru rename.
  // Mencegah koley.json rusak bila proses terputus / disk penuh di tengah penulisan.
  const tmpFile = `${DB_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  try {
    fs.renameSync(tmpFile, DB_FILE);
  } catch {
    // rename gagal (mis. beda filesystem) -> fallback tulis langsung
    fs.writeFileSync(DB_FILE, fs.readFileSync(tmpFile));
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* abaikan */
    }
  }
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

// Hitung saldo satu tempat: awal + masuk - keluar + transfer masuk - transfer keluar
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
