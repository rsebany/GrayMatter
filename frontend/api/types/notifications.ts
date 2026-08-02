/**
 * Notification types — in-app alerts for practitioners.
 */

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  read_at?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// List & create
// ---------------------------------------------------------------------------

export interface NotificationListResponse {
  unread_count: number;
  notifications: Notification[];
}

export interface NotificationCreate {
  title: string;
  message?: string;
  type?: string;
}
