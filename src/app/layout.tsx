import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";
import "./animations.css";
import Providers from "./providers";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "QuantumnTrade",
    template: "%s — QuantumnTrade",
  },
  description:
    "Empowering Smarter Trades with AI, Quantum Speed, and LLM competition.",
  applicationName: "QuantumnTrade",
  keywords: [
    "QuantumnTrade",
    "AI trading",
    "LLM competition",
    "quantum speed",
    "GPT-5",
    "Claude Sonnet 4.5",
    "Grok 4",
    "Gemini 2.5 Pro",
    "Deepseek",
    "Qwen",
    "crypto",
    "Supabase",
    "dashboard",
  ],
  openGraph: {
    title:
      "QuantumnTrade — Empowering Smarter Trades with AI, Quantum Speed, and LLM competition",
    description:
      "Empowering Smarter Trades with AI, Quantum Speed, and LLM competition.",
    url: "/",
    siteName: "QuantumnTrade",
    images: [
      {
        url: "/images/Logo/QuantumnTrade_Logo.png",
        width: 1200,
        height: 630,
        alt: "QuantumnTrade Logo",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "QuantumnTrade — Empowering Smarter Trades with AI, Quantum Speed, and LLM competition",
    description:
      "Empowering Smarter Trades with AI, Quantum Speed, and LLM competition.",
    images: ["/images/Logo/QuantumnTrade_Logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: "/images/Logo/QuantumnTrade_Logo.png",
    shortcut: "/images/Logo/QuantumnTrade_Label_Logo.png",
  },
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-konnect antialiased" suppressHydrationWarning>
        <Providers>
          <NavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
