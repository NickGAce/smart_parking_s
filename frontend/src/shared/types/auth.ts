import type { UserRole } from './common';

export interface User {
  id: number;
  email: string;
  role: UserRole;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
}
