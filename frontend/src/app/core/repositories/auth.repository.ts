import { Observable } from 'rxjs';
import { AuthSession, LoginRequest, RegisterRequest, UserProfile } from '../models/auth.model';

export interface AuthRepository {
  register(request: RegisterRequest): Observable<AuthSession>;
  login(request: LoginRequest): Observable<AuthSession>;
  refresh(): Observable<AuthSession>;
  logout(): Observable<void>;
  requestPasswordReset(email: string): Observable<void>;
  resetPassword(token: string, newPassword: string): Observable<void>;
  getProfile(): Observable<UserProfile | null>;
}
