import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { createHalfDayRequest } from "../api/halfDay.api"
import { supabase } from "@/lib/supabase"

export function HalfDayRequestForm() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const [studentId, setStudentId] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("")

  const { data: students = [] } = useQuery({
    queryKey: ["half-day-students", activeSchoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, admission_no, profiles:profile_id ( full_name )")
        .eq("school_id", activeSchoolId!)
        .limit(100)
      return data ?? []
    },
    enabled: !!activeSchoolId && activeRole === "receptionist",
  })

  const mutation = useMutation({
    mutationFn: () =>
      createHalfDayRequest({
        schoolId: activeSchoolId!,
        studentId,
        requestDate: date,
        reason,
      }),
    onSuccess: () => {
      toast.success("Half-day request submitted for VP approval")
      setReason("")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (activeRole !== "receptionist") return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Request half-day attendance</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 max-w-md">
        <div className="grid gap-1.5">
          <Label>Student</Label>
          <select className="h-10 rounded-md border px-3 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select</option>
            {students.map((s: { id: string; admission_no: string; profiles: { full_name: string } | { full_name: string }[] | null }) => {
              const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
              return <option key={s.id} value={s.id}>{p?.full_name ?? s.admission_no}</option>
            })}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
        <Button disabled={!studentId || !reason} onClick={() => mutation.mutate()}>
          Submit for VP approval
        </Button>
      </CardContent>
    </Card>
  )
}
