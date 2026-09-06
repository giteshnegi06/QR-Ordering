import React from 'react';
import { CafeInfo, TableItem } from '../../types';
import { Search, MapPin, Sparkles } from 'lucide-react';
import { VegBadge } from '../common/VegBadge';

interface MenuHeaderProps {
  cafe: CafeInfo;
  table: TableItem;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  vegOnlyFilter: boolean;
  onToggleVegOnly: () => void;
  activeOrderCount?: number;
  onViewActiveOrder?: () => void;
}

export const MenuHeader: React.FC<MenuHeaderProps> = ({
  cafe,
  table,
  searchQuery,
  onSearchChange,
  vegOnlyFilter,
  onToggleVegOnly,
  activeOrderCount = 0,
  onViewActiveOrder,
}) => {
  return (
    <div className="bg-white border-b border-stone-200/80 sticky top-0 z-30 shadow-xs">
      {/* Brand Top Bar */}
      <div className="px-4 py-3 sm:px-6 max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={cafe.logo}
            alt={cafe.name}
            className="w-10 h-10 rounded-xl object-cover ring-1 ring-amber-500/20 shadow-xs shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-stone-900 text-lg leading-tight tracking-tight">
                {cafe.name}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Sparkles className="w-3 h-3 text-amber-500" /> Digital Menu
              </span>
            </div>
            <p className="text-xs text-stone-500 line-clamp-1">{cafe.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeOrderCount > 0 && (
            <button
              onClick={onViewActiveOrder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs hover:bg-amber-600 transition-colors animate-pulse"
              title="Track your active order"
            >
              <span>Track Order</span>
              <span className="w-4 h-4 rounded-full bg-white text-amber-700 flex items-center justify-center text-[10px] font-extrabold">
                {activeOrderCount}
              </span>
            </button>
          )}

          {/* Table Badge */}
          <div className="flex items-center gap-1.5 bg-stone-900 text-stone-100 px-3 py-1.5 rounded-full shadow-xs">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-xs font-bold tracking-wide">{table.number}</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="px-4 pb-3 sm:px-6 max-w-4xl mx-auto flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pizza, coffee, momos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-stone-100 hover:bg-stone-100/80 focus:bg-white text-stone-900 rounded-xl border border-stone-200/60 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-stone-400"
          />
        </div>

        {/* Veg Only Switch */}
        <button
          onClick={onToggleVegOnly}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
            vegOnlyFilter
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
              : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
          }`}
        >
          <VegBadge type="veg" size="sm" />
          <span>Veg Only</span>
        </button>
      </div>
    </div>
  );
};
