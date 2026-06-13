import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Референт-переводчик с ИИ-обработкой",
  description: "Референт-переводчик с ИИ-обработкой",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-zinc-100 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
