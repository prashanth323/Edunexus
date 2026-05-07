import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Phone, Mail, MoreHorizontal, Calendar, Plus } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getLeads,
  updateLeadStatus,
  type LeadStatus,
  LEAD_STATUS_OPTIONS,
} from "../api/crm.api"

const PIPELINE_STAGES: {
  id: string
  label: string
  statuses: LeadStatus[]
  color: string
}[] = [
  {
    id: "new",
    label: "New",
    statuses: ["new"],
    color: "bg-blue-500/10 text-blue-500 border-blue-200 dark:border-blue-900",
  },
  {
    id: "active",
    label: "Engaged",
    statuses: ["contacted", "interested", "followup_scheduled"],
    color: "bg-purple-500/10 text-purple-500 border-purple-200 dark:border-purple-900",
  },
  {
    id: "visit",
    label: "Visit",
    statuses: ["visit_scheduled", "visited"],
    color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900",
  },
  {
    id: "applied",
    label: "Applied",
    statuses: ["applied"],
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-900",
  },
  {
    id: "admitted",
    label: "Admitted",
    statuses: ["admitted"],
    color: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-900",
  },
  {
    id: "closed",
    label: "Closed",
    statuses: ["not_interested", "lost"],
    color: "bg-muted text-muted-foreground border-border",
  },
]

export function CrmPipeline() {
  const activeSchoolId = useAuth((state) => state.activeSchoolId)
  const queryClient = useQueryClient()

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["crm-leads", activeSchoolId],
    queryFn: () => getLeads(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { mutate: changeStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] })
      toast.success("Lead status updated")
    },
    onError: () => {
      toast.error("Failed to update lead status")
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admissions Pipeline</h1>
            <p className="text-muted-foreground mt-1">Manage prospective students from inquiry to enrollment.</p>
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4 pt-2">
          {Array.from({ length: 6 }, (_, col) => (
            <div key={col} className="flex min-w-[260px] flex-col gap-3">
              <Skeleton className="h-9 w-full rounded-md" />
              {Array.from({ length: 3 }, (_, row) => (
                <Card key={row}>
                  <CardContent className="pt-4 space-y-3">
                    <Skeleton className="h-4 w-full max-w-[200px]" />
                    <Skeleton className="h-3 w-full max-w-[120px]" />
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admissions Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Manage prospective students from inquiry to enrollment.
          </p>
        </div>
        <Button className="shrink-0 gap-2" type="button" variant="secondary" disabled>
          <Plus className="h-4 w-4" /> New Lead
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4 pt-2">
        {PIPELINE_STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => stage.statuses.includes(l.status))

          return (
            <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col bg-muted/40 rounded-xl border">
              <div className="p-3 border-b bg-muted/50 rounded-t-xl flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <Badge variant="secondary" className="px-1.5 min-w-[20px] justify-center">
                    {stageLeads.length}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-[500px]">
                {stageLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    className="shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{lead.student_name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            Parent: {lead.parent_name}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-6 w-6 p-0 -mr-2 -mt-1">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Change status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {LEAD_STATUS_OPTIONS.map((opt) => (
                              <DropdownMenuItem
                                key={opt.value}
                                disabled={opt.value === lead.status}
                                onClick={() => changeStatus({ id: lead.id, status: opt.value })}
                              >
                                {opt.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 py-2 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{lead.parent_phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs truncate">{lead.parent_email ?? "—"}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-2 flex justify-between items-center border-t mt-2 bg-muted/20">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(lead.created_at), "MMM d")}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase border max-w-[120px] truncate ${stage.color}`}
                      >
                        {lead.lead_sources?.name ?? "—"}
                      </Badge>
                    </CardFooter>
                  </Card>
                ))}
                {stageLeads.length === 0 && (
                  <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg p-6 text-muted-foreground text-sm text-center">
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
