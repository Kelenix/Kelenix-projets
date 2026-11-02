import Image from "next/image"
import { BRAND, BRAND_FULL_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

export function Logo({ className, withName = true, size = 32 }: { className?: string; withName?: boolean; size?: number }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <Image
        src="/logo.png"
        alt={withName ? "" : BRAND_FULL_NAME}
        width={size}
        height={size}
        priority
        className="rounded-lg shadow-sm"
      />
      {withName && (
        <span className="text-lg">
          {BRAND.name} <span className="font-medium text-primary">{BRAND.suffix}</span>
        </span>
      )}
    </span>
  )
}
