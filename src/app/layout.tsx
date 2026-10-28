import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comnois — Plataforma Inteligente de Conhecimento",
  description:
    "Biblioteca pessoal e colaborativa com captura assíncrona, pesquisa híbrida e assistente de IA com citações verificáveis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}

