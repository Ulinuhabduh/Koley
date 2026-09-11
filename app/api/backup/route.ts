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

// POST /api/backup { wargas, transaksis, pengeluarans? } -> ganti database (restore)
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

  // --- validasi & sanitasi transaksi masuk ---
  if (!Array.isArray(body.transaksis)) return NextResponse.json({ error: "Field 'transaksis' tidak ditemukan" }, { status: 400 });
  const transaksis = body.transaksis
    .filter((t: any) => t && typeof t.nama === "string" && cleanNum(t.jumlah) > 0)
    .slice(0, 50000)
    .map((t: any) => ({
      id: typeof t.id === "string" && t.id ? t.id : `t_imp_${Math.random().toString(36).slice(2, 9)}`,
      wargaId: typeof t.wargaId === "string" ? t.wargaId : "",
      nama: cleanStr(t.nama, 100),
      jumlah: cleanNum(t.jumlah),
      tanggal: /^\d{4}-\d{2}-\d{2}$/.test(t.tanggal || "") ? t.tanggal : "2000-01-01",
      bulan: /^\d{4}-\d{2}$/.test(t.bulan || "") ? t.bulan : String(t.tanggal || "").slice(0, 7) || "2000-01",
      keterangan: cleanStr(t.keterangan),
      createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
    }));

  // --- validasi & sanitasi pengeluaran (opsional, untuk file lama) ---
  const pengeluarans = Array.isArray(body.pengeluarans)
    ? body.pengeluarans
        .filter((t: any) => t && typeof t.nama === "string" && cleanNum(t.jumlah) > 0)
        .slice(0, 50000)
        .map((t: any) => ({
          id: typeof t.id === "string" && t.id ? t.id : `k_imp_${Math.random().toString(36).slice(2, 9)}`,
          jenis: t.jenis === "penarikan" ? ("penarikan" as const) : ("belanja" as const),
          wargaId: typeof t.wargaId === "string" && t.wargaId ? t.wargaId : null,
          nama: cleanStr(t.nama, 100),
          jumlah: cleanNum(t.jumlah),
          tanggal: /^\d{4}-\d{2}-\d{2}$/.test(t.tanggal || "") ? t.tanggal : "2000-01-01",
          bulan: /^\d{4}-\d{2}$/.test(t.bulan || "") ? t.bulan : String(t.tanggal || "").slice(0, 7) || "2000-01",
          keterangan: cleanStr(t.keterangan),
          createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
        }))
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
    saldoAwal: Number(body.saldoAwal) > 0 ? Math.round(Number(body.saldoAwal)) : 0,
    saldoAwalKet: typeof body.saldoAwalKet === "string" ? body.saldoAwalKet.slice(0, 200) : "",
    saldoAwalTanggal: typeof body.saldoAwalTanggal === "string" ? body.saldoAwalTanggal : "",
  });

  return NextResponse.json({
    ok: true,
    imported: { wargas: wargas.length, transaksis: transaksis.length, pengeluarans: pengeluarans.length },
  });
}
