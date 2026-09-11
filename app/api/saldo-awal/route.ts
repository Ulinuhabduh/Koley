import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

// GET /api/saldo-awal -> baca saldo awal (kompatibel lama: total semua tempat + rincian per tempat)
export async function GET() {
  const db = readDB();
  const total = db.tempats.reduce((s, t) => s + (t.saldoAwal || 0), 0);
  return NextResponse.json({
    saldoAwal: total,
    keterangan: "",
    tanggal: db.tempats[0]?.saldoAwalTanggal || "",
    tempats: db.tempats,
  });
}

// PUT /api/saldo-awal { jumlah, keterangan?, tanggal?, tempatId? }
// Bila tempatId diisi -> ubah saldo awal tempat itu. Bila tidak -> ubah tempat pertama (perilaku lama).
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const jumlah = Number(body.jumlah);
  if (!Number.isFinite(jumlah) || jumlah < 0) {
    return NextResponse.json({ error: "Saldo awal harus angka ≥ 0" }, { status: 400 });
  }
  const db = readDB();
  const target = db.tempats.find((t) => t.id === body.tempatId) || db.tempats[0];
  if (!target) return NextResponse.json({ error: "Belum ada tempat penyimpanan" }, { status: 400 });
  target.saldoAwal = Math.round(jumlah);
  if (body.keterangan !== undefined) target.saldoAwalKet = String(body.keterangan || "").slice(0, 200);
  if (body.tanggal !== undefined) {
    target.saldoAwalTanggal = /^\d{4}-\d{2}-\d{2}$/.test(body.tanggal || "") ? body.tanggal : target.saldoAwalTanggal || "";
  }
  writeDB(db);
  return NextResponse.json({ ok: true, saldoAwal: target.saldoAwal, tempatId: target.id });
}
