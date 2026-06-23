import { useRef } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

type ReceiptData = {
  schoolName: string
  receiptNo: string
  date: string
  studentName: string
  admissionNo: string
  className: string
  sectionName: string
  invoiceNo: string
  description: string
  amount: number
  discount: number
  fine: number
  totalAmount: number
  paidAmount: number
  paymentMethod: string
  transactionRef?: string
  remainingBalance: number
}

export function FeeReceiptTemplate({ data }: { data: ReceiptData }) {
  const receiptRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const content = receiptRef.current
    if (!content) return
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Fee Receipt - ${data.receiptNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 24px; }
        @media print { body { padding: 0; } .no-print { display: none !important; } }
      </style>
      </head><body>${content.outerHTML}</body></html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Print Receipt
        </Button>
      </div>

      <div className="flex justify-center">
        <div
          ref={receiptRef}
          style={{
            width: "480px",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
            background: "white",
          }}
        >
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "20px 24px", color: "white", textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: "700" }}>{data.schoolName}</div>
            <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "4px", letterSpacing: "2px", textTransform: "uppercase" }}>Fee Payment Receipt</div>
          </div>

          {/* Info */}
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "13px" }}>
              <div><strong>Receipt No:</strong> {data.receiptNo}</div>
              <div><strong>Date:</strong> {new Date(data.date).toLocaleDateString()}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "20px", fontSize: "13px" }}>
              <div><span style={{ color: "#6b7280" }}>Student:</span> <strong>{data.studentName}</strong></div>
              <div><span style={{ color: "#6b7280" }}>Adm. No:</span> <strong>{data.admissionNo}</strong></div>
              <div><span style={{ color: "#6b7280" }}>Class:</span> {data.className} — {data.sectionName}</div>
              <div><span style={{ color: "#6b7280" }}>Invoice:</span> {data.invoiceNo}</div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "600" }}>Description</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 12px" }}>{data.description}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>${data.amount.toLocaleString()}</td>
                  </tr>
                  {data.discount > 0 && (
                    <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "10px 12px", color: "#22c55e" }}>Discount</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#22c55e" }}>-${data.discount.toLocaleString()}</td>
                    </tr>
                  )}
                  {data.fine > 0 && (
                    <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "10px 12px", color: "#ef4444" }}>Late Fine</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#ef4444" }}>+${data.fine.toLocaleString()}</td>
                    </tr>
                  )}
                  <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "700" }}>Total</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700" }}>${data.totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                <span style={{ fontWeight: "600", color: "#166534" }}>Amount Paid</span>
                <span style={{ fontWeight: "700", color: "#166534", fontSize: "16px" }}>${data.paidAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "12px", color: "#6b7280" }}>
                <span>Method: {data.paymentMethod}</span>
                {data.transactionRef && <span>Ref: {data.transactionRef}</span>}
              </div>
            </div>

            {data.remainingBalance > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 16px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#991b1b", fontWeight: "600" }}>Remaining Balance</span>
                  <span style={{ color: "#991b1b", fontWeight: "700" }}>${data.remainingBalance.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: "24px", textAlign: "center", fontSize: "11px", color: "#9ca3af", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
              This is a computer-generated receipt and does not require a signature.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
