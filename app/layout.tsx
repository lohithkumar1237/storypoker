import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Story Poker",
  description: "Quick planning poker for small teams. No sign-up, rooms last two hours.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the fixed admin bar pad itself clear of the iPhone home indicator.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
        <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
