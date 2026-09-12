import { NextResponse } from "next/server";
import { readDB, saldoTempat, uid, writeDB } from "@/lib/db";
import { rupiah, todayISO } from "@/lib/format";

// GET /api/transfer?limit= -> riwayat pindah saldo antar tempat
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const db = readDB();
    const list = [...db.transfers]
      .sort((a, b) => (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt))
      .slice(0, limit);
    return NextResponse.json({ data: list, total: db.transfers.length });
  } catch (err: any) {
    return NextResponse.json({ error: `Gagal membaca transfer: ${err?.message || err}` }, { status: 500 });
  }
}

// POST /api/transfer { dariId, keId, jumlah, tanggal?, keterangan? }
export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Body bukan JSON valid / kosong." }, { status: 400 });
    }
  const dariId = String(body.dariId || "");
  const keId = String(body.keId || "");
  const jumlah = Number(body.jumlah);
  const tanggal: string = body.tanggal || todayISO();
  const bulan: string = body.bulan || tanggal.slice(0, 7);
  const keterangan = String(body.keterangan || "").slice(0, 200);

  if (!dariId || !keId) return NextResponse.json({ error: "Tempat asal & tujuan wajib dipilih" }, { status: 400 });
  if (dariId === keId) return NextResponse.json({ error: "Tempat asal & tujuan tidak boleh sama" }, { status: 400 });
  if (!jumlah || jumlah <= 0) return NextResponse.json({ error: "Jumlah harus > 0" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return NextResponse.json({ error: "Format tanggal YYYY-MM-DD" }, { status: 400 });
  if (!/^\d{4}-\d{2}$/.test(bulan)) return NextResponse.json({ error: "Format bulan YYYY-MM" }, { status: 400 });

  const db = readDB();
  const dari = db.tempats.find((t) => t.id === dariId);
  const ke = db.tempats.find((t) => t.id === keId);
  if (!dari || !ke) return NextResponse.json({ error: "Tempat tidak ditemukan" }, { status: 404 });

  const s = saldoTempat(db, dariId);
  if (Math.round(jumlah) > s.saldo) {
    return NextResponse.json({ error: `Saldo "${dari.nama}" tidak cukup (sisa ${rupiah(s.saldo)})` }, { status: 400 });
  }

  const tr = {
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
  writeDB(db);
  return NextResponse.json({ data: tr }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: `Gagal memindahkan saldo: ${err?.message || err}` }, { status: 500 });
  }
}

// DELETE /api/transfer?id=xxx
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
    const db = readDB();
    db.transfers = db.transfers.filter((t) => t.id !== id);
    writeDB(db);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: `Gagal menghapus transfer: ${err?.message || err}` }, { status: 500 });
  }
}
