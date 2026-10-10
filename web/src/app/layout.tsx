import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ContactModalProvider } from "@/context/ContactModalContext";
import AuthProvider from "@/components/AuthProvider";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Xenderia — Exact Financial Data, Instantly",
  description:
    "Natural language financial queries for fintech finance teams. Exact numbers very fast — no SQL, no dashboards, no guessing.",
  keywords: [
    "financial data",
    "natural language SQL",
    "fintech analytics",
    "AI finance queries",
    "Xenderia",
    "cache-first",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Xenderia — Exact Financial Data, Instantly",
    description:
      "Ask financial questions in plain English. Get exact SQL-backed answers very fast, not approximations.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${jetbrainsMono.variable} antialiased`}>
        <AuthProvider>
          <ContactModalProvider>
            {children}
          </ContactModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}