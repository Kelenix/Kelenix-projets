"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Suspense, useState } from "react"
import { ConfirmProvider } from "@/components/confirm"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Profile } from "@/lib/domain"
import { Dialogs } from "./dialogs"
import { Shell } from "./shell"
import { DashboardProvider } from "./state"
import { TaskSheet } from "./tasks/task-sheet"

export function Dashboard({ viewer }: { viewer: Profile }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConfirmProvider>
          <Suspense>
            <DashboardProvider viewer={viewer}>
              <Shell />
              <TaskSheet />
              <Dialogs />
            </DashboardProvider>
          </Suspense>
        </ConfirmProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
