import type { Metadata } from "next";
import { Noto_Serif_TC, Noto_Sans_TC, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const notoSerifTC = Noto_Serif_TC({ 
  subsets: ["latin"], 
  weight: ["400", "700", "900"],
  variable: "--font-noto-serif-tc"
});

const notoSansTC = Noto_Sans_TC({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-noto-sans-tc"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-jetbrains-mono"
});

export const metadata: Metadata = {
  title: "MaraMap // 運動地理日誌",
  description: "以配速書寫地理，用腳步丈量歲月。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${notoSerifTC.variable} ${notoSansTC.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-paper text-ink font-sans antialiased selection:bg-brand selection:text-white">
        {children}
      </body>
    </html>
  );
}
