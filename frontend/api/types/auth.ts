/**
 * Auth types — users, credentials, tokens (aligned with `backend-api` auth schemas).
 */

// ---------------------------------------------------------------------------
// User & role
// ---------------------------------------------------------------------------

export type UserRole = string;

export interface User {
  id: number;
  medical_id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface SignupRequest {
  full_name: string;
  email: string;
  role: UserRole;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface ForgotPasswordResponse {
  message: string;
  reset_url?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
