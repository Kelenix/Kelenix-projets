import type { Metadata } from "next"
import { Logo } from "@/components/logo"
import { BRAND, BRAND_FULL_NAME } from "@/lib/brand"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: `Connexion — ${BRAND_FULL_NAME}` }

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo withName={false} size={56} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {BRAND.name} <span className="font-medium text-primary">{BRAND.suffix}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{BRAND.tagline}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
