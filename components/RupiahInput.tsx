"use client";

import { formatRibuan } from "@/lib/format";

type Props = {
  value: string; // angka mentah (hanya digit), "" bila kosong
  onChange: (digits: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
};

// Input uang dengan pemisah ribuan otomatis: user ketik 1500000 -> tampil 1.500.000
export default function RupiahInput({ value, onChange, className, placeholder, id, autoFocus }: Props) {
  const display = value ? formatRibuan(value) : "";
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        // ambil hanya digitnya, buang 0 di depan, maksimal 15 digit
        const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 15);
        onChange(digits);
      }}
    />
  );
}
