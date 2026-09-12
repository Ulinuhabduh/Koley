import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Koley",
  description: "Web pencatatan dana kolektif / iuran rutin warga desa. Admin saja.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 pb-16 pt-6">{children}</main>
        <footer className="text-center text-xs text-stone-400 pb-8 no-print">
          Koley • Iuran Rutin Desa • Data tersimpan di browser perangkat ini (otomatis, tetap ada walau offline)
          <br />
          <a href="/data" className="underline hover:text-emerald-700">
            ⬇ Backup & Restore Data (JSON)
          </a>
        </footer>
      </body>
    </html>
  );
}
