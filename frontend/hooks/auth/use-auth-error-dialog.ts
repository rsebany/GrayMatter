"use client";

import { useCallback, useState } from "react";

import { authErrorTitle, messageFromAuthError } from "@/lib/auth";

export function useAuthErrorDialog(defaultTitle: string) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState("");

  const showError = useCallback(
    (err: unknown, fallbackMessage: string, fallbackTitle = defaultTitle) => {
      const msg = messageFromAuthError(err, fallbackMessage);
      setTitle(authErrorTitle(msg, fallbackTitle));
      setMessage(msg);
      setOpen(true);
    },
    [defaultTitle],
  );

  const showMessage = useCallback(
    (msg: string, fallbackTitle = defaultTitle) => {
      setTitle(authErrorTitle(msg, fallbackTitle));
      setMessage(msg);
      setOpen(true);
    },
    [defaultTitle],
  );

  return {
    open,
    setOpen,
    title,
    message,
    showError,
    showMessage,
  };
}
