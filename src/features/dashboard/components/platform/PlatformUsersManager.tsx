import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, ShieldAlert, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  EDITABLE_PLATFORM_ROLES,
  getPlatformUsers,
  updateUserPlatformRole,
  type EditablePlatformRole,
  type Profile,
} from "../../api/platform.api"
import { useAuth } from "@/features/auth/hooks/useAuth"

export function PlatformUsersManager() {
  const qc = useQueryClient()
  const currentUserId = useAuth((s) => s.user?.id ?? null)
  const [manageUser, setManageUser] = useState<Profile | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ["platform-users"],
    queryFn: getPlatformUsers,
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({
      userId,
      platformRole,
    }: {
      userId: string
      platformRole: EditablePlatformRole | null
    }) => updateUserPlatformRole({ userId, platformRole }),
    onSuccess: () => {
      toast.success("Platform role updated")
      qc.invalidateQueries({ queryKey: ["platform-users"] })
      qc.invalidateQueries({ queryKey: ["platform-stats"] })
      setManageUser(null)
    },
    onError: (e: Error) => toast.error(e.message || "Could not update role"),
  })

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Platform Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage global administrators and support staff.
          </p>
        </div>
        <Button size="sm" type="button" variant="outline" disabled>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Platform Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No platform users found.
                </TableCell>
              </TableRow>
            ) : (
              users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                      </div>
                      {user.first_name} {user.last_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <span className="capitalize font-medium text-primary bg-primary/10 px-2 py-1 rounded-md text-xs">
                      {user.platform_role?.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        user.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" type="button" onClick={() => setManageUser(user)}>
                      Manage role
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {manageUser ? (
        <ManageRoleModal
          key={manageUser.id}
          user={manageUser}
          currentUserId={currentUserId}
          isPending={updateRoleMutation.isPending}
          onClose={() => !updateRoleMutation.isPending && setManageUser(null)}
          onSave={(platformRole) => updateRoleMutation.mutate({ userId: manageUser.id, platformRole })}
        />
      ) : null}
    </div>
  )
}

function ManageRoleModal({
  user,
  currentUserId,
  isPending,
  onClose,
  onSave,
}: {
  user: Profile
  currentUserId: string | null
  isPending: boolean
  onClose: () => void
  onSave: (role: EditablePlatformRole | null) => void
}) {
  function initialRoleSelect(role: string | null): string {
    if (!role) return EDITABLE_PLATFORM_ROLES[1]
    if ((EDITABLE_PLATFORM_ROLES as readonly string[]).includes(role)) return role
    return EDITABLE_PLATFORM_ROLES[1]
  }

  const [selected, setSelected] = useState(() => initialRoleSelect(user.platform_role))

  const isSelf = currentUserId === user.id

  function submit() {
    if (selected === "__clear__") {
      onSave(null)
      return
    }
    onSave(selected as EditablePlatformRole)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => !isPending && onClose()}
    >
      <div
        role="dialog"
        aria-labelledby="manage-role-title"
        className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="manage-role-title" className="text-lg font-semibold mb-1">
          Platform role
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {user.first_name} {user.last_name}{" "}
          <span className="font-mono text-xs opacity-90">({user.email})</span>
        </p>

        <label htmlFor="platform-role-select" className="text-sm font-medium block mb-2">
          Role
        </label>
        <select
          id="platform-role-select"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={isPending}
        >
          {EDITABLE_PLATFORM_ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
          <option value="__clear__">None — remove platform access</option>
        </select>

        {isSelf ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
            You are editing your own account. Removing platform access signs you out of platform admin tabs after
            refresh.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
