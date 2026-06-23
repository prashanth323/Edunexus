import { useEffect, useRef, useState } from "react"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { StudentIdCardData } from "../lib/studentIdCardData"
import { useStudentDocumentsDisplayUrl } from "../hooks/useStudentDocumentsDisplayUrl"

export type { StudentIdCardData }

export function IdCardGenerator({ data }: { data: StudentIdCardData }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const resolvedPhotoSrc = useStudentDocumentsDisplayUrl(data.photoUrl)
  const [photoFailed, setPhotoFailed] = useState(false)

  useEffect(() => {
    setPhotoFailed(false)
  }, [data.photoUrl, resolvedPhotoSrc])

  function handlePrint() {
    const content = cardRef.current
    if (!content) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student ID Card - ${data.studentName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
          @media print {
            body { background: white; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>${content.outerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 300)
  }

  const initials = data.studentName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Student ID Card Preview</h3>
        <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      <div className="flex justify-center">
        <div
          ref={cardRef}
          style={{
            width: "340px",
            minHeight: "540px",
            borderRadius: "16px",
            overflow: "hidden",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            background: "white",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              padding: "20px 20px 24px",
              color: "white",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", opacity: 0.9, marginBottom: "4px" }}>
              Student Identity Card
            </div>
            <div style={{ fontSize: "18px", fontWeight: "700" }}>{data.schoolName}</div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>{data.academicYear}</div>
          </div>

          {/* Photo */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "-32px", position: "relative", zIndex: 2 }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                border: "4px solid white",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                overflow: "hidden",
                background: "#e5e7eb",
                position: "relative",
              }}
            >
              {resolvedPhotoSrc && data.photoUrl && !photoFailed ? (
                <img
                  src={resolvedPhotoSrc}
                  alt={data.studentName}
                  referrerPolicy="no-referrer"
                  onError={() => setPhotoFailed(true)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center center",
                    display: "block",
                  }}
                />
              ) : (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#6366f1",
                  }}
                >
                  {initials}
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "12px 24px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#1f2937", marginBottom: "4px" }}>
              {data.studentName}
            </div>
            <div
              style={{
                display: "inline-block",
                background: "#f3f4f6",
                borderRadius: "20px",
                padding: "4px 14px",
                fontSize: "12px",
                color: "#6b7280",
                fontWeight: "500",
              }}
            >
              {data.className} — Section {data.sectionName}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginTop: "20px",
                textAlign: "left",
              }}
            >
              <InfoField label="Admission No" value={data.admissionNo} />
              {data.rollNo && <InfoField label="Roll No" value={data.rollNo} />}
              {data.dateOfBirth && <InfoField label="Date of Birth" value={data.dateOfBirth} />}
              {data.bloodGroup && <InfoField label="Blood Group" value={data.bloodGroup} />}
              {data.phone && <InfoField label="Phone" value={data.phone} />}
            </div>

            {data.emergencyContact?.phone && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "10px 14px",
                  background: "#fef2f2",
                  borderRadius: "10px",
                  border: "1px solid #fecaca",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#ef4444", fontWeight: "600", marginBottom: "4px" }}>
                  Emergency Contact
                </div>
                <div style={{ fontSize: "13px", color: "#1f2937", fontWeight: "500" }}>
                  {data.emergencyContact.name || "Contact"} ({data.emergencyContact.relation || "Guardian"})
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  {data.emergencyContact.phone}
                </div>
              </div>
            )}

            {data.address && (
              <div style={{ marginTop: "12px", fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>
                {data.address}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#9ca3af", fontWeight: "500" }}>
        {label}
      </div>
      <div style={{ fontSize: "14px", color: "#1f2937", fontWeight: "600", marginTop: "2px" }}>
        {value}
      </div>
    </div>
  )
}
