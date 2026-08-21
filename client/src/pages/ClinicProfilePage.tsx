import { ChangeEvent, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ClinicProfilePage() {
  const profile = trpc.profile.me.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.profile.update.useMutation({
    onSuccess: () => {
      setMessage("Profile updated.");
      utils.profile.me.invalidate();
    },
  });
  const upload = trpc.profile.uploadPhoto.useMutation({
    onSuccess: () => {
      setMessage("Profile photo updated.");
      utils.profile.me.invalidate();
    },
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (
      !file ||
      file.size > 4_000_000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return;
    const reader = new FileReader();
    reader.onload = () =>
      upload.mutate({
        fileName: file.name,
        contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64: String(reader.result).split(",")[1] ?? "",
        fileSize: file.size,
      });
    reader.readAsDataURL(file);
  };
  if (profile.isLoading)
    return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  const initials = (name || "User")
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Account</p>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the information used by the clinic system.
        </p>
      </div>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Avatar className="h-24 w-24">
            <AvatarImage
              src={profile.data?.profilePhotoUrl ?? undefined}
              alt="Profile photo"
            />
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-2 text-center sm:text-left">
            <Label
              htmlFor="profile-photo"
              className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload photo
            </Label>
            <Input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={choosePhoto}
            />
            <p className="text-xs text-muted-foreground">
              JPG, PNG, or WebP. Maximum 4 MB.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile.data?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={event => setPhone(event.target.value)}
            />
          </div>
          <div>
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ name: name || undefined, phone: phone || undefined })
              }
            >
              {update.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save changes
            </Button>
            {(message || update.error || upload.error) && (
              <p
                className={`mt-2 text-sm ${update.error || upload.error ? "text-destructive" : "text-emerald-700"}`}
              >
                {update.error?.message ?? upload.error?.message ?? message}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
