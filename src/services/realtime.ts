/**
 * Browser-side Pusher subscription. The frontend connects to Pusher directly
 * (no persistent connection to our own serverless API needed) and gets
 * notified when the server pushes a resource change via server/realtime.ts.
 *
 * If VITE_PUSHER_KEY isn't set, subscribe() is a no-op and callers should
 * keep relying on their own polling fallback.
 */

import Pusher from 'pusher-js';

export type RealtimeResource = 'orders' | 'tables' | 'categories' | 'menu' | 'cafe' | 'table-requests';

const CHANNEL = 'qr-ordering';

let pusher: Pusher | null | undefined;

function getPusher(): Pusher | null {
  if (pusher !== undefined) return pusher;

  const key = import.meta.env.VITE_PUSHER_KEY as string | undefined;
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER as string | undefined;
  if (!key || !cluster) {
    pusher = null;
    return pusher;
  }

  pusher = new Pusher(key, { cluster });
  return pusher;
}

export function subscribeToResourceChanges(
  onChange: (resource: RealtimeResource) => void
): () => void {
  const client = getPusher();
  if (!client) return () => {};

  const channel = client.subscribe(CHANNEL);
  const handler = (data: { resource: RealtimeResource }) => onChange(data.resource);
  channel.bind('resource-updated', handler);

  return () => {
    channel.unbind('resource-updated', handler);
    client.unsubscribe(CHANNEL);
  };
}

export function isRealtimeEnabled(): boolean {
  return getPusher() !== null;
}
