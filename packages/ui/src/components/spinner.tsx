import { cn } from "@coe/ui/lib/utils"
import { IconLoader } from "@tabler/icons-react"

function Spinner({ className }: { className?: string }) {
  return (
    <IconLoader aria-label="Loading" className={cn("size-4 animate-spin", className)} role="status" />
  )
}

export { Spinner }
