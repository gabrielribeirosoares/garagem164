import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(value: string): string {
  if (!value) return "";
  
  const hasPlus = value.trim().startsWith("+");
  let digits = value.replace(/\D/g, "");

  // If user starts with '+', preserve international format (+XX...)
  if (hasPlus) {
    digits = digits.slice(0, 15); // E.164 max length
    if (digits.length === 0) return "+";
    return `+${digits}`;
  }

  // Standard national format: (XX) XXXXX-XXXX
  digits = digits.slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function getPhoneFlag(value: string): string {
  if (!value) return "🇧🇷";
  const val = value.trim();

  if (!val.startsWith("+")) {
    return "🇧🇷";
  }

  if (val.startsWith("+55")) return "🇧🇷";
  if (val.startsWith("+351")) return "🇵🇹";
  if (val.startsWith("+54")) return "🇦🇷";
  if (val.startsWith("+598")) return "🇺🇾";
  if (val.startsWith("+56")) return "🇨🇱";
  if (val.startsWith("+57")) return "🇨🇴";
  if (val.startsWith("+52")) return "🇲🇽";
  if (val.startsWith("+51")) return "🇵🇪";
  if (val.startsWith("+58")) return "🇻🇪";
  if (val.startsWith("+595")) return "🇵🇾";
  if (val.startsWith("+591")) return "🇧🇴";
  if (val.startsWith("+593")) return "🇪🇨";
  if (val.startsWith("+507")) return "🇵🇦";
  if (val.startsWith("+1")) return "🇺🇸";
  if (val.startsWith("+34")) return "🇪🇸";
  if (val.startsWith("+44")) return "🇬🇧";
  if (val.startsWith("+39")) return "🇮🇹";
  if (val.startsWith("+33")) return "🇫🇷";
  if (val.startsWith("+49")) return "🇩🇪";
  if (val.startsWith("+81")) return "🇯🇵";
  if (val.startsWith("+86")) return "🇨🇳";
  if (val.startsWith("+41")) return "🇨🇭";

  return "🌐";
}

