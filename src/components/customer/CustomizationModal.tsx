import React, { useState } from 'react';
import { MenuItem, CartCustomization } from '../../types';
import { Modal } from '../common/Modal';
import { VegBadge } from '../common/VegBadge';
import { Plus, Minus } from 'lucide-react';

interface CustomizationModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    customizations: CartCustomization[],
    instructions?: string
  ) => void;
  currency: string;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
  currency,
}) => {
  if (!item) return null;

  const [quantity, setQuantity] = useState(1);
  const [selectedRadio, setSelectedRadio] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    item.customizationGroups?.forEach((grp) => {
      if (grp.type === 'radio' && grp.options.length > 0) {
        initial[grp.id] = grp.options[0].id;
      }
    });
    return initial;
  });

  const [selectedCheckboxes, setSelectedCheckboxes] = useState<Record<string, boolean>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Calculate total price with customizations
  let extraPrice = 0;
  item.customizationGroups?.forEach((grp) => {
    if (grp.type === 'radio') {
      const selectedOptId = selectedRadio[grp.id];
      const opt = grp.options.find((o) => o.id === selectedOptId);
      if (opt) extraPrice += opt.price;
    } else {
      grp.options.forEach((opt) => {
        if (selectedCheckboxes[opt.id]) {
          extraPrice += opt.price;
        }
      });
    }
  });

  const unitPrice = item.price + extraPrice;
  const totalPrice = unitPrice * quantity;

  const handleRadioChange = (groupId: string, optionId: string) => {
    setSelectedRadio((prev) => ({ ...prev, [groupId]: optionId }));
  };

  const handleCheckboxToggle = (optionId: string) => {
    setSelectedCheckboxes((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  const handleConfirm = () => {
    const chosenCustomizations: CartCustomization[] = [];

    item.customizationGroups?.forEach((grp) => {
      if (grp.type === 'radio') {
        const selectedOptId = selectedRadio[grp.id];
        const opt = grp.options.find((o) => o.id === selectedOptId);
        if (opt) {
          chosenCustomizations.push({
            groupTitle: grp.title,
            optionName: opt.name,
            price: opt.price,
          });
        }
      } else {
        grp.options.forEach((opt) => {
          if (selectedCheckboxes[opt.id]) {
            chosenCustomizations.push({
              groupTitle: grp.title,
              optionName: opt.name,
              price: opt.price,
            });
          }
        });
      }
    });

    onAddToCart(item, quantity, chosenCustomizations, specialInstructions);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="space-y-5">
        {/* Item Header */}
        <div className="flex gap-4">
          <img
            src={item.image}
            alt={item.name}
            className="w-20 h-20 rounded-xl object-cover ring-1 ring-stone-200 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <VegBadge type={item.vegType} />
              <h4 className="font-bold text-stone-900 text-base leading-tight truncate">
                {item.name}
              </h4>
            </div>
            <p className="text-xs text-stone-500 line-clamp-2 mb-2">{item.description}</p>
            <div className="text-sm font-extrabold text-stone-900">
              {currency}{item.price}
            </div>
          </div>
        </div>

        {/* Customization Groups */}
        {item.customizationGroups?.map((group) => (
          <div key={group.id} className="pt-3 border-t border-stone-100">
            <div className="flex items-center justify-between mb-2.5">
              <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                {group.title}
              </h5>
              <span className="text-[11px] text-stone-400">
                {group.required ? 'Required • Choose 1' : 'Optional'}
              </span>
            </div>

            <div className="space-y-1.5">
              {group.type === 'radio'
                ? group.options.map((opt) => {
                    const isChecked = selectedRadio[group.id] === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-amber-500 bg-amber-50/50 font-medium text-stone-900'
                            : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name={group.id}
                            checked={isChecked}
                            onChange={() => handleRadioChange(group.id, opt.id)}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span>{opt.name}</span>
                        </div>
                        {opt.price > 0 && (
                          <span className="text-xs font-semibold text-stone-600">
                            +{currency}{opt.price}
                          </span>
                        )}
                      </label>
                    );
                  })
                : group.options.map((opt) => {
                    const isChecked = !!selectedCheckboxes[opt.id];
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-amber-500 bg-amber-50/50 font-medium text-stone-900'
                            : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleCheckboxToggle(opt.id)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>{opt.name}</span>
                        </div>
                        {opt.price > 0 && (
                          <span className="text-xs font-semibold text-stone-600">
                            +{currency}{opt.price}
                          </span>
                        )}
                      </label>
                    );
                  })}
            </div>
          </div>
        ))}

        {/* Special Instructions */}
        <div className="pt-3 border-t border-stone-100">
          <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
            Special Instructions (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g., Less spicy, no onions, extra napkins"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
          {/* Quantity Controls */}
          <div className="flex items-center border border-stone-200 rounded-xl bg-stone-50 p-1">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-600 hover:bg-white disabled:opacity-30 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-stone-900">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-600 hover:bg-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-between"
          >
            <span>Add to Cart</span>
            <span>{currency}{totalPrice}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
