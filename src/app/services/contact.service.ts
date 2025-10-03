import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private base = environment.apiGabc.replace(/\/+$/, '');

  async send(p: any) {
    const res = await fetch(`${this.base}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(p),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== 'success') {
      throw new Error(data?.message || 'Échec de l’envoi');
    }
    return data;
  }
}
