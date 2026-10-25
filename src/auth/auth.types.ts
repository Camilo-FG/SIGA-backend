import type { PublicUser } from '../users/users.service.js';
import type { Role } from '../generated/prisma/client.js';

export interface JwtPayload {
  /** User id. */
  sub: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
