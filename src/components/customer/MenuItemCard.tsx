import React from 'react';
import { MenuItem } from '../../types';
import { VegBadge } from '../common/VegBadge';
import { Plus, Minus, Clock, SlidersHorizontal } from 'lucide-react';

interface MenuItemCardProps {
  item: MenuItem;
  currency: string;
  cartQuantity: number;
  onAddClick: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  currency,
  cartQuantity,
  onAddClick,
  onIncrement,
  onDecrement,
}) => {
  const hasCustomizations = item.customizationGroups && item.customizationGroups.length > 0;

  return (
    <div
      id={`item-card-${item.id}`}
      className={`bg-white rounded-2xl p-3.5 sm:p-4 border transition-all flex flex-col justify-between relative group ${
        item.isAvailable
          ? 'border-stone-200/80 hover:border-amber-300 hover:shadow-md'
          : 'border-stone-200 bg-stone-50/70 opacity-80'
      }`}
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Left info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <VegBadge type={item.vegType} size="md" />
            {item.preparationTimeMin && (
              <span className="flex items-center gap-1 text-[11px] text-stone-400 font-medium">
                <Clock className="w-3 h-3" />
                {item.preparationTimeMin}m
              </span>
            )}
          </div>

          <h3 className="font-bold text-stone-900 text-base leading-snug tracking-tight mb-1 group-hover:text-amber-800 transition-colors">
            {item.name}
          </h3>

          <p className="text-xs text-stone-500 leading-relaxed line-clamp-2 mb-2.5">
            {item.description}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-stone-900">
              {currency}{item.price}
            </span>
            {hasCustomizations && item.isAvailable && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                <SlidersHorizontal className="w-2.5 h-2.5" /> Customizable
              </span>
            )}
          </div>
        </div>

        {/* Right image & action */}
        <div className="flex flex-col items-center shrink-0 w-28 sm:w-32">
          <div className="relative w-28 h-24 sm:w-32 sm:h-28 rounded-xl overflow-hidden bg-stone-100 ring-1 ring-stone-200/70 shadow-xs">
            <img
              src={item.image}
              alt={item.name}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                !item.isAvailable ? 'grayscale' : ''
              }`}
              loading="lazy"
            />
            {!item.isAvailable && (
              <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-2xs flex items-center justify-center p-1">
                <span className="text-[10px] font-bold text-white text-center uppercase tracking-wider bg-rose-600/90 px-2 py-1 rounded">
                  Unavailable
                </span>
              </div>
            )}
          </div>

          {/* Action button container */}
          <div className="-mt-3.5 z-10 w-full px-2">
            {!item.isAvailable ? (
              <div className="w-full py-1.5 px-2 bg-stone-200 border border-stone-300 text-stone-500 text-[11px] font-bold rounded-xl text-center shadow-2xs">
                Currently Unavailable
              </div>
            ) : cartQuantity > 0 && !hasCustomizations ? (
              /* Inline quantity counter */
              <div className="w-full flex items-center justify-between bg-amber-600 text-white rounded-xl shadow-xs py-1 px-2 border border-amber-700">
                <button
                  onClick={onDecrement}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-amber-700 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-black">{cartQuantity}</span>
                <button
                  onClick={onIncrement}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-amber-700 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Add button */
              <button
                id={`add-btn-${item.id}`}
                onClick={onAddClick}
                className="w-full py-1.5 px-3 bg-white hover:bg-amber-50 active:bg-amber-100 text-amber-700 hover:text-amber-800 font-bold text-xs rounded-xl border border-amber-300/80 shadow-xs transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>{cartQuantity > 0 ? `Add (${cartQuantity})` : 'ADD'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
