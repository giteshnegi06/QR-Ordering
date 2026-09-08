import React from 'react';
import { Category } from '../../types';
import {
  Soup,
  UtensilsCrossed,
  Pizza,
  Sandwich,
  Wheat,
  Cookie,
  CookingPot,
  Coffee,
  IceCream,
  Utensils,
} from 'lucide-react';

interface CategoryListProps {
  categories: Category[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
}

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Soup':
      return Soup;
    case 'UtensilsCrossed':
      return UtensilsCrossed;
    case 'Pizza':
      return Pizza;
    case 'Sandwich':
      return Sandwich;
    case 'Wheat':
      return Wheat;
    case 'Cookie':
      return Cookie;
    case 'CookingPot':
      return CookingPot;
    case 'Coffee':
      return Coffee;
    case 'IceCream':
      return IceCream;
    default:
      return Utensils;
  }
};

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
}) => {
  return (
    <div className="bg-stone-50/90 backdrop-blur-xs border-b border-stone-200/60 sticky top-[105px] z-20 overflow-x-auto no-scrollbar py-2.5 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto flex items-center gap-2">
        <button
          onClick={() => onSelectCategory('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
            activeCategoryId === 'all'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>All Items</span>
        </button>

        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.icon);
          const isSelected = activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                isSelected
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
