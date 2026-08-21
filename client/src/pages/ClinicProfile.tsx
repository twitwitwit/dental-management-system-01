import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Camera, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, SectionCard } from "@/components/dental";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

type ProfileRecord = {
  id: number;
  name: string | null;
  email: string | null;
  role: "admin" | "dentist" | "receptionist" | "staff" | "patient";
  phone: string | null;
  profilePhotoUrl?: string | null;
};

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || email || "U").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ClinicProfilePage() {
  const profile = trpc.profile.me.useQuery();
  const utils = trpc.useUtils();
  const updateProfile = trpc.profile.updateProfile.useMutation({
    onSuccess: async () => {
      await Promise.all([profile.refetch(), utils.auth.me.invalidate()]);
      toast.success("Profile saved");
    },
    onError: error => toast.error(error.message),
  });
  const uploadPhoto = trpc.profile.uploadPhoto.useMutation({
    onSuccess: async () => {
      await profile.refetch();
      toast.success("Profile photo updated");
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    const data = profile.data as ProfileRecord | null | undefined;
    if (!data) return;
    setForm({ name: data.name ?? "", phone: data.phone ?? "" });
  }, [profile.data]);

  const current = profile.data as ProfileRecord | null | undefined;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("Please enter your name");
      return;
    }
    updateProfile.mutate({ name, phone: form.phone.trim() || null });
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please choose a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Profile photos must be 4 MB or smaller");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      if (comma < 0) {
        toast.error("The selected image could not be read");
        return;
      }
      uploadPhoto.mutate({
        fileName: file.name,
        contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64: result.slice(comma + 1),
        fileSize: file.size,
      });
    };
    reader.onerror = () => toast.error("The selected image could not be read");
    reader.readAsDataURL(file);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Edit profile"
        description="Update the personal details and profile photo used by your clinic account."
      />

      <div className="mx-auto grid max-w-3xl gap-6">
        <SectionCard title="Profile photo">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-24 w-24 border">
              <AvatarImage src={current?.profilePhotoUrl ?? undefined} alt="Profile photo" />
              <AvatarFallback className="text-xl">{initials(current?.name, current?.email)}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label htmlFor="clinic-profile-photo" className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm hover:bg-muted">
                <Camera className="mr-2 h-4 w-4" />
                Choose photo
              </Label>
              <Input
                id="clinic-profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhoto}
                disabled={uploadPhoto.isPending}
              />
              <p className="text-xs text-muted-foreground">JPG, PNG, or WebP up to 4 MB.</p>
              {uploadPhoto.isPending && <p className="text-xs text-primary">Uploading…</p>}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Personal details">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                maxLength={160}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={current?.email ?? ""} readOnly disabled />
              <p className="text-xs text-muted-foreground">Email changes should be handled by an administrator.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-role">Role</Label>
              <Input id="profile-role" value={current?.role ?? ""} readOnly disabled className="capitalize" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-phone">Phone number</Label>
              <Input
                id="profile-phone"
                value={form.phone}
                onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
                maxLength={32}
                placeholder="09XX XXX XXXX"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}
