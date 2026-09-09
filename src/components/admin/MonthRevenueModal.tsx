import React, { useEffect, useState } from 'react';
import { CafeInfo } from '../../types';
import { Modal } from '../common/Modal';
import { storageService, DailyRevenueReport } from '../../services/storage';
import { CalendarRange, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';

interface MonthRevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  cafe: CafeInfo;
  /** Calendar month to break down, formatted YYYY-MM. */
  month: string;
  monthLabel: string;
}

const weekdayOf = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

const dayOf = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });

// Every day the cafe took money in this month, with the same revenue basis the
// dashboard tiles use (food + service charge, cancelled orders excluded). The
// figures come from the server, which recomputes them from the orders and keeps
// the daily_revenue table in step — so this never disagrees with the order list.
export const MonthRevenueModal: React.FC<MonthRevenueModalProps> = ({
  isOpen,
  onClose,
  cafe,
  month,
  monthLabel,
}) => {
  const [report, setReport] = useState<DailyRevenueReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    storageService
      .getDailyRevenue(month)
      .then((data) => {
        if (cancelled) return;
        if (data) setReport(data);
        else setError("Couldn't load the daily breakdown. Check the connection and try again.");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the daily breakdown.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, month]);

  const days = report?.days ?? [];
  // Bars are scaled against the best day, so the shape of the month reads at a
  // glance rather than every bar sitting at a near-identical length.
  const bestDay = days.reduce((max, d) => Math.max(max, d.revenue), 0);
  const busiestRevenue = days.reduce(
    (best, d) => (d.revenue > (best?.revenue ?? -1) ? d : best),
    null as DailyRevenueReport['days'][number] | null
  );
  const averagePerDay = days.length > 0 ? (report?.totalRevenue ?? 0) / days.length : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <span className="flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-indigo-600" />
          Daily Earnings — {monthLabel}
        </span>
      }
    >
      <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-stone-500 text-sm font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" />
            Adding up the month…
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-start gap-2 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && days.length === 0 && (
          <div className="text-center py-12 text-stone-500">
            <CalendarRange className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <p className="text-sm font-semibold">No takings recorded in {monthLabel} yet.</p>
            <p className="text-xs mt-1">Days appear here as soon as orders are placed.</p>
          </div>
        )}

        {!isLoading && !error && days.length > 0 && (
          <>
            {/* Month summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Month Total
                </div>
                <div className="text-lg font-black text-stone-900 mt-0.5">
                  {cafe.currency}
                  {(report?.totalRevenue ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Orders
                </div>
                <div className="text-lg font-black text-stone-900 mt-0.5">
                  {report?.totalOrders ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Avg / Trading Day
                </div>
                <div className="text-lg font-black text-stone-900 mt-0.5">
                  {cafe.currency}
                  {averagePerDay.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Best Day
                </div>
                <div className="text-lg font-black text-stone-900 mt-0.5 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {busiestRevenue ? dayOf(busiestRevenue.date) : '—'}
                </div>
              </div>
            </div>

            {/* Day-by-day list */}
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 bg-stone-50 border-b border-stone-200 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                <span>Day</span>
                <span className="text-right">Orders</span>
                <span className="text-right w-24">Revenue</span>
              </div>

              <div className="divide-y divide-stone-100">
                {days.map((day) => (
                  <div key={day.date} className="px-4 py-2.5">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                      <span className="text-sm font-bold text-stone-800 whitespace-nowrap">
                        {dayOf(day.date)}
                        <span className="ml-1.5 text-[11px] font-semibold text-stone-400">
                          {weekdayOf(day.date)}
                        </span>
                      </span>
                      <span className="text-sm text-stone-600 text-right tabular-nums">
                        {day.ordersCount}
                      </span>
                      <span className="text-sm font-black text-stone-900 text-right w-24 tabular-nums">
                        {cafe.currency}
                        {day.revenue.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                        style={{ width: `${bestDay > 0 ? (day.revenue / bestDay) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-stone-400 leading-relaxed">
              Revenue is the food total plus service charge; tax is collected on behalf of the
              government and is not counted. Cancelled orders are excluded. Days are counted in{' '}
              {report?.timeZone}.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};
