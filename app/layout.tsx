import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Zeno - AI Email Agent",
  description: "Your AI-powered email assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Background ribbon decoration */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-[0.03]">
          <img
            src="/ribbon.svg"
            alt=""
            className="absolute -right-1/4 top-1/4 w-[150%] max-w-none"
            aria-hidden="true"
          />
        </div>
        {children}
      </body>
    </html>
  );
}
