import { NextResponse } from "next/server";
import { findWargaByNama, normalizeNama, readDB, uid, writeDB } from "@/lib/db";
import { todayISO } from "@/lib/format";

// GET /api/transaksi?q=&bulan=YYYY-MM&wargaId=&tahun=YYYY&limit=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const bulan = (searchParams.get("bulan") || "").trim();
  const wargaId = (searchParams.get("wargaId") || "").trim();
  const tahun = (searchParams.get("tahun") || "").trim();
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  const db = readDB();
  let list = [...db.transaksis].sort((a, b) =>
    (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt)
  );
  if (q) list = list.filter((t) => t.nama.toLowerCase().includes(q));
  if (bulan) list = list.filter((t) => t.bulan === bulan);
  if (wargaId) list = list.filter((t) => t.wargaId === wargaId);
  if (tahun) list = list.filter((t) => t.bulan.startsWith(tahun));

  return NextResponse.json({ data: list.slice(0, limit), total: list.length });
}

// POST /api/transaksi { nama, jumlah, tanggal, bulan, keterangan }
// Jika nama belum ada -> otomatis buat warga baru. Jika ada -> langsung pakai.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const nama = normalizeNama(body.nama || "");
  const jumlah = Number(body.jumlah);
  const tanggal: string = body.tanggal || todayISO();
  const bulan: string = body.bulan || tanggal.slice(0, 7);
  const keterangan: string = (body.keterangan || "").toString().slice(0, 200);

  if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  if (!jumlah || jumlah <= 0) return NextResponse.json({ error: "Jumlah harus > 0" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return NextResponse.json({ error: "Format tanggal YYYY-MM-DD" }, { status: 400 });
  if (!/^\d{4}-\d{2}$/.test(bulan)) return NextResponse.json({ error: "Format bulan YYYY-MM" }, { status: 400 });

  const db = readDB();
  let warga = findWargaByNama(db, nama);
  let wargaBaru = false;
  if (!warga) {
    warga = { id: uid("w"), nama, createdAt: new Date().toISOString() };
    db.wargas.push(warga);
    wargaBaru = true;
  }

  const trx = {
    id: uid("t"),
    wargaId: warga.id,
    nama: warga.nama,
    jumlah: Math.round(jumlah),
    tanggal,
    bulan,
    keterangan,
    createdAt: new Date().toISOString(),
  };
  db.transaksis.push(trx);
  writeDB(db);

  return NextResponse.json({ data: trx, warga, wargaBaru }, { status: 201 });
}

// DELETE /api/transaksi?id=xxx (koreksi salah input)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const db = readDB();
  db.transaksis = db.transaksis.filter((t) => t.id !== id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
