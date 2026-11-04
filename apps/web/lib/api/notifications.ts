import { apiUrl, SESSION_COOKIE } from "./config";

/**
 * Notifications (NOTIF-002) against the NOTIF-001 API.
 * The unread count for the first paint is read server-side (like GET /me); every
 * later call runs in the browser through the same-origin /api proxy, so the
 * session cookie goes along by itself and the browser never needs API_URL.
 */

/** One item of GET /notifications (NotificationOut in services/api/notifications.py). */
export type Notification = {
  id: number;
  title: string;
  message: string;
  /** ISO 8601 timestamp. */
  created_at: string;
  read: boolean;
};

type UnreadCount = { unread: number };

/**
 * The signed-in user's unread count for the first render, server-side.
 * Any failure counts as 0: a missing badge is better than a broken page.
 */
export async function getUnreadCount(
  sessionToken: string | undefined,
): Promise<number> {
  if (!sessionToken) return 0;
  try {
    const response = await fetch(`${apiUrl()}/notifications/unread-count`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
      cache: "no-store",
    });
    if (!response.ok) return 0;
    return ((await response.json()) as UnreadCount).unread;
  } catch {
    return 0;
  }
}

/** The unread count again, from the browser (after marking one read). */
export async function fetchUnreadCount(): Promise<number> {
  const response = await fetch("/api/notifications/unread-count", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `GET /notifications/unread-count failed with HTTP ${response.status}`,
    );
  }
  return ((await response.json()) as UnreadCount).unread;
}

/** The signed-in user's notifications, newest first (at most 50, set by the API). */
export async function fetchNotifications(): Promise<Notification[]> {
  const response = await fetch("/api/notifications", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GET /notifications failed with HTTP ${response.status}`);
  }
  return (await response.json()) as Notification[];
}

/** Marks one notification read; the API answers with the updated item. */
export async function markNotificationRead(id: number): Promise<Notification> {
  const response = await fetch(`/api/notifications/${id}/read`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `POST /notifications/${id}/read failed with HTTP ${response.status}`,
    );
  }
  return (await response.json()) as Notification;
}

/** Short age for the list, e.g. "just now", "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
