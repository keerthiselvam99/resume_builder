import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from './environment';
import { HealthStatus } from './health-status';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  getHealth(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${this.apiUrl}/health`);
  }
}
