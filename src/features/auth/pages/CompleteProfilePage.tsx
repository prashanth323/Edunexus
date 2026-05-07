import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  profileEssentialsSchema,
  type ProfileEssentialsFormValues,
} from "@/features/auth/lib/profileEssentials"

type FormValues = ProfileEssentialsFormValues

export function CompleteProfilePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(profileEssentialsSchema),
    defaultValues: {
      phone: profile?.phone ?? "",
      gender: (profile?.gender as FormValues["gender"]) ?? "prefer_not_to_say",
      date_of_birth: profile?.date_of_birth?.slice(0, 10) ?? "",
    },
  })

  async function onSubmit(values: FormValues) {
    if (!user?.id) return
    try {
      setSubmitting(true)
      const { error } = await supabase
        .from("profiles")
        .update({
          phone: values.phone.trim(),
          gender: values.gender,
          date_of_birth: values.date_of_birth,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) throw error
      await useAuth.getState().initialize({ refreshProfile: true })
      toast.success("Profile updated.")
      navigate("/", { replace: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save profile"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            Enter your phone, gender, and date of birth to continue. This is required once for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input autoComplete="tel" placeholder="+1 …" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        {...field}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                  "Continue"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
