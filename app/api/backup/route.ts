import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readDB, writeDB } from "@/lib/db";

// GET /api/backup -> unduh seluruh database sebagai JSON
export async function GET() {
  const db = readDB();
  return NextResponse.json(
    { exportedAt: new Date().toISOString(), app: "koley", ...db },
    {
      headers: {
        "Content-Disposition": `attachment; filename="koley-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    }
  );
}

// POST /api/backup { wargas, transaksis, pengeluarans?, tempats?, transfers? } -> ganti database (restore)
// Data lama otomatis disimpan sebagai file backup bertanggal sebelum diganti.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "File tidak valid (bukan JSON object)" }, { status: 400 });
  }

  const cleanStr = (v: any, max = 200) => String(v ?? "").slice(0, max);
  const cleanNum = (v: any) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);

  // --- validasi & sanitasi warga ---
  if (!Array.isArray(body.wargas)) return NextResponse.json({ error: "Field 'wargas' tidak ditemukan" }, { status: 400 });
  const wargas = body.wargas
    .filter((w: any) => w && typeof w.nama === "string" && w.nama.trim().length >= 2)
    .slice(0, 10000)
    .map((w: any) => ({
      id: typeof w.id === "string" && w.id ? w.id : `w_imp_${Math.random().toString(36).slice(2, 9)}`,
      nama: w.nama.trim().replace(/\s+/g, " ").slice(0, 100),
      createdAt: typeof w.createdAt === "string" ? w.createdAt : new Date().toISOString(),
    }));

  // --- tempats (opsional untuk file lama): bila kosong, buat default + migrasi saldoAwal lama ---
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

  // --- validasi & sanitasi transaksi masuk ---
  if (!Array.isArray(body.transaksis)) return NextResponse.json({ error: "Field 'transaksis' tidak ditemukan" }, { status: 400 });
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

  // --- validasi & sanitasi pengeluaran (opsional, untuk file lama) ---
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

  // --- transfers (opsional) ---
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

  // simpan salinan data lama sebelum diganti (pengaman)
  try {
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    fs.writeFileSync(path.join(dir, `koley-backup-otomatis-${stamp}.json`), JSON.stringify(readDB(), null, 2));
  } catch {
    /* pengaman backup gagal bukan alasan batal restore */
  }

  writeDB({
    wargas,
    transaksis,
    pengeluarans,
    tempats,
    transfers,
    saldoAwal: tempats.reduce((s: number, t: any) => s + (t.saldoAwal || 0), 0),
    saldoAwalKet: "",
    saldoAwalTanggal: tempats[0]?.saldoAwalTanggal || "",
  });

  return NextResponse.json({
    ok: true,
    imported: {
      wargas: wargas.length,
      transaksis: transaksis.length,
      pengeluarans: pengeluarans.length,
      tempats: tempats.length,
      transfers: transfers.length,
    },
  });
}
