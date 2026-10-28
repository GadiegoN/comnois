import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "Comnois — Plataforma Inteligente de Conhecimento & RAG Verificável",
  description:
    "Biblioteca pessoal e colaborativa com captura assíncrona, pesquisa híbrida RRF, multi-tema e assistente de IA com citações verificáveis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <body className="min-h-screen bg-canvas text-fg antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
