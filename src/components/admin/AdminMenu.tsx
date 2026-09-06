import React, { useState } from 'react';
import { CafeInfo, Category, MenuItem, VegType } from '../../types';
import { VegBadge } from '../common/VegBadge';
import { Modal } from '../common/Modal';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AdminMenuProps {
  cafe: CafeInfo;
  categories: Category[];
  menuItems: MenuItem[];
  onAddMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  onUpdateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  onDeleteMenuItem: (id: string) => void;
  onToggleAvailability: (id: string) => void;
}

export const AdminMenu: React.FC<AdminMenuProps> = ({
  cafe,
  categories,
  menuItems,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onToggleAvailability,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(150);
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || 'cat-starters');
  const [vegType, setVegType] = useState<VegType>('veg');
  const [image, setImage] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [preparationTimeMin, setPreparationTimeMin] = useState<number>(15);

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setDescription('');
    setPrice(150);
    setCategoryId(categories[0]?.id || '');
    setVegType('veg');
    setImage('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80');
    setIsAvailable(true);
    setPreparationTimeMin(15);
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price);
    setCategoryId(item.categoryId);
    setVegType(item.vegType);
    setImage(item.image);
    setIsAvailable(item.isAvailable);
    setPreparationTimeMin(item.preparationTimeMin || 15);
    setIsModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingItem) {
      onUpdateMenuItem(editingItem.id, {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        categoryId,
        vegType,
        image: image.trim(),
        isAvailable,
        preparationTimeMin: Number(preparationTimeMin),
      });
    } else {
      onAddMenuItem({
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        categoryId,
        vegType,
        image: image.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
        isAvailable,
        preparationTimeMin: Number(preparationTimeMin),
      });
    }

    setIsModalOpen(false);
  };

  const filteredItems = menuItems.filter((item) => {
    if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-stone-900 tracking-tight">Menu Management</h2>
          <p className="text-xs text-stone-500">
            Add, edit, or adjust availability of dishes shown on the QR digital menu
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
            }`}
          >
            All ({menuItems.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const cat = categories.find((c) => c.id === item.categoryId);

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-4 shadow-2xs flex flex-col justify-between transition-all ${
                item.isAvailable ? 'border-stone-200' : 'border-stone-200 bg-stone-50/60 opacity-75'
              }`}
            >
              <div>
                <div className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className={`w-20 h-20 rounded-xl object-cover ring-1 ring-stone-200 shrink-0 ${
                      !item.isAvailable ? 'grayscale' : ''
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <VegBadge type={item.vegType} size="sm" />
                        <span className="text-[10px] font-semibold text-stone-400">
                          {cat?.name || 'Dish'}
                        </span>
                      </div>
                      <span className="text-sm font-black text-stone-900">
                        {cafe.currency}{item.price}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-stone-900 leading-tight truncate">
                      {item.name}
                    </h4>
                    <p className="text-xs text-stone-500 line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom controls */}
              <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between">
                {/* Availability Toggle */}
                <button
                  onClick={() => onToggleAvailability(item.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    item.isAvailable
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                  }`}
                  title="Click to toggle item availability for customers"
                >
                  {item.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Available</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Unavailable</span>
                    </>
                  )}
                </button>

                {/* Edit / Delete */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                    title="Edit Item"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${item.name}" from menu?`)) {
                        onDeleteMenuItem(item.id);
                      }
                    }}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
          {/* Item Name */}
          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Item Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Paneer Tikka"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Short appetizing description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Price & Prep Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Price ({cafe.currency}) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Prep Time (Min)
              </label>
              <input
                type="number"
                min={1}
                value={preparationTimeMin}
                onChange={(e) => setPreparationTimeMin(Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Category & Veg/Non-Veg */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white focus:outline-none focus:border-amber-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                value={vegType}
                onChange={(e) => setVegType(e.target.value as VegType)}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white focus:outline-none focus:border-amber-500"
              >
                <option value="veg">Pure Veg</option>
                <option value="non-veg">Non-Veg</option>
              </select>
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Food Image URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="flex-1 px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>
            {image && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={image}
                  alt="Preview"
                  className="w-12 h-12 rounded-lg object-cover border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
                  }}
                />
                <span className="text-[11px] text-stone-500">Image Preview</span>
              </div>
            )}
          </div>

          {/* Available status */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="font-bold text-stone-800">
                Item is Currently Available for ordering
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs transition-colors"
            >
              Save Item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
