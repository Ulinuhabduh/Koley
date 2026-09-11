"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/input", label: "Input Iuran" },
  { href: "/keluar", label: "Kas Keluar" },
  { href: "/warga", label: "Data Warga" },
  { href: "/laporan", label: "Laporan" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 bg-emerald-800 text-white shadow no-print">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setOpen(false)}>
          <div className="w-9 h-9 shrink-0 rounded-xl bg-white text-emerald-800 grid place-items-center font-black text-lg">
            K
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-none">Koley</p>
            <p className="text-[11px] text-emerald-200 leading-tight mt-0.5 whitespace-nowrap">
              Iuran Rutin Desa • Admin
            </p>
          </div>
        </Link>

        {/* Desktop */}
        <nav className="ml-auto hidden md:flex gap-1.5">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                  active
                    ? "bg-white text-emerald-800"
                    : "text-emerald-100 hover:bg-emerald-700"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Tombol hamburger (mobile) */}
        <button
          className="ml-auto md:hidden p-2 -mr-1 rounded-xl hover:bg-emerald-700 transition"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
        >
          {open ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          )}
        </button>
      </div>

      {/* Menu dropdown (mobile) */}
      {open && (
        <nav className="md:hidden border-t border-emerald-700 px-3 pt-2 pb-3 space-y-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? "bg-white text-emerald-800"
                    : "text-emerald-100 hover:bg-emerald-700"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
