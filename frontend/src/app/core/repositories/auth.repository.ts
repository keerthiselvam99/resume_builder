import { Observable } from 'rxjs';
import {
  AuthSession,
  LoginRequest,
  RegisterRequest,
  RegistrationResult,
  UserProfile,
} from '../models/auth.model';

export interface AuthRepository {
  register(request: RegisterRequest): Observable<RegistrationResult>;
  login(request: LoginRequest): Observable<AuthSession>;
  refresh(): Observable<AuthSession>;
  logout(): Observable<void>;
  requestPasswordReset(email: string): Observable<void>;
  resetPassword(token: string, newPassword: string): Observable<void>;
  verifyEmail(token: string): Observable<void>;
  resendVerification(email: string): Observable<void>;
  getProfile(): Observable<UserProfile | null>;
}
