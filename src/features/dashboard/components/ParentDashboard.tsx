import { Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GraduationCap, CalendarCheck, CreditCard, Loader2, Edit2, X } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GenericCardSkeleton } from "@/components/ui/card-skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { getParentChildren, updateStudentDetails } from "../api/dashboard.api"
import { useAuth } from "@/features/auth/hooks/useAuth"

const editChildSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  date_of_birth: z.string().nullable().optional(),
  blood_group: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  religion: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional().nullable(),
  medical_info: z.object({
    allergies: z.string().optional(),
    conditions: z.string().optional(),
    medications: z.string().optional(),
    blood_group: z.string().optional(),
  }).optional().nullable(),
})

type EditChildFormValues = z.infer<typeof editChildSchema>

type ParentChildRow = {
  student_id: string
  student_name: string
  first_name: string
  last_name: string
  gender: string | null
  date_of_birth: string | null
  blood_group: string | null
  nationality: string | null
  religion: string | null
  category: string | null
  phone: string | null
  email: string | null
  address: any
  medical_info: any
  class_name: string | null
  section_name: string | null
  attendance_pct_this_month: number | null
  pending_fees: number | null
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return "?"
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase()
  return `${p[0]![0]}${p[p.length - 1]![0]}`.toUpperCase()
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

function EditChildModal({ 
  child, 
  onClose, 
  onSuccess 
}: { 
  child: ParentChildRow, 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [submitting, setSubmitting] = useState(false)
  
  const form = useForm<EditChildFormValues>({
    resolver: zodResolver(editChildSchema),
    defaultValues: {
      first_name: child.first_name || "",
      last_name: child.last_name || "",
      gender: (child.gender as any) || "prefer_not_to_say",
      date_of_birth: child.date_of_birth || "",
      blood_group: child.blood_group || "",
      nationality: child.nationality || "",
      religion: child.religion || "",
      category: child.category || "",
      phone: child.phone || "",
      email: child.email || "",
      address: child.address || { street: "", city: "", state: "", zip: "" },
      medical_info: child.medical_info || { allergies: "", conditions: "", medications: "" },
    },
  })

  async function onSubmit(values: EditChildFormValues) {
    try {
      setSubmitting(true)
      // Clean up empty strings for nullable fields
      const updates: any = { ...values }
      if (updates.email === "") updates.email = null
      
      await updateStudentDetails(child.student_id, updates)
      toast.success("Student details updated successfully")
      onSuccess()
      onClose()
    } catch (e: any) {
      toast.error(e.message || "Failed to update details")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-2xl shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 shrink-0">
          <div>
            <CardTitle>Edit Child Details</CardTitle>
            <CardDescription>Update comprehensive profile information for {child.student_name}.</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="personal">Personal</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="medical">Medical</TabsTrigger>
                </TabsList>
                
                <TabsContent value="personal" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                          </select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="blood_group"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Blood Group</FormLabel>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                            value={field.value || ""}
                          >
                            <option value="">Select</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nationality</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="religion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Religion</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="e.g. General, OBC, etc." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="contact" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label>Address</Label>
                    <FormField
                      control={form.control}
                      name="address.street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Street</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name="address.city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">City</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address.state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">State</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address.zip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">ZIP</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="medical" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="medical_info.allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allergies</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="List any known allergies" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="medical_info.conditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Conditions</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="List any chronic conditions" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="medical_info.medications"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Medications</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="List any regular medications" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t shrink-0">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save All Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

export function ParentDashboard() {
  const user = useAuth((s) => s.user)
  const qc = useQueryClient()
  const [editingChild, setEditingChild] = useState<ParentChildRow | null>(null)

  const { data: children, isLoading } = useQuery({
    queryKey: ["parent-children", user?.id],
    queryFn: () => getParentChildren(user!.id),
    enabled: !!user?.id,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parent Dashboard</h1>
          <p className="text-muted-foreground mt-1">See your linked children, fee summary, and school notices.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <GenericCardSkeleton key={i} withAccent rows={3} />
          ))}
        </div>
      </div>
    )
  }

  const rows = (children ?? []) as ParentChildRow[]
  const totalPendingFees = rows.reduce((acc, c) => acc + Number(c.pending_fees ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {editingChild && (
        <EditChildModal 
          child={editingChild} 
          onClose={() => setEditingChild(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["parent-children", user?.id] })}
        />
      )}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parent Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          See your linked children, fee summary, and school notices.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <div className="col-span-full py-16 text-center border border-dashed rounded-lg text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground">No linked children</p>
            <p className="text-sm mt-1 max-w-mdant mx-auto">
              When your school links your account to a student, their details will show here.
            </p>
          </div>
        ) : (
          rows.map((child) => (
            <Card key={child.student_id} className="overflow-hidden">
              <div className="h-2 w-full bg-primary" />
              <CardHeader className="pb-2 flex flex-row items-start gap-4">
                <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                  <AvatarImage src="" alt="" />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {initials(child.student_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{child.student_name}</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => setEditingChild(child)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription className="mt-1">
                    {[child.class_name, child.section_name ? `Section ${child.section_name}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Class not set"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 p-3 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarCheck className="h-3 w-3" /> Attendance (month)
                    </span>
                    <span className="text-lg font-bold">
                      {child.attendance_pct_this_month != null
                        ? `${Number(child.attendance_pct_this_month).toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground">Pending fees</span>
                    <span className="text-lg font-bold">
                      ${Number(child.pending_fees ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Fee overview
            </CardTitle>
            <CardDescription>Outstanding balance across linked students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-lg space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total pending</p>
                <p className="text-3xl font-bold mt-1 tabular-nums">${totalPendingFees.toLocaleString()}</p>
              </div>
              {totalPendingFees > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pay or discuss outstanding fees with the school office.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No outstanding balance on linked students.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>School notices</CardTitle>
            <CardDescription>Announcements for your school</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View published notices from the notices board.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/notices">View notices</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
