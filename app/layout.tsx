import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "entre — gente, encontros e outras coisas",
  description: "Uma rede social brasileira para compartilhar textos, fotografias e vídeos, encontrar sua comunidade e manter boas conversas por perto.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
