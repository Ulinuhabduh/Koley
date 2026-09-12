// Helper fetch JSON yang aman.
// Penyebab error "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
// adalah client memanggil r.json() langsung padahal body respons kosong / bukan JSON
// (mis. server 500 tanpa body, dev server restart, proxy, disk penuh saat tulis file).
// Helper ini membaca sebagai text dulu lalu JSON.parse, sehingga pesan error
// yang ditampilkan ke user jelas (status + cuplikan body), bukan error cryptic.

export async function fetchJSON<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(input, init);
  } catch (err: any) {
    // Gagal jaringan / server mati / koneksi terputus
    throw new Error(`Tidak bisa menghubungi server (${err?.message || "jaringan terputus"}). Pastikan "npm run dev" masih jalan lalu coba lagi.`);
  }

  const text = await r.text().catch(() => "");

  if (!text) {
    throw new Error(
      r.ok
        ? "Server mengirim respons kosong. Kemungkinan server baru restart / menyimpan data gagal — tunggu sebentar lalu coba lagi."
        : `Server error tanpa pesan (status ${r.status}). Coba lagi, bila terus terjadi restart server ("npm run dev") lalu ulangi.`
    );
  }

  let j: any;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(
      r.ok
        ? `Server mengirim balasan bukan JSON (${text.slice(0, 120)}...). Coba refresh halaman lalu ulangi.`
        : `Server error ${r.status}: ${text.slice(0, 200)}`
    );
  }

  if (!r.ok) {
    throw new Error(j?.error || `Server menolak permintaan (status ${r.status}).`);
  }

  return j as T;
}
