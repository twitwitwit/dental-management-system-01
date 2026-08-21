import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\\/g, "/");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function localRoot(): string {
  return path.resolve(process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "uploads"));
}

function safeLocalPath(key: string): string {
  const root = localRoot();
  const candidate = path.resolve(root, key);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage path");
  }
  return candidate;
}

async function forgePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const forgeUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  const blob = typeof data === "string"
    ? new Blob([data], { type: contentType })
    : new Blob([data as any], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return forgePut(relKey, data, contentType);
  }

  const key = appendHashSuffix(normalizeKey(relKey));
  const target = safeLocalPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  const bytes = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await writeFile(target, bytes);
  return { key, url: `/local-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return {
    key,
    url: ENV.forgeApiUrl && ENV.forgeApiKey
      ? `/manus-storage/${key}`
      : `/local-storage/${key}`,
  };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return `/local-storage/${key}`;

  const getUrl = new URL("v1/storage/presign/get", `${ENV.forgeApiUrl.replace(/\/+$/, "")}/`);
  getUrl.searchParams.set("path", key);
  const response = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
  });
  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`Storage signed URL failed (${response.status}): ${msg}`);
  }
  const { url } = (await response.json()) as { url: string };
  if (!url) throw new Error("Forge returned empty signed URL");
  return url;
}

export function getLocalStoragePath(key: string): string {
  return safeLocalPath(normalizeKey(key));
}
