import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="zh-TW">
      <body className="bg-paper text-ink font-sans antialiased selection:bg-brand selection:text-white">
        {children}
      </body>
    </html>
  );
}
