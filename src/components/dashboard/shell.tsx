"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  ChartColumn,
  FileSpreadsheet,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { initials, ROLE_LABELS } from "@/lib/domain"
import { useProfiles, useProjects } from "@/lib/queries"
import { getSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { ClientsSection } from "./clients"
import { MyTasksSection } from "./my-tasks"
import { OverviewSection } from "./overview"
import { ProjectsSection } from "./projects"
import { Search } from "./search"
import { ReportsSection } from "./reports"
import { StatisticsSection } from "./statistics"
import { useDashboard, type Section } from "./state"

const NAV: { section: Section; label: string; icon: LucideIcon }[] = [
  { section: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { section: "projects", label: "Projets", icon: FolderKanban },
  { section: "tasks", label: "Mes tâches", icon: CheckSquare },
  { section: "clients", label: "Clients", icon: Users },
  { section: "stats", label: "Statistiques", icon: ChartColumn },
  { section: "reports", label: "Rapports", icon: FileSpreadsheet },
]

export function Shell() {
  const { section } = useDashboard()
  const Content = {
    overview: OverviewSection,
    projects: ProjectsSection,
    tasks: MyTasksSection,
    clients: ClientsSection,
    stats: StatisticsSection,
    reports: ReportsSection,
  }[section]

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <Topbar />
        <main id="contenu" className="w-full flex-1 px-4 py-6 md:px-8">
          <Content />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}

const COLLAPSED_KEY = "kelenix:sidebar-collapsed"

/** Préférence locale (par navigateur) : barre latérale réduite aux icônes. */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try {
      // Lu après le montage : le rendu serveur ne connaît pas le stockage du navigateur.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1")
    } catch {}
  }, [])
  const toggle = () =>
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1")
      } catch {}
      return !value
    })
  return [collapsed, toggle] as const
}

function Sidebar() {
  const { section, navigate, openDialog, isOwner } = useDashboard()
  const [collapsed, toggle] = useCollapsed()
  const teamLabel = isOwner ? "Équipe et paramètres" : "Équipe"

  // En mode réduit, chaque bouton n'affiche que son icône ; le libellé passe en infobulle.
  const withTooltip = (label: string, element: React.ReactElement) =>
    collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{element}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      element
    )

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar py-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-16 px-2" : "w-60 px-3"
      )}
    >
      <div className={cn("flex items-center gap-2 pb-6", collapsed ? "flex-col" : "justify-between px-2")}>
        <Logo withName={!collapsed} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}
          aria-expanded={!collapsed}
          className="text-muted-foreground"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
      <nav aria-label="Navigation principale" className="flex flex-col gap-1">
        {NAV.map(({ section: target, label, icon: Icon }) => (
          <span key={target} className="contents">
            {withTooltip(
              label,
              <button
                type="button"
                onClick={() => navigate({ section: target, projectId: null, taskId: null })}
                aria-current={section === target ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  collapsed ? "justify-center px-0" : "px-3",
                  section === target && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {!collapsed && label}
              </button>
            )}
          </span>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t pt-3">
        {withTooltip(
          teamLabel,
          <Button
            variant="ghost"
            className={cn("gap-3", collapsed ? "justify-center px-0" : "justify-start px-3")}
            onClick={() => openDialog({ type: "team" })}
            aria-label={collapsed ? teamLabel : undefined}
          >
            <Settings aria-hidden />
            {!collapsed && teamLabel}
          </Button>
        )}
        <span className={cn(collapsed && "flex justify-center")}>
          <ProfileMenu compact={collapsed} />
        </span>
      </div>
    </aside>
  )
}

function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const { viewer: initialViewer, openDialog } = useDashboard()
  const { data: profiles } = useProfiles()
  const viewer = profiles?.find((p) => p.id === initialViewer.id) ?? initialViewer
  const queryClient = useQueryClient()
  const router = useRouter()

  async function signOut() {
    await getSupabase().auth.signOut()
    queryClient.clear()
    router.replace("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-auto justify-start gap-3 px-2 py-1.5", compact && "size-9 p-0")}
          aria-label="Profil et déconnexion"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-accent text-xs text-accent-foreground">{initials(viewer.full_name)}</AvatarFallback>
          </Avatar>
          {!compact && (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{viewer.full_name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABELS[viewer.role]}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} className="w-56">
        <DropdownMenuLabel className="truncate">{viewer.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openDialog({ type: "profile" })}>
          <UserRound /> Mon profil
        </DropdownMenuItem>
        {compact && (
          <DropdownMenuItem onSelect={() => openDialog({ type: "team" })}>
            <Settings /> Équipe et paramètres
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={signOut}>
          <LogOut /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Topbar() {
  const { section, projectId, isOwner, openDialog } = useDashboard()
  const { data: projects } = useProjects()
  const project = projects?.find((p) => p.id === projectId)
  const title = project?.name ?? NAV.find((n) => n.section === section)!.label

  const create =
    section === "stats" || section === "reports"
      ? null
      : section === "clients"
        ? isOwner && { label: "Nouveau client", onClick: () => openDialog({ type: "client" }) }
        : section === "projects" && !projectId
          ? isOwner && { label: "Nouveau projet", onClick: () => openDialog({ type: "project" }) }
          : { label: "Nouvelle tâche", onClick: () => openDialog({ type: "task", projectId: projectId ?? undefined }) }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0 md:px-8">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
        <div className="order-last w-full sm:order-none sm:w-80 lg:w-[28rem] xl:w-[32rem]">
          <Search />
        </div>
        {create && (
          <Button onClick={create.onClick} aria-label={create.label}>
            <Plus aria-hidden />
            <span className="hidden sm:inline">{create.label}</span>
          </Button>
        )}
        <span className="md:hidden">
          <ProfileMenu compact />
        </span>
      </div>
    </header>
  )
}

function MobileNav() {
  const { section, navigate } = useDashboard()
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV.map(({ section: target, label, icon: Icon }) => (
        <button
          key={target}
          type="button"
          onClick={() => navigate({ section: target, projectId: null, taskId: null })}
          aria-current={section === target ? "page" : undefined}
          className={cn(
            "flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground",
            section === target && "text-primary"
          )}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </button>
      ))}
    </nav>
  )
}
