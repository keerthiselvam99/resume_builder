import 'express';
import type { UserRole } from './domain';

/**
 * The authenticated user attached to the request by the `requireAuth`
 * middleware. Living here (rather than in a source file) keeps the Express
 * declaration merging in a pure declaration module so ESLint's
 * `no-namespace` rule never has to be relaxed for it.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
