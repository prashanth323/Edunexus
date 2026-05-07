import { PlatformAnnouncements } from "@/features/dashboard/components/platform/PlatformAnnouncements"

export function AnnouncementsPage() {
  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Announcements</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Send one message to many schools. Each notice targets the whole school community at that site.
      </p>
      <PlatformAnnouncements hideOuterHeading />
    </div>
  )
}
