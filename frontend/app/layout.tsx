import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlowGenix — Hyperlocal Crowd Intelligence",
  description: "Real-time crowd density monitoring and traffic intelligence platform powered by anonymous GPS signals.",
  keywords: "crowd density, hyperlocal, traffic monitoring, GPS analytics, smart city",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
