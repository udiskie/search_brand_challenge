import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Footer } from "@/components/dashboard/Footer";
import "./globals.css";

// Named --font-sans (not --font-geist-sans) to match what globals.css's
// `@theme inline` block actually references -- the previous Geist setup
// used a mismatched variable name, so the theme's --font-sans token was
// silently undefined and the site fell back to the system font stack.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brand Visibility Audit",
  description: "SEO / GEO / AEO brand visibility dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Footer />
      </body>
    </html>
  );
}
