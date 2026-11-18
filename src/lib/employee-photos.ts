import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { ApiError } from "@/lib/api";
import {
  EMPLOYEE_PHOTOS_DIR,
  EMPLOYEE_PHOTOS_PUBLIC_PATH,
  isEmployeePhotoDataUrl,
  isEmployeePhotoPath,
  isEmployeePhotoValue,
} from "@/lib/employee-photo-utils";

export {
  EMPLOYEE_PHOTOS_DIR,
  EMPLOYEE_PHOTOS_PUBLIC_PATH,
  isEmployeePhotoDataUrl,
  isEmployeePhotoPath,
  isEmployeePhotoValue,
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function photosRoot() {
  return path.join(process.cwd(), "public", EMPLOYEE_PHOTOS_DIR);
}

function shouldStorePhotoInline() {
  // Na Vercel o filesystem é efêmero — guarda a foto no banco via data URL.
  return process.env.VERCEL === "1" || process.env.EMPLOYEE_PHOTOS_INLINE === "1";
}

export async function saveEmployeePhoto(file: File) {
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    throw new ApiError(
      "Formato inválido. Use JPG, PNG, WEBP ou GIF.",
      400,
    );
  }

  if (file.size > MAX_BYTES) {
    throw new ApiError("A foto deve ter no máximo 5 MB.", 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (shouldStorePhotoInline()) {
    return `data:${file.type};base64,${bytes.toString("base64")}`;
  }

  const filename = `${randomUUID()}${extension}`;
  const directory = photosRoot();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes);

  return `${EMPLOYEE_PHOTOS_PUBLIC_PATH}/${filename}`;
}

export async function deleteEmployeePhoto(photoUrl: string | null | undefined) {
  if (isEmployeePhotoDataUrl(photoUrl)) return;
  if (!isEmployeePhotoPath(photoUrl)) return;

  const filename = photoUrl!.slice(EMPLOYEE_PHOTOS_PUBLIC_PATH.length + 1);
  if (!filename || filename.includes("/") || filename.includes("\\")) return;

  try {
    await unlink(path.join(photosRoot(), filename));
  } catch {
    // ignore missing files
  }
}
