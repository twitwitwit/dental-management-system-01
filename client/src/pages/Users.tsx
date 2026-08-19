import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/dental";
import { Loader2, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/roles";

const ROLE_VALUES = ["admin", "dentist", "receptionist", "staff"] as const;

export default function Users() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const users = trpc.users.list.useQuery(undefined, { enabled: role === "admin" });

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
    onError: e => toast.error(e.message),
  });

  const setStatus = trpc.users.setStatus.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
    onError: e => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Users & Staff"
        description="Manage clinic staff accounts and roles. Admin access only."
      />

      <SectionCard title="Staff accounts">
        {users.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !users.data?.length ? (
          <EmptyState title="No staff accounts found" description="Logged-in clinic staff appear here as they sign in." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Staff member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {(u.name ?? "?").trim().slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{u.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">ID {u.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={v =>
                        updateRole.mutate({ id: u.id, role: v as "admin" })
                      }
                    >
                      <SelectTrigger className="h-8 w-36 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_VALUES.map(r => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(u.lastSignedIn)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.isActive ? "confirmed" : "cancelled"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5"
                      onClick={() =>
                        setStatus.mutate({ id: u.id, isActive: !u.isActive })
                      }
                    >
                      {u.isActive ? (
                        <>
                          <ShieldOff className="h-3.5 w-3.5" /> Deactivate
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" /> Activate
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          New staff join the system by signing in with their account; the admin can then assign the
          appropriate role (Admin, Dentist, Receptionist, or Staff).
        </p>
      </SectionCard>
    </DashboardLayout>
  );
}
