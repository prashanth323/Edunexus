import { useState, useRef, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { uploadMyProfileAvatar } from "@/features/auth/api/auth.api"
import { useStudentDocumentsDisplayUrl } from "@/features/students/hooks/useStudentDocumentsDisplayUrl"
import { invalidateAfterPortalAvatarChange } from "@/lib/invalidateProfilePortraits"

type ProfileAvatarUploadProps = {
  schoolId: string
  profileId: string
  currentAvatarUrl: string | null | undefined
  displayName: string
  onUploaded: (url: string) => void
}

export function ProfileAvatarUpload({
  schoolId,
  profileId,
  currentAvatarUrl,
  displayName,
  onUploaded,
}: ProfileAvatarUploadProps) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const displayUrlFromStorage = useStudentDocumentsDisplayUrl(currentAvatarUrl)

  useEffect(() => {
    if (!preview?.startsWith("blob:")) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const initials = displayName
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
      const url = await uploadMyProfileAvatar(schoolId, profileId, file)
      invalidateAfterPortalAvatarChange(qc, { schoolId })
      onUploaded(url)
      toast.success("Profile photo updated")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo")
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="flex flex-col items-center gap-3 sm:items-start"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <div className="relative group">
        <Avatar className="h-24 w-24 border-4 border-background shadow-lg ring-2 ring-primary/15">
          <AvatarImage src={preview ?? displayUrlFromStorage ?? ""} alt={displayName} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xl font-bold">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>

        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 disabled:opacity-50"
          aria-label="Upload profile photo"
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

      <p className="text-xs text-muted-foreground text-center sm:text-left max-w-[200px]">
        Shown in the app header and menus. JPG, PNG, or WebP — max 5 MB.
      </p>
    </div>
  )
}
