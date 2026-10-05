import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SYGOS 3.0",
  description: "ERP operativo de SYSTRON y Servomotores",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
