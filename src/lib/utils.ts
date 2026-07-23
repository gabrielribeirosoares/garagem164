import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(value: string): string {
  if (!value) return "";
  
  let digits = value.replace(/\D/g, "");

  // If digits start with 55 (either from formatted +55 prefix or user pasting 55), strip the country code prefix
  if (digits.startsWith("55") && (value.includes("+55") || digits.length > 2)) {
    digits = digits.slice(2);
  }

  // Limit to max 11 digits (DDD + 9 digits)
  digits = digits.slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `+55 (${digits}`;
  if (digits.length <= 7) return `+55 (${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

