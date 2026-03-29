import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";
import TopNav from "@/components/layout/TopNav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "inthehole. | Score. Strategise & Plan. Get Coached.",
  description:
    "The free golf app built for South African golfers. Score Stableford & Stroke Play, get GPS distances, plan your round hole-by-hole, and get coached by AI — all in one place.",
  icons: {
    apple: "/images/logo6.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "inthehole",
  },
  openGraph: {
    title: "inthehole. | Score. Strategise & Plan. Get Coached.",
    description:
      "The free golf app built for South African golfers. Score Stableford & Stroke Play, get GPS distances, plan your round hole-by-hole, and get coached by AI — all in one place.",
    url: "https://inthehole.cleanharry.world",
    siteName: "inthehole.",
    images: [
      {
        url: "https://inthehole.cleanharry.world/images/og-share.png",
        width: 1200,
        height: 630,
        alt: "inthehole. SA Golf Scorecard App",
      },
    ],
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
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <TopNav />
          <main className="min-h-screen pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
