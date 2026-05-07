import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Password field with show/hide toggle (Eye icon). Forwards ref for react-hook-form. */
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-11", className)}
          disabled={disabled}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full min-w-10 rounded-l-none px-3 text-muted-foreground hover:bg-transparent hover:text-foreground"
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    )
  },
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
