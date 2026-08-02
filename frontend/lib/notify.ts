import { toast } from "sonner";

/**
 * App-wide notifications (success, error, refusal, async flows).
 * Prefer this over calling `toast()` directly so copy and styling stay consistent.
 */
export const notify = {
  success(message: string, description?: string) {
    return description
      ? toast.success(message, { description })
      : toast.success(message);
  },

  error(message: string, description?: string) {
    return description
      ? toast.error(message, { description })
      : toast.error(message);
  },

  /** Neutral / informational — e.g. “Action cancelled”. */
  info(message: string, description?: string) {
    return description
      ? toast(message, { description })
      : toast(message);
  },

  warning(message: string, description?: string) {
    return description
      ? toast.warning(message, { description })
      : toast.warning(message);
  },

  loading(message: string) {
    return toast.loading(message);
  },

  dismiss(id: string | number) {
    toast.dismiss(id);
  },

  promise<T>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string;
      error: string | ((err: unknown) => string);
    },
  ) {
    return toast.promise(promise, msgs);
  },
};
