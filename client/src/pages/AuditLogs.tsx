import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/dental";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useCurrentRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import AccessDenied from "@/pages/AccessDenied";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";

function prettyMetadata(value: string | null) {
  if (!value) return "—";

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function metadataSummary(value: string | null) {
  if (!value) return "—";

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const procedure = typeof parsed.procedure === "string" ? parsed.procedure : null;
    const changedFields = Array.isArray(parsed.changedFields)
      ? parsed.changedFields.filter((field): field is string => typeof field === "string")
      : [];

    if (procedure && changedFields.length > 0) {
      return `${procedure} · ${changedFields.length} field${changedFields.length === 1 ? "" : "s"} changed`;
    }

    if (procedure) return procedure;

    const keys = Object.keys(parsed);
    return keys.length > 0 ? `${keys.length} metadata field${keys.length === 1 ? "" : "s"}` : "JSON metadata";
  } catch {
    return value.length > 42 ? `${value.slice(0, 42)}…` : value;
  }
}

function MetadataCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;

  return (
    <details className="max-w-[220px]">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1 truncate" title={metadataSummary(value)}>
          {metadataSummary(value)}
        </span>
        <span className="shrink-0 text-[11px] font-medium text-primary">View</span>
      </summary>
      <pre className="mt-2 max-h-48 max-w-[220px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
        {prettyMetadata(value)}
      </pre>
    </details>
  );
}

export default function AuditLogs() {
  const role = useCurrentRole();
  const logs = trpc.audit.list.useQuery(
    { limit: 200 },
    { enabled: role === "admin" },
  );

  if (role !== "admin") return <AccessDenied moduleId="audit" />;

  return (
    <DashboardLayout>
      <PageHeader
        title="Audit Log"
        description="Read-only security ledger of access, changes, prints, and denied actions."
        actions={
          <Button variant="outline" onClick={() => logs.refetch()} disabled={logs.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${logs.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <SectionCard title="Immutable activity history">
        <p className="mb-4 text-sm text-muted-foreground">
          Audit records cannot be edited or deleted from the application.
        </p>
        {logs.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : logs.error ? (
          <EmptyState title="Unable to load audit history" description={logs.error.message} />
        ) : !logs.data?.length ? (
          <EmptyState title="No audit events yet" description="Successful and denied activity will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Time</TableHead>
                  <TableHead className="whitespace-nowrap">Actor</TableHead>
                  <TableHead className="whitespace-nowrap">Action</TableHead>
                  <TableHead className="whitespace-nowrap">Resource</TableHead>
                  <TableHead className="max-w-[180px]">Purpose</TableHead>
                  <TableHead className="whitespace-nowrap">Outcome</TableHead>
                  <TableHead className="w-[220px] max-w-[220px]">Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(log.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>{log.actorUserId ? `User #${log.actorUserId}` : "System"}</span>
                        {log.actorRole && <Badge variant="outline">{log.actorRole}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{log.action}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.resourceType}{log.resourceId ? ` #${log.resourceId}` : ""}
                    </TableCell>
                    <TableCell className="max-w-[180px] whitespace-normal break-words">
                      {log.purpose || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.outcome} />
                    </TableCell>
                    <TableCell className="w-[220px] max-w-[220px] align-top">
                      <MetadataCell value={log.metadata} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </DashboardLayout>
  );
}

