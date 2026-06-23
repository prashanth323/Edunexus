import { useState, useRef } from "react"
import { FileUp, Loader2, Trash2, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadStudentDocument, deleteStudentDocument } from "../api/studentProfile.api"

type DocumentItem = {
  label: string
  filename: string
  url: string
  size: number
  type: string
  uploaded_at: string
}

type DocumentUploadProps = {
  schoolId: string
  studentId: string
  documents: DocumentItem[]
  onUpdate: () => void
}

const FILE_ICONS: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "image/jpeg": ImageIcon,
  "image/png": ImageIcon,
  "image/webp": ImageIcon,
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentUpload({ schoolId, studentId, documents, onUpdate }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [label, setLabel] = useState("")
  const [deleting, setDeleting] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB")
      return
    }

    const docLabel = label.trim() || file.name.replace(/\.[^.]+$/, "")
    setUploading(true)

    try {
      await uploadStudentDocument(schoolId, studentId, file, docLabel)
      toast.success(`"${docLabel}" uploaded`)
      setLabel("")
      onUpdate()
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(index: number) {
    setDeleting(index)
    try {
      await deleteStudentDocument(studentId, index)
      toast.success("Document removed")
      onUpdate()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete")
    } finally {
      setDeleting(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        className="border-2 border-dashed rounded-xl p-6 text-center hover:border-primary/50 transition-colors bg-muted/20"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <FileUp className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">
          Drag & drop or click to upload documents (PDF, images — max 10 MB)
        </p>
        <div className="flex items-center gap-2 justify-center max-w-sm mx-auto">
          <Input
            placeholder="Document label (e.g. Birth Certificate)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="text-sm"
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Browse"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
            e.target.value = ""
          }}
        />
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Uploaded documents ({documents.length})</Label>
          <div className="divide-y rounded-lg border">
            {documents.map((doc, i) => {
              const Icon = FILE_ICONS[doc.type] || FileIcon
              return (
                <div key={i} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.filename} · {formatSize(doc.size)} · {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" title="View">
                        <FileText className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={deleting === i}
                      onClick={() => handleDelete(i)}
                    >
                      {deleting === i ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
