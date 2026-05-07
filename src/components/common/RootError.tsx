import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom"
import { AlertCircle, ArrowLeft, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RootError() {
  const error = useRouteError()
  let title = "Unexpected Error"
  let message = "Something went wrong. Please try again or contact support."

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "404 Not Found"
      message = "The page you are looking for does not exist or has been moved."
    } else if (error.status === 401) {
      title = "Unauthorized"
      message = "You don't have permission to access this page."
    } else if (error.status === 503) {
      title = "Service Unavailable"
      message = "The server is currently unable to handle the request."
    }
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertCircle className="w-10 h-10" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        {error instanceof Error && error.stack && (
          <div className="p-4 bg-muted rounded-lg text-left overflow-auto max-h-40">
            <pre className="text-xs font-mono">{error.stack}</pre>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Reload page
          </Button>
          <Button asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
