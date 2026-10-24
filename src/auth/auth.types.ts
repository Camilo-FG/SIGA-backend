import type { PublicUser } from '../users/users.service.js';

export interface JwtPayload {
  /** User id. */
  sub: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
