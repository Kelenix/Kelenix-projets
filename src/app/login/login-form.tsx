"use client"

import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/field"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/queries"
import { fieldErrors, loginSchema } from "@/lib/schemas"
import { getSupabase } from "@/lib/supabase/client"

export function LoginForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))

    setErrors({})
    setPending(true)
    const { error } = await getSupabase().auth.signInWithPassword(parsed.data)
    if (error) {
      setPending(false)
      return setErrors({
        form:
          error.code === "invalid_credentials"
            ? "E-mail ou mot de passe incorrect."
            : error.status === 429
              ? "Trop de tentatives. Patientez quelques instants."
              : errorMessage(error),
      })
    }
    router.replace("/")
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.form && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <Field label="E-mail" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" autoFocus placeholder="vous@exemple.com" />
      </Field>
      <Field label="Mot de passe" error={errors.password}>
        <div className="relative">
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  )
}
