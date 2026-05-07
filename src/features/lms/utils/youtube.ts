/** Best-effort YouTube embed URL from watch / shorts / youtu.be links. */
export function toYoutubeEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    const host = u.hostname.replace(/^www\./, "")
    if (host === "youtu.be") {
      const id = u.pathname.replace("/", "").split("/")[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = u.searchParams.get("v")
      if (v) return `https://www.youtube.com/embed/${v}`
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/)
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`
      const embed = u.pathname.match(/^\/embed\/([^/?]+)/)
      if (embed?.[1]) return `https://www.youtube.com/embed/${embed[1]}`
    }
    return null
  } catch {
    return null
  }
}
