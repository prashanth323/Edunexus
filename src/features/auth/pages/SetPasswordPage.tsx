import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { GraduationCap, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PasswordInput } from "@/components/ui/password-input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  setPasswordSchema,
  type SetPasswordFormValues,
  updateAccountPassword,
} from "../api/auth.api"
import { useAuth } from "../hooks/useAuth"
import { supabase } from "@/lib/supabase"

export function SetPasswordPage() {
  const navigate = useNavigate()
  const initialize = useAuth((s) => s.initialize)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  useEffect(() => {
    let cancelled = false

    async function resolveSession() {
      // Supabase parses invite/recovery tokens from the URL hash on load.
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        setHasSession(true)
        setCheckingSession(false)
        return
      }

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return
        if (
          session &&
          (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION")
        ) {
          setHasSession(true)
          setCheckingSession(false)
        }
      })

      window.setTimeout(() => {
        if (!cancelled) setCheckingSession(false)
      }, 2500)

      return () => listener.subscription.unsubscribe()
    }

    const cleanupPromise = resolveSession()
    return () => {
      cancelled = true
      void cleanupPromise
    }
  }, [])

  async function onSubmit(values: SetPasswordFormValues) {
    try {
      setSubmitting(true)
      await updateAccountPassword(values.newPassword)
      const { data } = await supabase.auth.getSession()
      await initialize({ authSession: data.session ?? null })
      toast.success("Password set — welcome to EduNexus")
      navigate("/", { replace: true })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not set password")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="flex items-center gap-2 text-primary mb-6">
        <GraduationCap className="h-8 w-8" />
        <span className="text-xl font-bold">EduNexus</span>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            {hasSession
              ? "Choose a password to finish activating your account."
              : "Open the link from your school invitation or password reset email."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingSession ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasSession ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                This page works only from an invitation or reset link. If you were invited as staff
                (e.g. accountant), check your inbox for an email from EduNexus and click{" "}
                <strong>Accept the invite</strong> or <strong>Set password</strong>.
              </p>
              <p>
                Already set a password?{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <PasswordInput autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <PasswordInput autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save password & continue"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
