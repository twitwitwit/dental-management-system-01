import { useState, type FormEvent } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ROLE_LABELS, useCurrentRole, type Role } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/dental";
import AccessDenied from "@/pages/AccessDenied";
import { Loader2, Plus, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { toast } from "sonner";

const ROLE_VALUES: Role[] = ["admin", "dentist", "receptionist", "staff"];

type AccountDraft = {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone: string;
};

const EMPTY_DRAFT: AccountDraft = {
  name: "",
  email: "",
  password: "",
  role: "staff",
  phone: "",
};

export default function Users() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const isAdmin = role === "admin";
  const users = trpc.users.list.useQuery(undefined, { enabled: isAdmin });
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      void utils.users.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const setStatus = trpc.users.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Account status updated");
      void utils.users.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const createAccount = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Staff account created and recorded in the audit log");
      setCreateOpen(false);
      setDraft(EMPTY_DRAFT);
      void utils.users.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (!isAdmin) return <AccessDenied moduleId="users" />;

  function submitCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draft.password.length < 8) {
      toast.error("Password must contain at least 8 characters");
      return;
    }

    createAccount.mutate({
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      password: draft.password,
      role: draft.role,
      phone: draft.phone.trim() || undefined,
    });
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Users & Staff"
        description="Manage clinic staff accounts and roles. Admin access only."
        actions={
          <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create account
          </Button>
        }
      />

      <SectionCard title="Staff accounts">
        {users.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : users.error ? (
          <EmptyState title="Unable to load staff accounts" description={users.error.message} />
        ) : !users.data?.length ? (
          <EmptyState
            title="No staff accounts found"
            description="Create the first clinic staff account using the button above."
          />
        ) : (
          <div className="overflow-x-auto">
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
                {users.data.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {(user.name ?? "?").trim().slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{user.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">ID {user.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={value =>
                          updateRole.mutate({ id: user.id, role: value as Role })
                        }
                      >
                        <SelectTrigger className="h-8 w-36 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_VALUES.map(value => (
                            <SelectItem key={value} value={value}>
                              {ROLE_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(user.lastSignedIn)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.isActive ? "confirmed" : "cancelled"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5"
                        onClick={() =>
                          setStatus.mutate({ id: user.id, isActive: !user.isActive })
                        }
                        disabled={setStatus.isPending || user.id === undefined}
                      >
                        {user.isActive ? (
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
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          New accounts are created with a local password, assigned a role, and recorded in the
          append-only audit log. Password values are never included in audit metadata.
        </p>
      </SectionCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Create staff account
            </DialogTitle>
            <DialogDescription>
              Only administrators can create accounts. The password is stored as a hash and is never
              written to the audit log.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={submitCreateAccount}>
            <div className="grid gap-1.5">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                value={draft.name}
                onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Maria Santos"
                required
                minLength={2}
                maxLength={128}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="staff-email">Email address</Label>
              <Input
                id="staff-email"
                type="email"
                value={draft.email}
                onChange={event => setDraft(current => ({ ...current, email: event.target.value }))}
                placeholder="staff@clinic.local"
                required
                maxLength={320}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="staff-password">Temporary password</Label>
              <Input
                id="staff-password"
                type="password"
                value={draft.password}
                onChange={event => setDraft(current => ({ ...current, password: event.target.value }))}
                placeholder="At least 8 characters"
                required
                minLength={8}
                maxLength={128}
              />
              <p className="text-xs text-muted-foreground">
                Give the staff member this password securely. They can use it to sign in immediately.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="staff-role">Role</Label>
              <Select
                value={draft.role}
                onValueChange={value => setDraft(current => ({ ...current, role: value as Role }))}
              >
                <SelectTrigger id="staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_VALUES.map(value => (
                    <SelectItem key={value} value={value}>
                      {ROLE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="staff-phone">Phone number (optional)</Label>
              <Input
                id="staff-phone"
                value={draft.phone}
                onChange={event => setDraft(current => ({ ...current, phone: event.target.value }))}
                placeholder="09XX XXX XXXX"
                maxLength={32}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAccount.isPending}>
                {createAccount.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
