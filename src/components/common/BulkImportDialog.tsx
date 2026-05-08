import React, { useState, useRef } from "react"
import Papa from "papaparse"
import { 
  FileUp, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Table as TableIcon,
  X,
  ChevronRight,
  Info,
  Trash2,
  Plus
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type CSVColumn = {
  key: string
  label: string
  required: boolean
  description?: string
}

export type BulkImportDialogProps = {
  title: string
  description: string
  columns: CSVColumn[]
  templateRows: string[][]
  onUpload: (data: any[]) => Promise<void>
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = "guide" | "upload" | "preview" | "processing"

export function BulkImportDialog({
  title,
  description,
  columns,
  templateRows,
  onUpload,
  open,
  onOpenChange,
}: BulkImportDialogProps) {
  const [step, setStep] = useState<Step>("guide")
  const [parsedData, setParsedData] = useState<any[]>([])
  const [errors, setErrors] = useState<{ row: number; column: string; message: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep("guide")
    setParsedData([])
    setErrors([])
    setIsUploading(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) reset()
    onOpenChange(newOpen)
  }

  const downloadTemplate = () => {
    const csvContent = Papa.unparse([
      columns.map(c => c.label),
      ...templateRows
    ])
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, "_")}_template.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        validateAndPreview(results.data)
      },
      error: (err) => {
        toast.error(`Error parsing CSV: ${err.message}`)
      }
    })
  }

  const validateData = (data: any[]) => {
    const newErrors: { row: number; column: string; message: string }[] = []
    data.forEach((row, index) => {
      columns.forEach(col => {
        const value = row[col.key]
        if (col.required && (value === undefined || value === null || value === "")) {
          newErrors.push({
            row: index + 1,
            column: col.label,
            message: "This field is required"
          })
        }
      })
    })
    setErrors(newErrors)
  }

  const validateAndPreview = (data: any[]) => {
    const validatedData = data.map((row) => {
      const rowData: any = {}
      columns.forEach(col => {
        // Find the value by matching the label (CSV header) or the key
        const value = row[col.label] || row[col.key] || ""
        rowData[col.key] = typeof value === "string" ? value.trim() : value
      })
      return rowData
    })

    setParsedData(validatedData)
    validateData(validatedData)
    setStep("preview")
  }

  const handleCellEdit = (rowIndex: number, colKey: string, value: string) => {
    const newData = [...parsedData]
    newData[rowIndex] = { ...newData[rowIndex], [colKey]: value }
    setParsedData(newData)
    validateData(newData)
  }

  const handleRemoveRow = (rowIndex: number) => {
    const newData = parsedData.filter((_, i) => i !== rowIndex)
    setParsedData(newData)
    validateData(newData)
  }

  const handleAddRow = () => {
    const newRow: any = {}
    columns.forEach(col => {
      newRow[col.key] = ""
    })
    const newData = [...parsedData, newRow]
    setParsedData(newData)
    validateData(newData)
  }

  const handleConfirmUpload = async () => {
    if (errors.length > 0) {
      toast.error("Please fix the errors in your CSV before uploading.")
      return
    }

    setIsUploading(true)
    setStep("processing")
    try {
      await onUpload(parsedData)
      toast.success("Bulk upload successful!")
      handleOpenChange(false)
    } catch (err) {
      setStep("preview")
      setIsUploading(false)
      // Error handling is usually done in the parent via toast or rejections
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("sm:max-w-[700px]", step === "preview" && "sm:max-w-[900px]")}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <FileUp className="h-5 w-5" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === "guide" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-primary" />
                  Import Instructions
                </h4>
                <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-5">
                  <li>Download the CSV template below to see the required format.</li>
                  <li>Ensure all required columns (marked with *) are filled correctly.</li>
                  <li>Emails must be unique and valid.</li>
                  <li>Save the file as a <strong>.csv</strong> (Comma Separated Values) format.</li>
                </ul>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group" onClick={downloadTemplate}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Download className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Download CSV Template</p>
                      <p className="text-xs text-muted-foreground">Pre-formatted file with all required headers</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>

                <div 
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-sm font-medium mb-1">Click to upload your CSV file</p>
                  <p className="text-xs text-muted-foreground">or drag and drop here</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv" 
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Preview Data ({parsedData.length} rows)</h4>
                </div>
                {errors.length > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.length} Errors Found
                  </Badge>
                )}
                {errors.length === 0 && (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Validation Passed
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={handleAddRow} className="gap-1 h-8">
                  <Plus className="h-3 w-3" /> Add Row
                </Button>
              </div>

              <div className="border rounded-md max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      {columns.map(col => (
                        <TableHead key={col.key}>
                          {col.label} {col.required && <span className="text-destructive">*</span>}
                        </TableHead>
                      ))}
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {columns.map(col => {
                          const error = errors.find(e => e.row === rowIndex + 1 && e.column === col.label)
                          return (
                            <TableCell key={col.key} className={cn("p-1", error && "bg-destructive/5")}>
                              <div className="flex flex-col gap-1">
                                <Input
                                  value={row[col.key] || ""}
                                  onChange={(e) => handleCellEdit(rowIndex, col.key, e.target.value)}
                                  className={cn(
                                    "h-8 text-xs border-transparent hover:border-input focus:border-primary transition-colors",
                                    error && "border-destructive focus:ring-destructive"
                                  )}
                                  placeholder={col.label}
                                />
                                {error && <span className="text-[10px] font-medium text-destructive px-1">{error.message}</span>}
                              </div>
                            </TableCell>
                          )
                        })}
                        <TableCell className="p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveRow(rowIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded">
                <AlertCircle className="h-3 w-3" />
                <p>Verify that all data is correct before proceeding. Red cells indicate missing required information.</p>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <p className="font-medium">Processing your data...</p>
                <p className="text-sm text-muted-foreground">This may take a few moments depending on the file size.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("guide")} disabled={isUploading}>
              <X className="mr-2 h-4 w-4" />
              Cancel & Re-upload
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isUploading}>
              Cancel
            </Button>
            {step === "preview" && (
              <Button onClick={handleConfirmUpload} disabled={errors.length > 0 || isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm & Import"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
