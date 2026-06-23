import { useEffect, useState, useRef } from "react"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { uploadStudentPhoto } from "../api/studentProfile.api"
import { useStudentDocumentsDisplayUrl } from "../hooks/useStudentDocumentsDisplayUrl"

type PhotoUploadProps = {
  schoolId: string
  studentId: string
  currentPhotoUrl: string | null
  studentName: string
  onUploaded: (url: string) => void
}

export function PhotoUpload({ schoolId, studentId, currentPhotoUrl, studentName, onUploaded }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const displayUrlFromStorage = useStudentDocumentsDisplayUrl(currentPhotoUrl)

  useEffect(() => {
    if (!preview?.startsWith("blob:")) return
    return () => {
      URL.revokeObjectURL(preview)
    }
  }, [preview])

  const initials = studentName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, WebP)")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB")
      return
    }

    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      const url = await uploadStudentPhoto(schoolId, studentId, file)
      onUploaded(url)
      toast.success("Photo updated successfully")
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo")
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className="flex flex-col items-center gap-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="relative group">
        <Avatar className="h-28 w-28 border-4 border-background shadow-lg ring-2 ring-primary/20">
          <AvatarImage src={preview ?? displayUrlFromStorage ?? ""} alt={studentName} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-2xl font-bold">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ""
        }}
      />

      <p className="text-xs text-muted-foreground text-center max-w-[160px]">
        Click camera or drag & drop an image. Max 5 MB.
      </p>
    </div>
  )
}
