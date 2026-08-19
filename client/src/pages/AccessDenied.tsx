import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { Link } from "wouter";

export default function AccessDenied({ moduleId }: { moduleId: string }) {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-14 w-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-rose-600" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Access restricted</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Your role does not include access to the “{moduleId}” module. Contact an
          administrator if you believe this is a mistake.
        </p>
        <Button asChild className="mt-5">
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>
    </DashboardLayout>
  );
}
