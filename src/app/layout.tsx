import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClearPath Review",
  description: "Compliance review for ClearPath Financial's marketing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TopBar />
        {children}
      </body>
    </html>
  );
}
