import { useState, useMemo } from "react";
import {
  CDT_CATEGORIES,
  CDT_CODES,
  CDTCode,
  CDTCodeCategory,
  searchCDTCodes,
} from "@shared/cdtCodes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface CDTCodePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCode: (code: CDTCode) => void;
  toothNumber?: string | null;
  surface?: string | null;
}

const CATEGORY_COLORS: Record<CDTCodeCategory, string> = {
  Diagnostic: "bg-blue-500/10 text-blue-700 border-blue-200",
  Preventive: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  Restorative: "bg-amber-500/10 text-amber-700 border-amber-200",
  Endodontics: "bg-purple-500/10 text-purple-700 border-purple-200",
  Periodontics: "bg-teal-500/10 text-teal-700 border-teal-200",
  Prosthodontics: "bg-indigo-500/10 text-indigo-700 border-indigo-200",
  "Implant Services": "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  "Oral Surgery": "bg-rose-500/10 text-rose-700 border-rose-200",
  Orthodontics: "bg-pink-500/10 text-pink-700 border-pink-200",
  "Adjunctive / General": "bg-slate-500/10 text-slate-700 border-slate-200",
};

export function CDTCodePicker({
  open,
  onOpenChange,
  onSelectCode,
  toothNumber,
  surface,
}: CDTCodePickerProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CDTCodeCategory | "All">("All");

  const results = useMemo(() => {
    return searchCDTCodes(search, selectedCategory);
  }, [search, selectedCategory]);

  const handleSelect = (item: CDTCode) => {
    onSelectCode(item);
    onOpenChange(false);
    setSearch("");
    setSelectedCategory("All");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Stethoscope className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                ADA / CDT Dental Procedure Codes
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {toothNumber ? (
                  <span>
                    Selected Tooth <strong className="text-foreground">#{toothNumber}</strong>
                    {surface ? ` (${surface.toUpperCase()} surface)` : ""} ·{" "}
                  </span>
                ) : null}
                Select a standard dental procedure code to auto-populate descriptions and fees.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Search & Category filter */}
        <div className="px-6 pt-4 pb-2 space-y-3 bg-muted/20 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search code (e.g. D2391), name, or keyword (composite, extraction, crown)..."
              className="pl-9 bg-background h-9 text-sm"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground p-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedCategory("All")}
              className={cn(
                "px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border",
                selectedCategory === "All"
                  ? "bg-primary text-primary-foreground border-primary font-medium"
                  : "bg-background text-muted-foreground border-border hover:bg-accent"
              )}
            >
              All ({CDT_CODES.length})
            </button>
            {CDT_CATEGORIES.map(cat => {
              const count = CDT_CODES.filter(c => c.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "bg-background text-muted-foreground border-border hover:bg-accent"
                  )}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Code Results List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 divide-y divide-border/60">
          {results.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No dental procedure codes matching &quot;{search}&quot;.
            </div>
          ) : (
            results.map(item => (
              <div
                key={item.code}
                onClick={() => handleSelect(item)}
                className="py-3 px-2 rounded-lg hover:bg-accent/60 cursor-pointer transition-all flex items-start justify-between gap-3 group"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                      {item.code}
                    </span>
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {item.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] py-0 px-1.5 font-normal", CATEGORY_COLORS[item.category])}
                    >
                      {item.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-foreground">
                    ${item.defaultFee.toFixed(2)}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-primary group-hover:bg-primary group-hover:text-primary-foreground mt-1"
                  >
                    Select
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
