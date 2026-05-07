import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { GraduationCap, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import loginTexture from "@/assets/login-texture.png"

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
import { PasswordInput } from "@/components/ui/password-input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loginSchema, type LoginCredentials, loginWithEmail } from "../api/auth.api"
import { useAuth } from "../hooks/useAuth"

export function LoginPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const initialize = useAuth(state => state.initialize)

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(data: LoginCredentials) {
    try {
      setIsSubmitting(true)
      const auth = await loginWithEmail(data)
      await initialize({ authSession: auth.session ?? null })
      toast.success("Successfully logged in")
      navigate("/")
    } catch (error: any) {
      toast.error(error.message || "Failed to log in")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex overflow-hidden">
        <motion.div 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          className="absolute inset-0"
        >
          <img 
            src={loginTexture} 
            alt="" 
            className="h-full w-full object-cover"
          />
        </motion.div>
        <div className="absolute inset-0 bg-primary/40 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/60 via-transparent to-primary/80" />
        <div className="relative z-20 flex items-center text-lg font-medium gap-2">
          <GraduationCap className="h-8 w-8" />
          <span className="text-2xl font-bold tracking-tight">EduNexus</span>
        </div>
        <div className="relative z-20 mt-auto p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
          <blockquote className="space-y-2">
            <p className="text-lg font-medium leading-relaxed italic">
              "The comprehensive unified platform has completely transformed how we manage our entire school district. Data flows seamlessly from admissions to academics."
            </p>
            <footer className="text-sm text-primary-foreground/80 font-medium">Dr. Sarah Jenkins, Superintendent</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8 flex items-center justify-center w-full">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center lg:hidden">
            <div className="flex justify-center mb-2 text-primary">
              <GraduationCap className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              EduNexus
            </h1>
          </div>
          
          <Card className="border-none shadow-none lg:border-solid lg:shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="username"
                            placeholder="name@school.edu"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          <a href="#" className="text-sm font-medium text-primary hover:underline">
                            Forgot password?
                          </a>
                        </div>
                        <FormControl>
                          <PasswordInput autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
