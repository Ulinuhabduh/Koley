import { NextResponse } from "next/server";
import { normalizeNama, readDB, saldoTempat, uid, writeDB } from "@/lib/db";

// GET /api/tempat -> daftar tempat + saldo masing-masing
export async function GET() {
  try {
    const db = readDB();
    const data = db.tempats.map((t) => ({
      ...t,
      ...saldoTempat(db, t.id),
      trxMasuk: db.transaksis.filter((x) => x.tempatId === t.id).length,
      trxKeluar: db.pengeluarans.filter((x) => x.tempatId === t.id).length,
    }));
    const total = data.reduce((s, t) => s + t.saldo, 0);
    return NextResponse.json({ data, total });
  } catch (err: any) {
    // Selalu balas JSON agar client tidak kena "Unexpected end of JSON input"
    return NextResponse.json({ error: `Gagal membaca tempat: ${err?.message || err}` }, { status: 500 });
  }
}

// POST /api/tempat { nama, keterangan?, saldoAwal?, saldoAwalKet?, saldoAwalTanggal? }
export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Body bukan JSON valid / kosong." }, { status: 400 });
    }
    const nama = normalizeNama(body.nama || "");
    if (!nama || nama.length < 2) return NextResponse.json({ error: "Nama tempat minimal 2 huruf" }, { status: 400 });
    if (nama.length > 60) return NextResponse.json({ error: "Nama tempat maksimal 60 huruf" }, { status: 400 });

    const db = readDB();
    if (db.tempats.some((t) => t.nama.toLowerCase() === nama.toLowerCase())) {
      return NextResponse.json({ error: `Tempat "${nama}" sudah ada` }, { status: 400 });
    }
    if (db.tempats.length >= 20) {
      return NextResponse.json({ error: "Maksimal 20 tempat penyimpanan" }, { status: 400 });
    }

    const saldoAwal = Number(body.saldoAwal) > 0 ? Math.round(Number(body.saldoAwal)) : 0;
    const tempat = {
      id: uid("tmp"),
      nama,
      keterangan: String(body.keterangan || "").slice(0, 200),
      saldoAwal,
      saldoAwalKet: String(body.saldoAwalKet || body.keterangan || "").slice(0, 200),
      saldoAwalTanggal: /^\d{4}-\d{2}-\d{2}$/.test(body.saldoAwalTanggal || "") ? body.saldoAwalTanggal : "",
      createdAt: new Date().toISOString(),
    };
    db.tempats.push(tempat);
    writeDB(db);
    return NextResponse.json({ data: tempat }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: `Gagal menambah tempat: ${err?.message || err}` }, { status: 500 });
  }
}

// PUT /api/tempat { id, nama?, keterangan?, saldoAwal?, saldoAwalKet?, saldoAwalTanggal? }
export async function PUT(req: Request) {
  try {
    let body: any = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "Body bukan JSON valid / kosong." }, { status: 400 });
    }
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

    const db = readDB();
    const t = db.tempats.find((x) => x.id === id);
    if (!t) return NextResponse.json({ error: "Tempat tidak ditemukan" }, { status: 404 });

    if (body.nama !== undefined) {
      const nama = normalizeNama(String(body.nama || ""));
      if (!nama || nama.length < 2) return NextResponse.json({ error: "Nama minimal 2 huruf" }, { status: 400 });
      if (db.tempats.some((x) => x.id !== id && x.nama.toLowerCase() === nama.toLowerCase())) {
        return NextResponse.json({ error: `Nama "${nama}" sudah dipakai tempat lain` }, { status: 400 });
      }
      t.nama = nama.slice(0, 60);
      // sinkronkan denormalisasi
      for (const tr of db.transaksis) if (tr.tempatId === id) tr.tempatNama = t.nama;
      for (const tr of db.pengeluarans) if (tr.tempatId === id) tr.tempatNama = t.nama;
      for (const tr of db.transfers) {
        if (tr.dariId === id) tr.dariNama = t.nama;
        if (tr.keId === id) tr.keNama = t.nama;
      }
    }
    if (body.keterangan !== undefined) t.keterangan = String(body.keterangan || "").slice(0, 200);
    if (body.saldoAwal !== undefined) {
      const n = Number(body.saldoAwal);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "Saldo awal harus angka ≥ 0" }, { status: 400 });
      t.saldoAwal = Math.round(n);
    }
    if (body.saldoAwalKet !== undefined) t.saldoAwalKet = String(body.saldoAwalKet || "").slice(0, 200);
    if (body.saldoAwalTanggal !== undefined) {
      t.saldoAwalTanggal = /^\d{4}-\d{2}-\d{2}$/.test(body.saldoAwalTanggal || "") ? body.saldoAwalTanggal : "";
    }

    writeDB(db);
    return NextResponse.json({ data: t });
  } catch (err: any) {
    return NextResponse.json({ error: `Gagal menyimpan tempat: ${err?.message || err}` }, { status: 500 });
  }
}

// DELETE /api/tempat?id=xxx
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

    const db = readDB();
    if (db.tempats.length <= 1) {
      return NextResponse.json({ error: "Minimal harus ada 1 tempat. Tidak bisa hapus yang terakhir." }, { status: 400 });
    }
    const t = db.tempats.find((x) => x.id === id);
    if (!t) return NextResponse.json({ error: "Tempat tidak ditemukan" }, { status: 404 });

    const dipakaiMasuk = db.transaksis.filter((x) => x.tempatId === id).length;
    const dipakaiKeluar = db.pengeluarans.filter((x) => x.tempatId === id).length;
    const dipakaiTransfer = db.transfers.filter((x) => x.dariId === id || x.keId === id).length;
    const s = saldoTempat(db, id);
    if (dipakaiMasuk + dipakaiKeluar + dipakaiTransfer > 0 || s.saldo !== 0 || s.saldoAwal !== 0) {
      return NextResponse.json(
        {
          error: `"${t.nama}" masih dipakai (${dipakaiMasuk} masuk, ${dipakaiKeluar} keluar, ${dipakaiTransfer} transfer, saldo ${s.saldo}). Pindahkan dulu saldonya via Transfer lalu hapus riwayatnya, atau kosongkan saldo awal menjadi 0.`,
        },
        { status: 400 }
      );
    }

    db.tempats = db.tempats.filter((x) => x.id !== id);
    writeDB(db);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: `Gagal menghapus tempat: ${err?.message || err}` }, { status: 500 });
  }
}
