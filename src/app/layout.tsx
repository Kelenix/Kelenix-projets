import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import { BRAND, BRAND_FULL_NAME } from "@/lib/brand"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })

export const metadata: Metadata = {
  title: `${BRAND_FULL_NAME} — ${BRAND.tagline}`,
  description: "Gestion de projets pour freelances et petites équipes.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: "#f6f7fb" }

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
