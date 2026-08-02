/**
 * Auth API — login, signup, session, and password recovery.
 */
import { apiFetch } from "../http/client";
import { joinRoute, ROUTES } from "../http/paths";
import type {
  AuthResponse,
  ForgotPasswordResponse,
  LoginRequest,
  ResetPasswordRequest,
  SignupRequest,
  User,
} from "../domain";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function authRoute(...segments: string[]): string {
  return joinRoute(ROUTES.auth, ...segments);
}

function authPost<T>(segment: string, body: unknown): Promise<T> {
  return apiFetch<T>(authRoute(segment), { method: "POST", body });
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  return authPost<AuthResponse>("login", payload);
}

export async function signup(payload: SignupRequest): Promise<AuthResponse> {
  return authPost<AuthResponse>("signup", payload);
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>(authRoute("me"), { method: "GET" });
}

// ---------------------------------------------------------------------------
// Password recovery
// ---------------------------------------------------------------------------

export async function requestPasswordReset(
  email: string,
): Promise<ForgotPasswordResponse> {
  return authPost<ForgotPasswordResponse>("forgot-password", { email });
}

export async function resetPassword(
  payload: ResetPasswordRequest,
): Promise<{ message: string }> {
  return authPost<{ message: string }>("reset-password", payload);
}
