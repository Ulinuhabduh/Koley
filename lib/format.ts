export function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

export function todayISO(d = new Date()) {
  // waktu lokal (bukan UTC) agar tidak geser tanggal di WIB
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function currentBulan(d = new Date()) {
  return todayISO(d).slice(0, 7); // YYYY-MM
}

export function bulanKeyTahunBulan(year: number, monthIndex0: number) {
  // monthIndex0: 0=Jan ... 11=Des, waktu lokal
  return todayISO(new Date(year, monthIndex0, 1)).slice(0, 7);
}

export function bulanLabel(yyyyMM: string) {
  if (!yyyyMM || yyyyMM.length < 7) return yyyyMM;
  const [y, m] = yyyyMM.split("-");
  const names = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const idx = parseInt(m, 10) - 1;
  return `${names[idx] || m} ${y}`;
}

export function toCSV(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
