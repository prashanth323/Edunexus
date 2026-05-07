import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAuditLogs } from "../../api/platform.api"

export function GlobalAuditLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["platform-audit-logs"],
    queryFn: getAuditLogs,
  })

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">System Audit Logs</h2>
          <p className="text-sm text-muted-foreground">
            Review recent system-wide events and changes.
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Entity ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : logs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {format(new Date(log.created_at), "PP pp")}
                  </TableCell>
                  <TableCell>
                    {log.profiles ? (
                      <span className="font-medium">
                        {log.profiles.first_name} {log.profiles.last_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="capitalize">{log.resource}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.resource_id}
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
