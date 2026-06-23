import { useEffect, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({
  contactId: z.string().min(1, "Select a recipient"),
  title: z.string().optional(),
  message: z.string().min(1, "Message is required").max(4000),
})

type FormValues = z.infer<typeof schema>

export type ComposeContact = {
  id: string
  name: string
  subtitle?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  contacts: ComposeContact[]
  contactsLoading?: boolean
  submitting?: boolean
  onSubmit: (contactId: string, message: string, subject?: string) => void
}

export function ComposeMessageDialog({
  open,
  onOpenChange,
  title,
  description,
  contacts,
  contactsLoading,
  submitting,
  onSubmit,
}: Props) {
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    setVisible(open)
  }, [open])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { contactId: "", title: "", message: "" },
  })

  useEffect(() => {
    if (open) {
      form.reset({ contactId: contacts[0]?.id ?? "", title: "", message: "" })
    }
  }, [open, contacts, form])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border bg-background shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>

        <Form {...form}>
          <form
            className="px-6 py-4 space-y-4"
            onSubmit={form.handleSubmit((values) => {
              onSubmit(values.contactId, values.message, values.title)
            })}
          >
            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient</FormLabel>
                  {contactsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading contacts…
                    </div>
                  ) : contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contacts available.</p>
                  ) : (
                    <FormControl>
                      <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                        {contacts.map((c) => (
                          <label
                            key={c.id}
                            className={cn(
                              "flex flex-col px-3 py-2 cursor-pointer hover:bg-muted/50",
                              field.value === c.id && "bg-muted",
                            )}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              value={c.id}
                              checked={field.value === c.id}
                              onChange={() => field.onChange(c.id)}
                            />
                            <span className="font-medium text-sm">{c.name}</span>
                            {c.subtitle && (
                              <span className="text-xs text-muted-foreground">{c.subtitle}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Homework concern" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Write your message…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2 pb-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || contacts.length === 0}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
