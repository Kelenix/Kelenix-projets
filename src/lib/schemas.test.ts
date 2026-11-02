import { describe, expect, it } from "vitest"
import { clientSchema, fieldErrors, linkSchema, loginSchema, memberSchema, taskSchema } from "./schemas"

const baseTask = {
  title: "Tâche",
  description: "",
  status: "todo",
  priority: "normal",
  assignee_id: "",
  due_date: "",
  is_blocked: false,
  blocked_reason: "",
}

describe("schémas de validation", () => {
  it("connexion : e-mail et mot de passe requis", () => {
    const result = loginSchema.safeParse({ email: "", password: "" })
    expect(result.success).toBe(false)
    expect(fieldErrors(result.error!)).toEqual({ email: "Saisissez votre e-mail.", password: "Saisissez votre mot de passe." })
  })

  it("client : seul le nom est obligatoire, champs vides → null", () => {
    expect(clientSchema.parse({ name: " Julie ", company: "", email: "", notes: "" })).toEqual({
      name: "Julie",
      company: null,
      email: null,
      notes: null,
    })
    expect(clientSchema.safeParse({ name: "J", company: "", email: "pas-un-email", notes: "" }).success).toBe(false)
  })

  it("tâche : titre obligatoire, « À assigner » → null", () => {
    expect(taskSchema.safeParse({ ...baseTask, title: "  " }).success).toBe(false)
    expect(taskSchema.parse(baseTask)).toMatchObject({ assignee_id: null, due_date: null })
  })

  it("tâche bloquée : explication obligatoire", () => {
    const result = taskSchema.safeParse({ ...baseTask, is_blocked: true })
    expect(fieldErrors(result.error!)).toEqual({ blocked_reason: "Expliquez ce qui bloque la tâche." })
    expect(taskSchema.safeParse({ ...baseTask, is_blocked: true, blocked_reason: "Accès manquant" }).success).toBe(true)
  })

  it("lien : http(s) uniquement", () => {
    expect(linkSchema.safeParse({ label: "", url: "javascript:alert(1)" }).success).toBe(false)
    expect(linkSchema.safeParse({ label: "", url: "https://exemple.com/doc" }).success).toBe(true)
  })

  it("membre : mot de passe provisoire de 8 caractères minimum", () => {
    const member = { full_name: "Sam", email: "SAM@Exemple.com", password: "court", role: "collaborator" }
    expect(memberSchema.safeParse(member).success).toBe(false)
    expect(memberSchema.parse({ ...member, password: "assez-long" }).email).toBe("sam@exemple.com")
  })
})
