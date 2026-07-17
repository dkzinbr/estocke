import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { ApiError } from "@/lib/api";

export const EMPLOYEE_PHOTOS_DIR = "fotos-funcionarios";
export const EMPLOYEE_PHOTOS_PUBLIC_PATH = `/${EMPLOYEE_PHOTOS_DIR}`;

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

export function isEmployeePhotoPath(value: string | null | undefined) {
  return Boolean(
    value &&
      value.startsWith(`${EMPLOYEE_PHOTOS_PUBLIC_PATH}/`) &&
      !value.includes(".."),
  );
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

  const filename = `${randomUUID()}${extension}`;
  const directory = photosRoot();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));

  return `${EMPLOYEE_PHOTOS_PUBLIC_PATH}/${filename}`;
}

export async function deleteEmployeePhoto(photoUrl: string | null | undefined) {
  if (!isEmployeePhotoPath(photoUrl)) return;

  const filename = photoUrl!.slice(EMPLOYEE_PHOTOS_PUBLIC_PATH.length + 1);
  if (!filename || filename.includes("/") || filename.includes("\\")) return;

  try {
    await unlink(path.join(photosRoot(), filename));
  } catch {
    // ignore missing files
  }
}
