import type { AuthResponse, User, UserRole } from "@/api/domain";
import {
  login as clientLogin,
  signup as clientSignup,
  fetchMe as clientFetchMe,
  requestPasswordReset as clientRequestPasswordReset,
  resetPassword as clientResetPassword,
} from "@/api/clients";

const AUTH_STORAGE_KEY = "graymatter_auth";
const LEGACY_AUTH_STORAGE_KEY = "ildxr_auth";

function readAuthRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (current) return current;
    const legacy = window.localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (legacy) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

type StoredAuth = AuthResponse;

export type { UserRole };

export function setAuth(data: AuthResponse): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readAuthRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    return parsed.user ?? null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readAuthRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await clientLogin({ email, password });
  setAuth(data);
  return data;
}

export async function signup(
  fullName: string,
  email: string,
  role: UserRole,
  password: string,
): Promise<AuthResponse> {
  const data = await clientSignup({
    full_name: fullName,
    email,
    role,
    password,
  });
  setAuth(data);
  return data;
}

export async function fetchMe(): Promise<User> {
  return clientFetchMe();
}

export async function requestPasswordReset(
  email: string,
): Promise<{ message: string; reset_url?: string }> {
  return clientRequestPasswordReset(email);
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  return clientResetPassword({ token, new_password: newPassword });
}
