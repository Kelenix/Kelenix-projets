import { Progress } from "@/components/ui/progress"
import { projectProgress, type Task } from "@/lib/domain"

export function ProjectProgress({ tasks }: { tasks: Pick<Task, "status">[] }) {
  const progress = projectProgress(tasks)
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{progress.label}</p>
      {progress.total > 0 && (
        <Progress value={progress.percent} aria-label={`Avancement : ${progress.percent} %`} className="h-1.5" />
      )}
    </div>
  )
}
