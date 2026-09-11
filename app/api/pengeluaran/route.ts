import { NextResponse } from "next/server";
import { findWargaByNama, normalizeNama, readDB, uid, writeDB } from "@/lib/db";
import { todayISO } from "@/lib/format";

// GET /api/pengeluaran?q=&bulan=YYYY-MM&tahun=YYYY&jenis=belanja|penarikan&wargaId=&limit=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const bulan = (searchParams.get("bulan") || "").trim();
  const tahun = (searchParams.get("tahun") || "").trim();
  const jenis = (searchParams.get("jenis") || "").trim();
  const wargaId = (searchParams.get("wargaId") || "").trim();
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  const db = readDB();
  let list = [...db.pengeluarans].sort((a, b) =>
    (b.tanggal + b.createdAt).localeCompare(a.tanggal + a.createdAt)
  );
  if (q) list = list.filter((t) => (t.nama + " " + t.keterangan).toLowerCase().includes(q));
  if (bulan) list = list.filter((t) => t.bulan === bulan);
  if (tahun) list = list.filter((t) => t.bulan.startsWith(tahun));
  if (jenis) list = list.filter((t) => t.jenis === jenis);
  if (wargaId) list = list.filter((t) => t.wargaId === wargaId);

  return NextResponse.json({ data: list.slice(0, limit), total: list.length });
}

// POST /api/pengeluaran { jenis, nama, jumlah, tanggal, bulan, keterangan }
// - belanja: nama = penerima/toko (bebas, tidak wajib warga)
// - penarikan: nama = warga; jika cocok warga terdaftar, ditautkan (wargaId)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const jenis: "belanja" | "penarikan" = body.jenis === "penarikan" ? "penarikan" : "belanja";
  const nama = normalizeNama(body.nama || "");
  const jumlah = Number(body.jumlah);
  const tanggal: string = body.tanggal || todayISO();
  const bulan: string = body.bulan || tanggal.slice(0, 7);
  const keterangan: string = (body.keterangan || "").toString().slice(0, 200);

  if (!nama) return NextResponse.json({ error: "Nama/keperluan wajib diisi" }, { status: 400 });
  if (!jumlah || jumlah <= 0) return NextResponse.json({ error: "Jumlah harus > 0" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return NextResponse.json({ error: "Format tanggal YYYY-MM-DD" }, { status: 400 });
  if (!/^\d{4}-\d{2}$/.test(bulan)) return NextResponse.json({ error: "Format bulan YYYY-MM" }, { status: 400 });

  const db = readDB();

  // cegah saldo minus: total keluar tidak boleh melebihi saldo (awal + masuk)
  const saldoAwal = db.saldoAwal || 0;
  const totalMasuk = db.transaksis.reduce((s, t) => s + t.jumlah, 0);
  const totalKeluar = db.pengeluarans.reduce((s, t) => s + t.jumlah, 0);
  if (totalKeluar + Math.round(jumlah) > saldoAwal + totalMasuk) {
    return NextResponse.json(
      { error: `Saldo tidak cukup (sisa ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(saldoAwal + totalMasuk - totalKeluar)})` },
      { status: 400 }
    );
  }

  let wargaId: string | null = null;
  if (jenis === "penarikan") {
    const warga = findWargaByNama(db, nama);
    if (warga) wargaId = warga.id;
  }

  const out = {
    id: uid("k"),
    jenis,
    wargaId,
    nama: jenis === "penarikan" && wargaId ? findWargaByNama(db, nama)!.nama : nama,
    jumlah: Math.round(jumlah),
    tanggal,
    bulan,
    keterangan,
    createdAt: new Date().toISOString(),
  };
  db.pengeluarans.push(out);
  writeDB(db);

  return NextResponse.json({ data: out }, { status: 201 });
}

// DELETE /api/pengeluaran?id=xxx (koreksi salah input)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const db = readDB();
  db.pengeluarans = db.pengeluarans.filter((t) => t.id !== id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
