import { type Notification, timeAgo } from "@/lib/api/notifications";

export type NotificationsStatus = "loading" | "ready" | "error";

type NotificationsListProps = {
  /** id of the panel; the bell points at it with aria-controls. */
  id: string;
  status: NotificationsStatus;
  items: Notification[];
  /** Shown above the list when marking one read failed. */
  notice?: string;
  onMarkRead: (item: Notification) => void;
};

/**
 * The bell's dropdown (no Figma frame: a .glass-card under the bell, like the
 * search results, NOTIF-002). Newest first, as the API sends them; unread items
 * have a dot and a "Mark as read" button named after their title.
 */
export function NotificationsList({
  id,
  status,
  items,
  notice,
  onMarkRead,
}: NotificationsListProps) {
  const headingId = `${id}-heading`;
  const message =
    status === "loading"
      ? "Loading notifications…"
      : status === "error"
        ? "Notifications are unavailable"
        : items.length === 0
          ? "No notifications"
          : null;

  return (
    <div
      id={id}
      className="absolute right-0 top-full mt-2 z-20 w-80 max-w-[calc(100vw-2rem)] glass-card rounded-xl p-2 max-h-96 overflow-y-auto"
    >
      <h2
        id={headingId}
        className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Notifications
      </h2>
      {notice && (
        <p
          role="status"
          className="px-3 py-1 text-xs text-[var(--status-error)]"
        >
          {notice}
        </p>
      )}
      {message ? (
        <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={item.id}
              data-testid="notification-item"
              data-read={item.read}
              className={`flex items-start gap-3 px-3 py-2 rounded-lg text-sm ${
                item.read ? "" : "bg-accent/60"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${
                  item.read ? "bg-transparent" : "bg-[var(--ai-blue)]"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-muted-foreground">{item.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <time dateTime={item.created_at}>
                    {timeAgo(item.created_at)}
                  </time>
                  {item.read && " · Read"}
                </p>
              </div>
              {!item.read && (
                <button
                  type="button"
                  aria-label={`Mark "${item.title}" as read`}
                  onClick={() => onMarkRead(item)}
                  className="shrink-0 text-xs text-[var(--ai-blue)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ai-blue)] rounded"
                >
                  Mark as read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
