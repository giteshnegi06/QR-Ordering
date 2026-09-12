import React, { useEffect, useRef, useState } from 'react';
import { tableRequestService, TableRequest } from '../../services/tableRequests';
import { soundService } from '../../services/sound';
import { Droplets, BellRing, Check } from 'lucide-react';

interface TableRequestsBannerProps {
  theme?: 'dark' | 'light';
}

const LABELS: Record<TableRequest['type'], string> = {
  water: 'Needs water',
  server: 'Calling server',
};

function formatAge(createdAt: string, now: number): string {
  const secs = Math.max(0, Math.round((now - new Date(createdAt).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins} min ago`;
}

// Pending "Need Water" / "Call Server" requests, oldest first, each with a
// Done button. Shown only in the Admin console (dashboard and Orders board):
// these are floor-staff jobs, so they deliberately stay off the Kitchen KDS
// and never distract the cooks. Renders nothing when there is nothing
// waiting so it never takes up space on a quiet floor.
export const TableRequestsBanner: React.FC<TableRequestsBannerProps> = ({ theme = 'light' }) => {
  const [requests, setRequests] = useState<TableRequest[]>([]);
  const [now, setNow] = useState(Date.now());
  const knownPendingIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    return tableRequestService.subscribe((list) => {
      const pendingIds = new Set(list.filter((r) => r.status === 'pending').map((r) => r.id));
      // Ring once for each request the first time this screen sees it. The
      // very first list after mount is treated as already-known so reloading
      // a staff screen doesn't re-ring for everything still open.
      if (knownPendingIds.current !== null) {
        const hasNewOne = [...pendingIds].some((id) => !knownPendingIds.current!.has(id));
        if (hasNewOne) soundService.playStatusUpdateBlip();
      }
      knownPendingIds.current = pendingIds;
      setRequests(list);
    });
  }, []);

  const pending = requests.filter((r) => r.status === 'pending');
  if (pending.length === 0) return null;

  const dark = theme === 'dark';

  return (
    <div
      className={`rounded-3xl border p-4 space-y-3 ${
        dark ? 'bg-stone-800 border-amber-500/40' : 'bg-amber-50 border-amber-200 shadow-2xs'
      }`}
    >
      <div className="flex items-center gap-2">
        <BellRing className={`w-4 h-4 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
        <h3 className={`font-bold text-sm ${dark ? 'text-white' : 'text-stone-900'}`}>
          Table Requests
        </h3>
        <span
          className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
            dark ? 'bg-amber-500 text-stone-950' : 'bg-amber-600 text-white'
          }`}
        >
          {pending.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {pending.map((r) => {
          const Icon = r.type === 'water' ? Droplets : BellRing;
          return (
            <div
              key={r.id}
              className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 border ${
                dark ? 'bg-stone-900 border-stone-700' : 'bg-white border-amber-200/70'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    r.type === 'water'
                      ? dark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-700'
                      : dark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className={`font-black text-sm truncate ${dark ? 'text-white' : 'text-stone-900'}`}>
                    {r.tableNumber}
                  </div>
                  <div className={`text-[11px] font-semibold ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                    {LABELS[r.type]} • {formatAge(r.createdAt, now)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => tableRequestService.resolve(r.id)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  dark
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                title="Mark as handled"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
