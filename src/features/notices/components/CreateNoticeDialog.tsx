import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus } from "lucide-react"

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
import { createSchoolNotice, type NoticeAudience } from "../api/notices.api"

const AUDIENCES: NoticeAudience[] = ["all", "students", "parents", "teachers", "staff"]

const schema = z.object({
  title: z.string().min(1, "Required"),
  body: z.string().min(1, "Required"),
  audience: z.enum(["all", "students", "parents", "teachers", "staff"]),
  publishNow: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function CreateNoticeDialog({
  schoolId,
}: {
  schoolId: string
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      body: "",
      audience: "all",
      publishNow: true,
    },
  })

  const mutation = useMutation({
    mutationFn: (vals: FormValues) =>
      createSchoolNotice({
        schoolId,
        title: vals.title,
        body: vals.body,
        audience: vals.audience,
        is_published: vals.publishNow,
      }),
    onSuccess: (_, vars) => {
      toast.success(vars.publishNow ? "Notice published" : "Draft saved")
      qc.invalidateQueries({ queryKey: ["notices"] })
      form.reset({ title: "", body: "", audience: "all", publishNow: true })
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message || "Could not save notice"),
  })

  function onSubmit(values: FormValues) {
    mutation.mutate(values)
  }

  return (
    <>
      <Button className="shrink-0 gap-2" type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Create notice
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !mutation.isPending && setOpen(false)}
        >
          <div
            role="dialog"
            className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-1">New notice</h3>
            <p className="text-sm text-muted-foreground mb-4">Posts to your active school context only.</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. PTA meeting" />
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
                          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="audience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audience</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={field.value}
                          onChange={field.onChange}
                        >
                          {AUDIENCES.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
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
                      <FormLabel className="font-normal cursor-pointer">
                        Publish immediately (otherwise draft)
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      ) : null}
    </>
  )
}
