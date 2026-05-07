import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

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
import { cn } from "@/lib/utils"
import { getSchools, queryKeys } from "@/features/dashboard/api/platform.api"
import { broadcastNotices } from "@/features/notices/api/notices.api"

const schema = z.object({
  title: z.string().min(1, "Required"),
  body: z.string().min(1, "Required"),
  publishNow: z.boolean(),
  sendToAllSchools: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function PlatformAnnouncements({ hideOuterHeading = false }: { hideOuterHeading?: boolean }) {
  const qc = useQueryClient()
  const [schoolFilter, setSchoolFilter] = useState("")

  const { data: schools = [], isLoading } = useQuery({
    queryKey: queryKeys.platformSchools,
    queryFn: getSchools,
  })

  const [selectedSchoolIds, setSelectedSchoolIds] = useState<Set<string>>(() => new Set())

  const filteredSchools = useMemo(() => {
    const q = schoolFilter.trim().toLowerCase()
    if (!q) return schools
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || String(s.code ?? "").toLowerCase().includes(q),
    )
  }, [schools, schoolFilter])

  const toggleSchool = (id: string, checked: boolean) => {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      body: "",
      publishNow: true,
      sendToAllSchools: true,
    },
  })

  const sendToAll = form.watch("sendToAllSchools")

  function selectAllListed() {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev)
      for (const s of filteredSchools) next.add(s.id)
      return next
    })
  }

  function clearListedFromSelection() {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev)
      for (const s of filteredSchools) next.delete(s.id)
      return next
    })
  }

  function clearAllSelections() {
    setSelectedSchoolIds(new Set())
  }

  const mutation = useMutation({
    mutationFn: (
      vals: FormValues & {
        schoolIds: string[] | undefined
      },
    ) =>
      broadcastNotices({
        schoolIds: vals.schoolIds,
        title: vals.title,
        body: vals.body,
        audience: "all",
        is_published: vals.publishNow,
      }),
    onSuccess: (_, vals) => {
      const n = vals.sendToAllSchools ? schoolIdsMemo.length : (vals.schoolIds?.length ?? 0)
      toast.success(`Sent to ${n} school${n === 1 ? "" : "s"}`)
      qc.invalidateQueries({ queryKey: ["notices"] })
      qc.invalidateQueries({ queryKey: queryKeys.platformSchools })
      form.reset({
        title: "",
        body: "",
        publishNow: true,
        sendToAllSchools: true,
      })
      setSelectedSchoolIds(new Set())
      setSchoolFilter("")
    },
    onError: (e: Error) => toast.error(e.message || "Broadcast failed"),
  })

  const schoolIdsMemo = useMemo(() => schools.map((s) => s.id), [schools])

  function onSubmit(values: FormValues) {
    let schoolIds: string[] | undefined
    if (!values.sendToAllSchools) {
      const picked = Array.from(selectedSchoolIds)
      if (picked.length === 0) {
        toast.error('Choose schools below, or switch to “All schools”.')
        return
      }
      schoolIds = picked
    }
    mutation.mutate({ ...values, schoolIds })
  }

  return (
    <div className={cn("space-y-6 animate-in fade-in duration-500", !hideOuterHeading && "max-w-3xl")}>
      {!hideOuterHeading ? (
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Platform announcements</h2>
          <p className="text-sm text-muted-foreground">
            Send the same notice to every active school or pick specific schools below.
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="sendToAllSchools"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>School recipients</FormLabel>
                  <div className="flex rounded-lg border p-1 gap-1 bg-muted/40">
                    <button
                      type="button"
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        field.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/60",
                      )}
                      onClick={() => field.onChange(true)}
                    >
                      All schools
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        !field.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/60",
                      )}
                      onClick={() => field.onChange(false)}
                    >
                      Selected schools
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {field.value
                      ? `This broadcast will target all ${schools.length} active school(s).`
                      : "Pick one or more schools. Use search and bulk actions below."}
                  </p>
                </FormItem>
              )}
            />

            {!sendToAll && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    type="search"
                    placeholder="Filter by school name or code…"
                    value={schoolFilter}
                    onChange={(e) => setSchoolFilter(e.target.value)}
                    className="sm:max-w-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllListed}>
                      Select listed ({filteredSchools.length})
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearListedFromSelection}>
                      Deselect listed
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearAllSelections}>
                      Clear all
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedSchoolIds.size} school{selectedSchoolIds.size === 1 ? "" : "s"} selected
                </p>
                <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/20 divide-y">
                  {filteredSchools.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      {schools.length === 0 ? "No schools yet." : "No schools match your filter."}
                    </p>
                  ) : (
                    filteredSchools.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/40 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0"
                          checked={selectedSchoolIds.has(s.id)}
                          onChange={(e) => toggleSchool(s.id, e.target.checked)}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-sm truncate block">{s.name}</span>
                          {s.code ? (
                            <span className="text-xs text-muted-foreground">Code · {s.code}</span>
                          ) : null}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="publishNow"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Publish immediately</FormLabel>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={mutation.isPending || schools.length === 0}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> Sending…
                </>
              ) : (
                "Broadcast"
              )}
            </Button>
          </form>
        </Form>
      )}
    </div>
  )
}
