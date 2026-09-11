import { NextResponse } from "next/server";
import { findWargaByNama, normalizeNama, readDB, uid, writeDB } from "@/lib/db";

// GET /api/warga?q=xxx -> list warga (untuk autocomplete)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const db = readDB();

  let list = [...db.wargas].sort((a, b) => a.nama.localeCompare(b.nama));
  if (q) list = list.filter((w) => w.nama.toLowerCase().includes(q));

  // hitung total per warga
  const totalByWarga = new Map<string, { total: number; count: number }>();
  for (const t of db.transaksis) {
    const cur = totalByWarga.get(t.wargaId) || { total: 0, count: 0 };
    cur.total += t.jumlah;
    cur.count += 1;
    totalByWarga.set(t.wargaId, cur);
  }

  return NextResponse.json({
    data: list.slice(0, 50).map((w) => ({
      ...w,
      ...totalByWarga.get(w.id),
      total: totalByWarga.get(w.id)?.total || 0,
      count: totalByWarga.get(w.id)?.count || 0,
    })),
  });
}

// POST /api/warga { nama } -> tambah warga (dicek duplikat case-insensitive)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const nama = normalizeNama(body.nama || "");
  if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  if (nama.length < 2) return NextResponse.json({ error: "Nama minimal 2 huruf" }, { status: 400 });

  const db = readDB();
  const existing = findWargaByNama(db, nama);
  if (existing) return NextResponse.json({ data: existing, existed: true });

  const warga = { id: uid("w"), nama, createdAt: new Date().toISOString() };
  db.wargas.push(warga);
  writeDB(db);
  return NextResponse.json({ data: warga, existed: false }, { status: 201 });
}

// DELETE /api/warga?id=xxx
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const db = readDB();
  db.wargas = db.wargas.filter((w) => w.id !== id);
  // transaksi tetap disimpan untuk jejak audit (tidak ikut terhapus)
  writeDB(db);
  return NextResponse.json({ ok: true });
}
