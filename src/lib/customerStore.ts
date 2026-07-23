/**
 * Manage unlinked/deslinked customer IDs per store in local storage.
 * Ensures unlinked customers are immediately hidden across all admin pages (Dashboard, Garagens, etc.).
 */

export function getUnlinkedCustomerIds(storeId: string | undefined): string[] {
  if (!storeId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`unlinked_customers_${storeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addUnlinkedCustomerId(storeId: string | undefined, userId: string): void {
  if (!storeId || typeof window === "undefined") return;
  try {
    const current = getUnlinkedCustomerIds(storeId);
    if (!current.includes(userId)) {
      const updated = [...current, userId];
      localStorage.setItem(`unlinked_customers_${storeId}`, JSON.stringify(updated));
    }
  } catch (err) {
    console.error("Error saving unlinked customer to localStorage:", err);
  }
}
