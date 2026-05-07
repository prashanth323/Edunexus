import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Plus, GraduationCap, Users, LineChart } from "lucide-react"
import { Link } from "react-router-dom"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  assignSchoolLeadership,
  createSchool,
  getSchoolLeadership,
  getSchools,
  invitePrincipal,
  queryKeys,
  searchProfilesForAssignment,
  type ProfileAssignable,
  type School,
  type SchoolLeadershipRole,
  type SchoolLeadershipRow,
} from "../../api/platform.api"

const createSchoolSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  contact_email: z
    .string()
    .optional()
    .refine((v) => !v?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), {
      message: "Enter a valid email or leave blank",
    }),
  board: z.string().optional(),
})

type CreateSchoolForm = z.infer<typeof createSchoolSchema>

export function SchoolsManager() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [leadershipSchool, setLeadershipSchool] = useState<School | null>(null)

  const { data: schools, isLoading } = useQuery({
    queryKey: queryKeys.platformSchools,
    queryFn: getSchools,
  })

  const createMutation = useMutation({
    mutationFn: createSchool,
    onSuccess: () => {
      toast.success("School created")
      queryClient.invalidateQueries({ queryKey: queryKeys.platformSchools })
      setAddOpen(false)
      form.reset()
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to create school")
    },
  })

  const form = useForm<CreateSchoolForm>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: {
      name: "",
      code: "",
      contact_email: "",
      board: "",
    },
  })

  function onCreateSubmit(values: CreateSchoolForm) {
    createMutation.mutate({
      name: values.name,
      code: values.code?.trim() || undefined,
      contact_email: values.contact_email?.trim() || undefined,
      board: values.board?.trim() || undefined,
    })
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Schools</h2>
          <p className="text-sm text-muted-foreground">
            Manage all schools operating on the platform. New schools still need an academic year before
            attendance and some modules work fully.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Invite a principal by email from the Admin dialog, or assign an existing user with a profile.
          </p>
        </div>
        <Button size="sm" type="button" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add School
        </Button>
      </div>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !createMutation.isPending && setAddOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="add-school-title"
            className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="add-school-title" className="text-lg font-semibold mb-4">
              Add school
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Springfield High" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="SSH-01" {...field} />
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
                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="office@school.edu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={createMutation.isPending}
                    onClick={() => setAddOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      ) : null}

      {leadershipSchool ? (
        <LeadershipModal
          school={leadershipSchool}
          onClose={() => setLeadershipSchool(null)}
          queryClient={queryClient}
        />
      ) : null}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Board</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : schools?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No schools found.
                </TableCell>
              </TableRow>
            ) : (
              schools?.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-md">
                        <GraduationCap className="h-4 w-4 text-primary" />
                      </div>
                      {school.name}
                    </div>
                  </TableCell>
                  <TableCell>{school.code || "-"}</TableCell>
                  <TableCell>{school.board || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        school.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {school.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" type="button" asChild>
                      <Link to={`/insights/${school.id}`}>
                        <LineChart className="mr-2 h-3.5 w-3.5" />
                        Analytics
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" type="button" onClick={() => setLeadershipSchool(school)}>
                      <Users className="mr-2 h-3.5 w-3.5" />
                      Admins
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function LeadershipModal({
  school,
  onClose,
  queryClient,
}: {
  school: School
  onClose: () => void
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selected, setSelected] = useState<ProfileAssignable | null>(null)
  const [role, setRole] = useState<SchoolLeadershipRole>("principal")
  const [invEmail, setInvEmail] = useState("")
  const [invFirst, setInvFirst] = useState("")
  const [invLast, setInvLast] = useState("")

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(id)
  }, [search])

  const { data: leadership = [], isLoading: leadershipLoading } = useQuery({
    queryKey: queryKeys.schoolLeadership(school.id),
    queryFn: () => getSchoolLeadership(school.id),
  })

  const { data: candidates = [], isFetching: candidatesLoading } = useQuery({
    queryKey: ["profile-assign-search", debouncedSearch],
    queryFn: () => searchProfilesForAssignment({ query: debouncedSearch || undefined, limit: 24 }),
    enabled: debouncedSearch.length >= 1,
  })

  const assignMutation = useMutation({
    mutationFn: assignSchoolLeadership,
    onSuccess: () => {
      toast.success("Role assigned")
      setSelected(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolLeadership(school.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.platformSchools })
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not assign role")
    },
  })

  const inviteMutation = useMutation({
    mutationFn: () =>
      invitePrincipal({
        email: invEmail,
        schoolId: school.id,
        firstName: invFirst.trim() || undefined,
        lastName: invLast.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Invitation email sent.")
      setInvEmail("")
      setInvFirst("")
      setInvLast("")
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolLeadership(school.id) })
    },
    onError: (e: Error) => {
      toast.error(e.message || "Could not invite")
    },
  })

  function submitInvite() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invEmail.trim())) {
      toast.error("Enter a valid email.")
      return
    }
    inviteMutation.mutate()
  }

  function submitAssign() {
    if (!selected) {
      toast.error("Choose a user")
      return
    }
    assignMutation.mutate({ schoolId: school.id, userId: selected.id, role })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => !assignMutation.isPending && !inviteMutation.isPending && onClose()}
    >
      <div
        role="dialog"
        aria-labelledby="leadership-title"
        className="w-full max-w-2xl rounded-lg border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="leadership-title" className="text-lg font-semibold">
          Principal / admin — {school.name}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Invite a new principal by email (uses the deployed <span className="font-mono text-xs">invite-principal</span>{" "}
          Edge Function), or assign an existing user below.
        </p>

        <div className="rounded-md border mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadershipLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-20 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : leadership.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-16 text-center text-muted-foreground text-sm">
                    No principal or admin assigned yet.
                  </TableCell>
                </TableRow>
              ) : (
                leadership.map((row: SchoolLeadershipRow) => (
                  <TableRow key={row.id}>
                    <TableCell className="capitalize">{row.role.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      {row.profiles
                        ? `${row.profiles.first_name} ${row.profiles.last_name}`.trim()
                        : "—"}
                    </TableCell>
                    <TableCell>{row.profiles?.email ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <h4 className="text-sm font-medium mb-2">Invite principal by email</h4>
        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-sm font-medium" htmlFor="inv-email">
              Email
            </label>
            <Input
              id="inv-email"
              type="email"
              placeholder="principal@school.edu"
              value={invEmail}
              onChange={(e) => setInvEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="inv-first">
              First name
            </label>
            <Input id="inv-first" value={invFirst} onChange={(e) => setInvFirst(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="inv-last">
              Last name
            </label>
            <Input id="inv-last" value={invLast} onChange={(e) => setInvLast(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <Button type="button" onClick={submitInvite} disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send invitation"
            )}
          </Button>
        </div>

        <h4 className="text-sm font-medium mb-2">Assign existing user</h4>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium" htmlFor="assign-search">
              Search users
            </label>
            <Input
              id="assign-search"
              placeholder="Email or name (min 1 character)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            <div className="rounded-md border max-h-40 overflow-y-auto bg-muted/30">
              {debouncedSearch.length < 1 ? (
                <p className="p-3 text-xs text-muted-foreground">Type to search profiles.</p>
              ) : candidatesLoading ? (
                <div className="p-4 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No matching users.</p>
              ) : (
                <ul className="divide-y">
                  {candidates.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}
                        onClick={() => setSelected(p)}
                      >
                        <span className="font-medium">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="text-muted-foreground block text-xs">{p.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="w-full sm:w-44 space-y-2">
            <label className="text-sm font-medium" htmlFor="assign-role">
              Role
            </label>
            <select
              id="assign-role"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={role}
              onChange={(e) => setRole(e.target.value as SchoolLeadershipRole)}
            >
              <option value="principal">Principal</option>
              <option value="school_admin">School admin</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between gap-2 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={assignMutation.isPending || inviteMutation.isPending}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={submitAssign}
            disabled={assignMutation.isPending || inviteMutation.isPending || !selected}
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning…
              </>
            ) : (
              "Assign"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
