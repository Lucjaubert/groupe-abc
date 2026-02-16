import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private base = (environment.apiGabc || '').replace(/\/+$/, '');

  async send(p: any) {
    const url = `${this.base}/send-message`;
    const isFormData =
      typeof FormData !== 'undefined' && p instanceof FormData;

    // ✅ IMPORTANT :
    // - si FormData => NE PAS définir Content-Type (le browser met le boundary)
    // - si JSON => Content-Type application/json
    const headers: HeadersInit = isFormData
      ? { Accept: 'application/json' } // optionnel, mais utile si l’API renvoie du JSON
      : { 'Content-Type': 'application/json', Accept: 'application/json' };

    const res = await fetch(url, {
      method: 'POST',
      // ✅ si ton API est sur un autre domaine et doit recevoir le cookie / session :
      // mets 'include'. Sinon, laisse 'omit' comme avant.
      credentials: 'omit',
      headers,
      body: isFormData ? p : JSON.stringify(p),
    });

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await res.json().catch(() => ({}))
      : await res.text().catch(() => '');

    // Erreurs HTTP
    if (!res.ok) {
      const msg =
        (typeof data === 'object' && (data as any)?.message) ||
        (typeof data === 'string' && data.trim()) ||
        `Échec de l’envoi (HTTP ${res.status})`;
      throw new Error(msg);
    }

    // Si l’API renvoie un JSON avec un status applicatif
    if (
      typeof data === 'object' &&
      (data as any)?.status &&
      (data as any).status !== 'success'
    ) {
      throw new Error((data as any)?.message || 'Échec de l’envoi');
    }

    return data;
  }
}
