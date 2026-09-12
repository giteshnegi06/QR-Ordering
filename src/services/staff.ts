import { AdminUser } from '../types';

// Staff accounts are managed and authenticated straight against the server —
// unlike the rest of the app's data, there's no localStorage-cached copy or
// offline-first optimistic write here, since a login must actually be
// verified by the backend and an account list should never silently drift
// out of sync with who can log in.
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
  return body as T;
}

export interface NewStaffInput {
  name: string;
  email: string;
  password: string;
  role: 'kitchen' | 'staff';
}

// The cafe owner's own instant demo access — shared between AdminLogin (which
// bypasses the server entirely for these exact values) and AdminSettings
// (which shows this as the account email when letting the owner set a real
// password on top of that demo door).
export const DEMO_ADMIN_EMAIL = 'admin@negiskitchen.com';
export const DEMO_ADMIN_PASSWORD = 'admin123';

export const staffService = {
  // Only kitchen/staff accounts belong on the Staff screen — the owner's own
  // admin account (if one has been created via setOwnerPassword) is managed
  // from Settings instead, never listed or resettable here.
  async list(): Promise<AdminUser[]> {
    const all = await request<AdminUser[]>('/admin-users');
    return all.filter((u) => u.role !== 'admin');
  },

  add(input: NewStaffInput): Promise<AdminUser> {
    return request<AdminUser>('/admin-users', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  remove(id: string): Promise<void> {
    return request<void>(`/admin-users/${id}`, { method: 'DELETE' });
  },

  resetPassword(id: string, password: string): Promise<AdminUser> {
    return request<AdminUser>(`/admin-users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
  },

  login(email: string, password: string): Promise<AdminUser> {
    return request<AdminUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Sets/rotates the owner's own admin password (Settings screen). Distinct
  // from resetPassword above, which targets a specific staff id.
  setOwnerPassword(email: string, password: string): Promise<AdminUser> {
    return request<AdminUser>('/admin-users/owner-password', {
      method: 'PUT',
      body: JSON.stringify({ email, password }),
    });
  },
};
