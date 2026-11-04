import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { connection } from "next/server"
import { Toaster } from "sonner"
import { BRAND, BRAND_FULL_NAME } from "@/lib/brand"
import { serverConfig } from "@/lib/supabase/config"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })

export const metadata: Metadata = {
  title: `${BRAND_FULL_NAME} — ${BRAND.tagline}`,
  description: "Gestion de projets pour freelances et petites équipes.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: "#f6f7fb" }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lue à chaque requête : la clé publique dépend de l'environnement (préproduction, production).
  await connection()
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="supabase-anon-key" content={serverConfig().anonKey} />
        {/* Thème choisi appliqué avant l'affichage (évite un éclair de clair en mode sombre). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("kelenix-theme");if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
