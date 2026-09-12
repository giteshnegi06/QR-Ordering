import { isRealtimeEnabled, subscribeToResourceChanges } from './realtime';

// "Need Water" / "Call Server" on the customer tracking page used to only
// show the customer their own toast — nothing ever reached staff. This is
// the real notification: a small standalone service (its own polling +
// realtime hookup, mirroring storage.ts's pattern) rather than folding it
// into storage.ts's much larger order/table/menu domain.

export interface TableRequest {
  id: string;
  tableId: string;
  tableNumber: string;
  type: 'water' | 'server';
  status: 'pending' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

class TableRequestService {
  private listeners = new Set<(list: TableRequest[]) => void>();
  private latest: TableRequest[] = [];
  private started = false;

  subscribe(callback: (list: TableRequest[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.latest);
    this.ensureStarted();
    return () => {
      this.listeners.delete(callback);
    };
  }

  private ensureStarted() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    this.refresh();
    subscribeToResourceChanges((resource) => {
      if (resource === 'table-requests') this.refresh();
    });
    // Same rationale as storage.ts's poll: a safety net for a missed push,
    // or the only sync path at all when Pusher isn't configured.
    const pollIntervalMs = isRealtimeEnabled() ? 20000 : 5000;
    setInterval(() => this.refresh(), pollIntervalMs);
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.latest));
  }

  private async refresh(): Promise<void> {
    try {
      const res = await fetch(`${apiBase}/table-requests`);
      if (!res.ok) return;
      this.latest = await res.json();
      this.notifyListeners();
    } catch {
      // offline — keep showing the last known list
    }
  }

  // Resolves with `duplicate: true` when that table already had the same
  // kind of request open (the server hands the existing one back rather
  // than paging staff again). Rejects if the request never reached the
  // server, so the caller can tell the guest to try again.
  async create(
    tableId: string,
    tableNumber: string,
    type: 'water' | 'server'
  ): Promise<{ duplicate: boolean }> {
    try {
      const res = await fetch(`${apiBase}/table-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, tableNumber, type }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = await res.json();
      return { duplicate: body?.duplicate === true };
    } finally {
      // Refresh regardless of success so any staff screen watching this
      // service reflects the attempt (or picks it up on the next poll if
      // the POST landed but this response didn't).
      this.refresh();
    }
  }

  async resolve(id: string): Promise<void> {
    // Optimistic — staff shouldn't see a request linger just because the
    // round-trip hasn't finished yet.
    this.latest = this.latest.map((r) => (r.id === id ? { ...r, status: 'resolved' } : r));
    this.notifyListeners();
    try {
      await fetch(`${apiBase}/table-requests/${id}/resolve`, { method: 'PATCH' });
    } finally {
      this.refresh();
    }
  }
}

export const tableRequestService = new TableRequestService();
