import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
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
  Archive,
  Box,
  Loader2,
  Package,
  PlusCircle,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export default function Inventory() {
  const utils = trpc.useUtils();
  const role = useCurrentRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<number | null>(null);
  const [adjustType, setAdjustType] = useState<"stock_in" | "stock_out" | "adjustment">("stock_in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "",
    sku: "",
    quantity: "",
    unit: "pcs",
    threshold: "",
    unitCost: "",
    supplier: "",
  });

  const items = trpc.inventory.items.useQuery(undefined, { enabled: !!role });
  const movements = trpc.inventory.movements.useQuery({}, { enabled: !!role });

  const canManage = role === "admin" || role === "dentist" || role === "staff";

  const create = trpc.inventory.create.useMutation({
    onSuccess: () => {
      toast.success("Inventory item added");
      setDialogOpen(false);
      setForm({ name: "", category: "", sku: "", quantity: "", unit: "pcs", threshold: "", unitCost: "", supplier: "" });
      utils.inventory.items.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const adjust = trpc.inventory.adjust.useMutation({
    onSuccess: res => {
      toast.success(`Stock updated — new quantity: ${res.newQuantity}`);
      setAdjustItem(null);
      setAdjustQty("");
      setAdjustReason("");
      utils.inventory.items.invalidate();
      utils.inventory.movements.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const lowStock = useMemo(
    () => (items.data ?? []).filter(i => i.quantity <= i.lowStockThreshold),
    [items.data],
  );

  const totalValue = useMemo(
    () => (items.data ?? []).reduce((acc, i) => acc + i.quantity * Number(i.unitCost), 0),
    [items.data],
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Inventory"
        description="Supplies, materials, and stock levels."
        actions={
          canManage ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button className="gap-1.5" onClick={() => setDialogOpen(true)}>
                <PlusCircle className="h-4 w-4" /> Add Item
              </Button>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Inventory Item</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-3.5"
                  onSubmit={e => {
                    e.preventDefault();
                    create.mutate({
                      name: form.name.trim(),
                      category: form.category || null,
                      sku: form.sku || null,
                      quantity: Number(form.quantity) || 0,
                      unit: form.unit || "pcs",
                      lowStockThreshold: Number(form.threshold) || 0,
                      unitCost: Number(form.unitCost) || 0,
                      supplier: form.supplier || null,
                    });
                  }}
                >
                  <div className="grid gap-1.5">
                    <Label>Item name *</Label>
                    <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Category</Label>
                      <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>SKU</Label>
                      <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Quantity *</Label>
                      <Input type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Unit</Label>
                      <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Low-stock at</Label>
                      <Input type="number" min={0} value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Unit cost ($)</Label>
                      <Input type="number" min={0} step="0.01" value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Supplier</Label>
                      <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
                    </div>
                  </div>
                  <Button type="submit" disabled={create.isPending || !form.name.trim()} className="gap-1.5">
                    {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
                    Add item
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-[0_2px_12px_-4px_rgba(13,60,67,0.08)]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Package className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Items tracked</p>
              <p className="text-lg font-bold">{(items.data ?? []).length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-[0_2px_12px_-4px_rgba(13,60,67,0.08)]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-[oklch(0.62_0.14_25_/_0.12)] text-[oklch(0.55_0.16_25)] flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Low stock alerts</p>
              <p className="text-lg font-bold">{lowStock.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-[0_2px_12px_-4px_rgba(13,60,67,0.08)]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-[oklch(0.82_0.12_75_/_0.15)] text-[oklch(0.62_0.12_75)] flex items-center justify-center">
              <Archive className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stock value</p>
              <p className="text-lg font-bold">{formatMoney(totalValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-900">
            <span className="font-semibold">Low stock alert:</span>{" "}
            {lowStock.map(i => i.name).join(", ")} need restocking.
          </div>
        </div>
      )}

      <SectionCard title="Stock levels">
        {items.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !items.data?.length ? (
          <EmptyState title="No inventory items yet" description="Add supplies and materials to track stock." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.data.map(item => {
                const isLow = item.quantity <= item.lowStockThreshold;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.category ? (
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.sku || "—"}</TableCell>
                    <TableCell>{item.supplier || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(item.unitCost)}</TableCell>
                    <TableCell className="text-right">{formatMoney(item.quantity * Number(item.unitCost))}</TableCell>
                    <TableCell>
                      <StatusBadge status={isLow ? "low" : "healthy"} />
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          onClick={() => {
                            setAdjustItem(item.id);
                            setAdjustQty("");
                            setAdjustReason("");
                            setAdjustType("stock_in");
                          }}
                        >
                          <Truck className="h-3.5 w-3.5" /> Adjust stock
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <div className="mt-6">
        <SectionCard title="Recent stock movements">
          {!movements.data?.length ? (
            <EmptyState title="No stock movements recorded yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.data.map(m => {
                  const item = items.data?.find(i => i.id === m.itemId);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm font-medium">{item?.name ?? `#${m.itemId}`}</TableCell>
                      <TableCell>
                        <StatusBadge status={m.type} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {m.type === "stock_out" ? "-" : m.type === "stock_in" ? "+" : ""}
                        {m.quantity}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.reason || "—"}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustItem} onOpenChange={open => !open && setAdjustItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3.5"
            onSubmit={e => {
              e.preventDefault();
              if (adjustItem === null) return;
              const qty = Number(adjustQty);
              if (!qty || qty <= 0) {
                toast.error("Enter a quantity greater than zero");
                return;
              }
              adjust.mutate({
                itemId: adjustItem,
                type: adjustType,
                quantity: qty,
                reason: adjustReason || null,
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={adjustType} onValueChange={v => setAdjustType(v as "stock_in")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_in">Stock in</SelectItem>
                  <SelectItem value="stock_out">Stock out</SelectItem>
                  <SelectItem value="adjustment">Set quantity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={adjustQty} onChange={e => setAdjustQty(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Reason (optional)</Label>
              <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            </div>
            <Button type="submit" disabled={adjust.isPending} className="gap-1.5">
              {adjust.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Apply adjustment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
