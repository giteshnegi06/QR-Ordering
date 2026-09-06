import React from 'react';
import { VegType } from '../../types';

interface VegBadgeProps {
  type: VegType;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const VegBadge: React.FC<VegBadgeProps> = ({ type, showText = false, size = 'md' }) => {
  const isVeg = type === 'veg';

  const sizeClasses = {
    sm: 'w-3.5 h-3.5 p-0.5',
    md: 'w-4 h-4 p-0.5',
    lg: 'w-5 h-5 p-0.5',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <div className="inline-flex items-center gap-1.5" title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}>
      <div
        className={`border-2 rounded-xs flex items-center justify-center shrink-0 ${
          isVeg ? 'border-emerald-600 bg-emerald-50/40' : 'border-rose-700 bg-rose-50/40'
        } ${sizeClasses[size]}`}
      >
        {isVeg ? (
          <div className={`rounded-full bg-emerald-600 shrink-0 ${dotSizes[size]}`} />
        ) : (
          <div
            className={`w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-rose-700`}
          />
        )}
      </div>
      {showText && (
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            isVeg ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {isVeg ? 'Pure Veg' : 'Non-Veg'}
        </span>
      )}
    </div>
  );
};
