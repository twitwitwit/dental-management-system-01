import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useCurrentRole } from "@/lib/roles";
import { formatDate, formatMoney } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/dental";
import {
  ClipboardList,
  FileCheck2,
  Landmark,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export default function Insurance() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();

  const [providerDialog, setProviderDialog] = useState(false);
  const [policyDialog, setPolicyDialog] = useState(false);
  const [claimDialog, setClaimDialog] = useState(false);

  const [providerForm, setProviderForm] = useState({
    name: "",
    contactPhone: "",
    website: "",
  });

  const [policyForm, setPolicyForm] = useState({
    patientId: "",
    providerId: "",
    policyNumber: "",
    groupNumber: "",
    memberName: "",
    relationship: "self",
    coPay: "",
    deductible: "",
  });

  const [claimForm, setClaimForm] = useState({
    patientId: "",
    patientInsuranceId: "",
    amount: "",
    description: "",
  });

  const providers = trpc.insurance.providers.useQuery(undefined, { enabled: !!role });
  const policies = trpc.insurance.patientInsurance.useQuery({}, { enabled: !!role });
  const claims = trpc.insurance.claims.useQuery({}, { enabled: !!role });
  const patients = trpc.patients.list.useQuery({}, { enabled: !!role });

  const canAddProvider = role === "admin" || role === "receptionist";
  const canAddPolicy = canAddProvider;
  const canAddClaim = canAddProvider;

  const addProvider = trpc.insurance.addProvider.useMutation({
    onSuccess: () => {
      toast.success("Insurance provider saved");
      setProviderDialog(false);
      setProviderForm({ name: "", contactPhone: "", website: "" });
      utils.insurance.providers.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const addPolicy = trpc.insurance.addPatientInsurance.useMutation({
    onSuccess: () => {
      toast.success("Patient policy saved");
      setPolicyDialog(false);
      setPolicyForm({
        patientId: "",
        providerId: "",
        policyNumber: "",
        groupNumber: "",
        memberName: "",
        relationship: "self",
        coPay: "",
        deductible: "",
      });
      utils.insurance.patientInsurance.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const addClaim = trpc.insurance.createClaim.useMutation({
    onSuccess: res => {
      toast.success(`Claim ${res.claimNumber} filed`);
      setClaimDialog(false);
      setClaimForm({ patientId: "", patientInsuranceId: "", amount: "", description: "" });
      utils.insurance.claims.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const updateClaim = trpc.insurance.updateClaimStatus.useMutation({
    onSuccess: () => utils.insurance.claims.invalidate(),
    onError: e => toast.error(e.message),
  });

  const patientById = useMemo(() => {
    const map = new Map<number, { firstName: string; lastName: string }>();
    (patients.data ?? []).forEach(p => map.set(p.id, p));
    return map;
  }, [patients.data]);

  const providerById = useMemo(() => {
    const map = new Map<number, { name: string }>();
    (providers.data ?? []).forEach(p => map.set(p.id, p));
    return map;
  }, [providers.data]);

  const policyById = useMemo(() => {
    const map = new Map<number, { policyNumber: string; providerId: number }>();
    (policies.data ?? []).forEach(p => map.set(p.id, p));
    return map;
  }, [policies.data]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Insurance Management"
        description="Maintain coverage details and track claims for insured patients."
        actions={
          <div className="flex flex-wrap gap-2">
            {canAddProvider ? (
              <Button variant="outline" className="gap-1.5" onClick={() => setProviderDialog(true)}>
                <Landmark className="h-4 w-4" /> Add Provider
              </Button>
            ) : undefined}
            {canAddPolicy ? (
              <Button variant="outline" className="gap-1.5" onClick={() => setPolicyDialog(true)}>
                <ShieldCheck className="h-4 w-4" /> Add Policy
              </Button>
            ) : undefined}
            {canAddClaim ? (
              <Button className="gap-1.5" onClick={() => setClaimDialog(true)}>
                <ClipboardList className="h-4 w-4" /> File Claim
              </Button>
            ) : undefined}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard title="Insurance providers">
          {!providers.data?.length ? (
            <EmptyState title="No insurance providers recorded" description="Add a provider before attaching coverage to a patient." />
          ) : (
            <ul className="divide-y divide-border/70">
              {providers.data.map(p => (
                <li key={p.id} className="py-3">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.contactPhone || "No phone"} · {p.website || "No website"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Patient policies">
          {!policies.data?.length ? (
            <EmptyState title="No patient policies recorded" />
          ) : (
            <ul className="divide-y divide-border/70">
              {policies.data.map(p => {
                const patient = patientById.get(p.patientId);
                const provider = providerById.get(p.providerId);
                return (
                  <li key={p.id} className="py-3">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold">
                        {patient ? `${patient.firstName} ${patient.lastName}` : `#${p.patientId}`}
                      </p>
                      <StatusBadge status={p.isActive ? "confirmed" : "no_show"} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {provider?.name ?? "Unknown"} · {p.policyNumber}
                      {p.groupNumber ? ` · Group ${p.groupNumber}` : ""}
                      {p.memberName ? ` · ${p.memberName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Co-pay {formatMoney(p.coPay)} · Deductible {formatMoney(p.deductible)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Claims"
          className="xl:col-span-1"
        >
          {!claims.data?.length ? (
            <EmptyState title="No claims filed" />
          ) : (
            <ul className="divide-y divide-border/70">
              {claims.data.map(c => {
                const patient = patientById.get(c.patientId);
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold">{c.claimNumber}</p>
                      <Select
                        value={c.status}
                        onValueChange={v =>
                          updateClaim.mutate({
                            id: c.id,
                            status: v as "pending" | "submitted" | "approved" | "denied",
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-28 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="denied">Denied</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {patient ? `${patient.firstName} ${patient.lastName}` : `#${c.patientId}`} ·{" "}
                      {formatMoney(c.amount)} · {formatDate(c.filedDate ?? c.createdAt)}
                    </p>
                    {c.description ? (
                      <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Add provider dialog */}
      <Dialog open={providerDialog} onOpenChange={setProviderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add insurance provider</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              addProvider.mutate({
                name: providerForm.name.trim(),
                contactPhone: providerForm.contactPhone || null,
                website: providerForm.website || null,
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label>Provider name *</Label>
              <Input required value={providerForm.name} onChange={e => setProviderForm({ ...providerForm, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input value={providerForm.contactPhone} onChange={e => setProviderForm({ ...providerForm, contactPhone: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Website</Label>
              <Input value={providerForm.website} onChange={e => setProviderForm({ ...providerForm, website: e.target.value })} />
            </div>
            <Button type="submit" disabled={addProvider.isPending || !providerForm.name.trim()} className="gap-1.5">
              {addProvider.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
              Add provider
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add policy dialog */}
      <Dialog open={policyDialog} onOpenChange={setPolicyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach patient coverage</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              const patientId = Number(policyForm.patientId);
              const providerId = Number(policyForm.providerId);
              if (!patientId || !providerId || !policyForm.policyNumber.trim()) {
                toast.error("Patient, provider, and policy number are required");
                return;
              }
              addPolicy.mutate({
                patientId,
                providerId,
                policyNumber: policyForm.policyNumber.trim(),
                groupNumber: policyForm.groupNumber || null,
                memberName: policyForm.memberName || null,
                relationship: policyForm.relationship,
                coPay: Number(policyForm.coPay) || 0,
                deductible: Number(policyForm.deductible) || 0,
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Patient *</Label>
                <Select value={policyForm.patientId} onValueChange={v => setPolicyForm({ ...policyForm, patientId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {(patients.data ?? []).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.firstName} {p.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Provider *</Label>
                <Select value={policyForm.providerId} onValueChange={v => setPolicyForm({ ...policyForm, providerId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {(providers.data ?? []).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Policy number *</Label>
              <Input value={policyForm.policyNumber} onChange={e => setPolicyForm({ ...policyForm, policyNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Group number</Label>
                <Input value={policyForm.groupNumber} onChange={e => setPolicyForm({ ...policyForm, groupNumber: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Member name</Label>
                <Input value={policyForm.memberName} onChange={e => setPolicyForm({ ...policyForm, memberName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Co-pay (₱)</Label>
                <Input type="number" min={0} value={policyForm.coPay} onChange={e => setPolicyForm({ ...policyForm, coPay: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Deductible (₱)</Label>
                <Input type="number" min={0} value={policyForm.deductible} onChange={e => setPolicyForm({ ...policyForm, deductible: e.target.value })} />
              </div>
            </div>
            <Button type="submit" disabled={addPolicy.isPending} className="gap-1.5">
              {addPolicy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Add policy
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* File claim dialog */}
      <Dialog open={claimDialog} onOpenChange={setClaimDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>File an insurance claim</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              const patientId = Number(claimForm.patientId);
              if (!patientId) {
                toast.error("Select a patient");
                return;
              }
              addClaim.mutate({
                patientId,
                patientInsuranceId: claimForm.patientInsuranceId
                  ? Number(claimForm.patientInsuranceId)
                  : null,
                amount: Number(claimForm.amount) || 0,
                description: claimForm.description || null,
                filedDate: new Date().toISOString().slice(0, 10),
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label>Patient *</Label>
              <Select value={claimForm.patientId} onValueChange={v => setClaimForm({ ...claimForm, patientId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {(patients.data ?? []).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Policy (optional)</Label>
              <Select
                value={claimForm.patientInsuranceId}
                onValueChange={v => setClaimForm({ ...claimForm, patientInsuranceId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent>
                  {(policies.data ?? []).map(p => {
                    const patient = patientById.get(p.patientId);
                    return (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {patient ? `${patient.firstName} ${patient.lastName}` : `#${p.patientId}`} —{" "}
                        {p.policyNumber}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Claim amount (₱) *</Label>
              <Input type="number" min={0} step="0.01" value={claimForm.amount} onChange={e => setClaimForm({ ...claimForm, amount: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Input value={claimForm.description} onChange={e => setClaimForm({ ...claimForm, description: e.target.value })} />
            </div>
            <Button type="submit" disabled={addClaim.isPending} className="gap-1.5">
              {addClaim.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              File claim
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
