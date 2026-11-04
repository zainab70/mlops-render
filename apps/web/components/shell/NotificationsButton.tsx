"use client";

import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  type Notification,
} from "@/lib/api/notifications";
import {
  NotificationsList,
  type NotificationsStatus,
} from "./NotificationsList";

/**
 * Bell with an unread badge (docs/figma/shell.md, "3b. Notifications").
 * `count` is the unread count the root layout read on page load; clicking the
 * bell opens the list, and marking one read asks the API for the count again.
 */
export function NotificationsButton({ count = 0 }: { count?: number }) {
  const panelId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const [unread, setUnread] = useState(count);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<NotificationsStatus>("loading");
  const [items, setItems] = useState<Notification[]>([]);
  const [notice, setNotice] = useState<string>();
  // Counts list loads, so an answer from an earlier opening is ignored.
  const loadRef = useRef(0);

  // Load the list each time it opens, so it never shows an old state.
  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const load = ++loadRef.current;
    setOpen(true);
    setStatus("loading");
    setNotice(undefined);
    try {
      const list = await fetchNotifications();
      if (load !== loadRef.current) return;
      setItems(list);
      setStatus("ready");
    } catch {
      if (load === loadRef.current) setStatus("error");
    }
  }

  // A click anywhere outside the bell and its list closes the list.
  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      setOpen(false);
      bellRef.current?.focus();
    }
  }

  async function markRead(item: Notification) {
    setNotice(undefined);
    try {
      const updated = await markNotificationRead(item.id);
      setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
    } catch {
      setNotice("Could not mark as read");
      return;
    }
    try {
      setUnread(await fetchUnreadCount());
    } catch {
      // The item is read either way; without a fresh count, take one off.
      setUnread((n) => Math.max(0, n - 1));
    }
  }

  const label =
    unread > 0
      ? `Notifications, ${unread} unread`
      : "Notifications, none unread";

  return (
    <div ref={boxRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={bellRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="relative p-2 rounded-xl glass-card hover:scale-105 transition-transform"
      >
        <Bell className="w-5 h-5 text-foreground" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            data-testid="notifications-badge"
            className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--status-error)] text-white text-xs rounded-full flex items-center justify-center"
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <NotificationsList
          id={panelId}
          status={status}
          items={items}
          notice={notice}
          onMarkRead={markRead}
        />
      )}
    </div>
  );
}
