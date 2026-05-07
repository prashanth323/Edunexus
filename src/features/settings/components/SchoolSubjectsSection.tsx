import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookMarked, Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSchoolSubject, setSchoolSubjectActive } from "@/features/settings/api/subjects-admin.api"
import { getSubjects } from "@/features/lms/api/lms.api"

export function SchoolSubjectsSection({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient()
  const [newName, setNewName] = useState("")
  const [newCode, setNewCode] = useState("")

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["school-subjects-admin", schoolId],
    queryFn: () => getSubjects(schoolId, { includeInactive: true }),
    enabled: !!schoolId,
  })

  const addMut = useMutation({
    mutationFn: () => createSchoolSubject({ schoolId, name: newName, code: newCode || null }),
    onSuccess: () => {
      toast.success("Subject added.")
      setNewName("")
      setNewCode("")
      qc.invalidateQueries({ queryKey: ["school-subjects-admin", schoolId] })
      qc.invalidateQueries({ queryKey: ["lms-subjects", schoolId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add subject"),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setSchoolSubjectActive(id, active),
    onSuccess: () => {
      toast.success("Subject updated.")
      qc.invalidateQueries({ queryKey: ["school-subjects-admin", schoolId] })
      qc.invalidateQueries({ queryKey: ["lms-subjects", schoolId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update subject"),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookMarked className="h-5 w-5" />
          Subjects
        </CardTitle>
        <CardDescription>
          Master list of subjects for this school (timetable, LMS courses, teacher defaults). Teachers only pick from this
          list; they cannot add new subject names here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
          <p className="text-sm font-medium">Add subject</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="new-subject-name">Name</Label>
              <Input
                id="new-subject-name"
                placeholder="e.g. Mathematics"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-subject-code">Code (optional)</Label>
              <Input id="new-subject-code" placeholder="e.g. MATH" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            </div>
          </div>
          <Button type="button" disabled={addMut.isPending || !newName.trim()} onClick={() => addMut.mutate()}>
            {addMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add subject
              </>
            )}
          </Button>
        </div>

        {isLoading ? (
          <ul className="divide-y rounded-lg border">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-9 w-24" />
              </li>
            ))}
          </ul>
        ) : subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg py-10 text-center">No subjects yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {subjects.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{s.name}</span>
                  {s.code ? (
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{s.code}</span>
                  ) : null}
                  <div className="mt-1">
                    <Badge variant={s.is_active === false ? "outline" : "secondary"}>
                      {s.is_active === false ? "Inactive" : "Active"}
                    </Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={toggleMut.isPending}
                  onClick={() => toggleMut.mutate({ id: s.id, active: s.is_active === false })}
                >
                  {s.is_active === false ? "Activate" : "Deactivate"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
