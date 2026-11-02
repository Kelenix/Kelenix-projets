import { redirect } from "next/navigation"
import { Dashboard } from "@/components/dashboard/dashboard"
import { getViewer } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const viewer = await getViewer()
  if (!viewer) redirect("/login")
  return <Dashboard viewer={viewer} />
}
