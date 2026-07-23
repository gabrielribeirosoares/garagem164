export const SUPPORT_WHATSAPP_NUMBER = "5548991344833";

/**
 * Checks if a store is suspended or expired.
 * A store is considered suspended if:
 * 1. subscription_status is explicitly 'blocked'
 * 2. subscription_expires_at is in the past and subscription_status is not 'active'
 */
export function isStoreSuspended(store: any): boolean {
  if (!store) return false;

  const rawStatus = store.subscription_status || "trial";
  if (rawStatus === "blocked") return true;

  if (store.subscription_expires_at) {
    const expiresAt = new Date(store.subscription_expires_at).getTime();
    if (!isNaN(expiresAt) && expiresAt < Date.now() && rawStatus !== "active") {
      return true;
    }
  }

  return false;
}
