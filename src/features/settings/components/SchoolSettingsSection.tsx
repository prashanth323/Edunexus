import { ImagePlus, Loader2, School } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { SchoolRow } from "@/features/dashboard/api/platform.api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Label } from "@/components/ui/label"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  fetchSchoolForSettings,
  schoolRowToFormValues,
  schoolSettingsFormSchema,
  updateSchoolFromSettingsForm,
  uploadSchoolBrandingImage,
  type SchoolSettingsFormValues,
} from "@/features/settings/api/school-settings.api"
import { SchoolSubjectsSection } from "@/features/settings/components/SchoolSubjectsSection"

const emptySchoolPlaceholder: SchoolRow = {
  id: "",
  organization_id: null,
  name: "",
  slug: "",
  code: null,
  logo_url: null,
  cover_url: null,
  address: null,
  contact_email: null,
  contact_phone: null,
  board: null,
  established_year: null,
  affiliation_no: null,
  timezone: "Asia/Kolkata",
  currency: "INR",
  academic_start_month: 6,
  is_active: true,
  settings: {},
  deleted_at: null,
  created_at: "",
  updated_at: "",
}

export function SchoolSettingsSection({ schoolId }: { schoolId: string }) {
  const queryClient = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const { data: school, isLoading, error } = useQuery({
    queryKey: ["school-settings", schoolId],
    queryFn: () => fetchSchoolForSettings(schoolId),
    enabled: !!schoolId,
  })

  const form = useForm<SchoolSettingsFormValues>({
    resolver: zodResolver(schoolSettingsFormSchema) as Resolver<SchoolSettingsFormValues>,
    defaultValues: schoolRowToFormValues(emptySchoolPlaceholder),
  })

  useEffect(() => {
    if (!school) return
    form.reset(schoolRowToFormValues(school))
  }, [school, form])

  const saveMutation = useMutation({
    mutationFn: async (values: SchoolSettingsFormValues) => {
      await updateSchoolFromSettingsForm(schoolId, values)
      await queryClient.invalidateQueries({ queryKey: ["school-settings", schoolId] })
      await queryClient.invalidateQueries({ queryKey: ["schools-brief"] })
      await queryClient.invalidateQueries({ queryKey: ["settings-schools-brief"] })
      await useAuth.getState().initialize({ refreshProfile: true })
    },
    onSuccess: () => toast.success("School details saved."),
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not save school")
    },
  })

  async function handleImagePick(
    fileList: FileList | null,
    field: "logo_url" | "cover_url",
    setUploading: (v: boolean) => void,
  ) {
    const file = fileList?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }
    try {
      setUploading(true)
      const url = await uploadSchoolBrandingImage(schoolId, file, field === "logo_url" ? "logo" : "cover")
      form.setValue(field, url, { shouldValidate: true, shouldDirty: true })
      toast.success(field === "logo_url" ? "Logo uploaded." : "Cover image uploaded.")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const logoUrl = form.watch("logo_url")
  const coverUrl = form.watch("cover_url")

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <School className="h-5 w-5" />
            School details
          </CardTitle>
          <CardDescription className="text-destructive">
            {error instanceof Error ? error.message : "Could not load school."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (isLoading || !school) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-lg mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full max-w-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <School className="h-5 w-5" />
            School details
          </CardTitle>
          <CardDescription>
            Branding and contact information for this school. URL slug{" "}
            <span className="font-mono">{school.slug}</span> is set by the platform and cannot be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. DPS-HYD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="board"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Board</FormLabel>
                    <FormControl>
                      <Input placeholder="CBSE, ICSE…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <Label className="text-base">Logo</Label>
              {logoUrl.trim().startsWith("http") ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-16 w-auto max-w-[200px] rounded-md border object-contain bg-muted p-1"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No logo URL yet.</p>
              )}
              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="https://… or upload below" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  void handleImagePick(e.target.files, "logo_url", setUploadingLogo)
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingLogo}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                Upload logo
              </Button>
              <p className="text-xs text-muted-foreground">
                Images are stored under your school folder in Supabase Storage.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <Label className="text-base">Cover image</Label>
              {coverUrl.trim().startsWith("http") ? (
                <img src={coverUrl} alt="" className="h-24 w-full max-w-md rounded-md border object-cover bg-muted" />
              ) : (
                <p className="text-sm text-muted-foreground">No cover URL yet.</p>
              )}
              <FormField
                control={form.control}
                name="cover_url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="https://… or upload below" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  void handleImagePick(e.target.files, "cover_url", setUploadingCover)
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingCover}
                onClick={() => coverInputRef.current?.click()}
              >
                {uploadingCover ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                Upload cover
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="affiliation_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Affiliation number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="established_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Established year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1800}
                        max={2100}
                        placeholder="e.g. 1995"
                        value={field.value === "" ? "" : String(field.value)}
                        onChange={(e) => {
                          const v = e.target.value
                          field.onChange(v === "" ? "" : Number(v))
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input placeholder="Asia/Kolkata" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency code</FormLabel>
                    <FormControl>
                      <Input placeholder="INR" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="academic_start_month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic year starts (month 1–12)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <p className="text-sm font-medium">Address</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address_street"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Street</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground font-mono break-all">School ID: {schoolId}</p>

            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save school details"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    <SchoolSubjectsSection schoolId={schoolId} />
    </>
  )
}
