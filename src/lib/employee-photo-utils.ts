export const EMPLOYEE_PHOTOS_DIR = "fotos-funcionarios";
export const EMPLOYEE_PHOTOS_PUBLIC_PATH = `/${EMPLOYEE_PHOTOS_DIR}`;

export function isEmployeePhotoPath(value: string | null | undefined) {
  return Boolean(
    value &&
      value.startsWith(`${EMPLOYEE_PHOTOS_PUBLIC_PATH}/`) &&
      !value.includes(".."),
  );
}

export function isEmployeePhotoDataUrl(value: string | null | undefined) {
  return Boolean(value?.startsWith("data:image/"));
}

export function isEmployeePhotoValue(value: string | null | undefined) {
  return isEmployeePhotoPath(value) || isEmployeePhotoDataUrl(value);
}
