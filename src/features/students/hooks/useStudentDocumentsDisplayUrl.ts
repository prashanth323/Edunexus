import { useEffect, useState } from "react"

import { getSignedStudentDocumentsUrl } from "../api/studentProfile.api"

/**
 * Resolves `student-documents` URLs for display when the bucket is private (signed GET).
 */
export function useStudentDocumentsDisplayUrl(original: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const raw = original?.trim()

    if (!raw) {
      setResolved(null)
      return undefined
    }

    void (async () => {
      const signed = await getSignedStudentDocumentsUrl(raw)
      if (cancelled) return
      setResolved(signed ?? (raw.startsWith("http") ? raw : null))
    })()

    return () => {
      cancelled = true
    }
  }, [original])

  return resolved
}
