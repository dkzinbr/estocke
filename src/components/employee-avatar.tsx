"use client";

import Image from "next/image";

type EmployeeAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "size-10 text-sm",
  md: "size-16 text-lg",
  lg: "size-24 text-2xl",
  xl: "size-28 text-3xl",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toneFromName(name: string) {
  const tones = [
    "from-[#0f3b8a] to-[#4d6aff]",
    "from-[#0a1f44] to-[#10b981]",
    "from-[#4d6aff] to-[#6ee7b7]",
    "from-[#0f3b8a] to-[#0a1f44]",
  ];
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % tones.length;
  return tones[hash];
}

export function EmployeeAvatar({
  name,
  photoUrl,
  size = "md",
  className = "",
}: EmployeeAvatarProps) {
  const sizeClass = sizeClasses[size];

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={112}
        height={112}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-adc-border ${className}`}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`${sizeClass} grid place-items-center rounded-full bg-gradient-to-br ${toneFromName(name)} font-semibold text-white ring-2 ring-adc-border ${className}`}
      aria-label={name}
    >
      {initials(name) || "?"}
    </div>
  );
}
