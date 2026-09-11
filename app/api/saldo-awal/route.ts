import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

// GET /api/saldo-awal -> baca saldo awal
export async function GET() {
  const db = readDB();
  return NextResponse.json({
    saldoAwal: db.saldoAwal || 0,
    keterangan: db.saldoAwalKet || "",
    tanggal: db.saldoAwalTanggal || "",
  });
}

// PUT /api/saldo-awal { jumlah, keterangan?, tanggal? } -> atur/ubah saldo awal
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const jumlah = Number(body.jumlah);
  if (!Number.isFinite(jumlah) || jumlah < 0) {
    return NextResponse.json({ error: "Saldo awal harus angka ≥ 0" }, { status: 400 });
  }
  const db = readDB();
  db.saldoAwal = Math.round(jumlah);
  db.saldoAwalKet = String(body.keterangan || "").slice(0, 200);
  db.saldoAwalTanggal = /^\d{4}-\d{2}-\d{2}$/.test(body.tanggal || "") ? body.tanggal : db.saldoAwalTanggal || "";
  writeDB(db);
  return NextResponse.json({ ok: true, saldoAwal: db.saldoAwal });
}
