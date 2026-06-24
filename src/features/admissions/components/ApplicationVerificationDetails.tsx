import { Badge } from "@/components/ui/badge"
import type { Application } from "../api/admissions.api"

type Props = {
  app: Application
  feeTotal?: number
}

export function ApplicationVerificationDetails({ app, feeTotal }: Props) {
  const fd = app.form_data
  const studentEmail = String(fd.student_email ?? fd.email ?? app.leads?.parent_email ?? "—")
  const docs = app.documents ?? []

  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <p>
        <span className="text-muted-foreground">Student:</span>{" "}
        {app.leads?.student_name ?? "—"}
      </p>
      <p>
        <span className="text-muted-foreground">Student email:</span> {studentEmail}
      </p>
      <p>
        <span className="text-muted-foreground">Parent:</span> {app.leads?.parent_name ?? "—"}
      </p>
      <p>
        <span className="text-muted-foreground">Parent phone:</span>{" "}
        {app.leads?.parent_phone ?? "—"}
      </p>
      <p>
        <span className="text-muted-foreground">Parent email:</span>{" "}
        {app.leads?.parent_email ?? String(fd.parent_email ?? "—")}
      </p>
      <p>
        <span className="text-muted-foreground">Class:</span> {app.class_applying}
      </p>
      <p>
        <span className="text-muted-foreground">Application no.:</span> {app.application_no}
      </p>
      {app.identity_number && (
        <p>
          <span className="text-muted-foreground">
            {app.identity_type ?? "Identity"}:
          </span>{" "}
          {app.identity_number}
        </p>
      )}
      {(Boolean(fd.date_of_birth) || Boolean(fd.gender) || Boolean(fd.address)) && (
        <>
          <p>
            <span className="text-muted-foreground">DOB:</span>{" "}
            {String(fd.date_of_birth ?? "—")}
          </p>
          <p>
            <span className="text-muted-foreground">Gender:</span>{" "}
            {String(fd.gender ?? "—")}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Address:</span>{" "}
            {String(fd.address ?? "—")}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Previous school:</span>{" "}
            {String(fd.previous_school ?? "—")}
          </p>
        </>
      )}
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        {app.needs_hostel && <Badge variant="outline">Hostel</Badge>}
        {app.needs_transport && <Badge variant="outline">Transport</Badge>}
      </div>
      {docs.length > 0 && (
        <div className="sm:col-span-2">
          <span className="text-muted-foreground">Documents:</span>{" "}
          {docs.map((d) => d.type).join(", ")}
        </div>
      )}
      {feeTotal != null && (
        <p className="sm:col-span-2 font-medium">
          Total fee commitment: ₹{feeTotal.toLocaleString("en-IN")}
        </p>
      )}
    </div>
  )
}
