import React, { useState } from 'react';
import { Category } from '../../types';
import { Modal } from '../common/Modal';
import { Plus, Edit2, Trash2, FolderTree } from 'lucide-react';

interface AdminCategoriesProps {
  categories: Category[];
  itemCountByCategory: Record<string, number>;
  onAddCategory: (name: string, icon?: string) => void;
  onUpdateCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
}

export const AdminCategories: React.FC<AdminCategoriesProps> = ({
  categories,
  itemCountByCategory,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');

  const openAdd = () => {
    setEditingCategory(null);
    setName('');
    setIsModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCategory) {
      onUpdateCategory(editingCategory.id, name.trim());
    } else {
      onAddCategory(name.trim());
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-stone-900 tracking-tight">Category Management</h2>
          <p className="text-xs text-stone-500">
            Organize digital menu items into high-level categories
          </p>
        </div>

        <button
          onClick={openAdd}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const count = itemCountByCategory[cat.id] || 0;

          return (
            <div
              key={cat.id}
              className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 leading-tight">
                    {cat.name}
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">{count} dishes listed</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(cat)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                  title="Edit Category"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (count > 0) {
                      alert(`Cannot delete "${cat.name}" because it currently has ${count} dishes. Reassign or delete the dishes first.`);
                      return;
                    }
                    if (window.confirm(`Delete category "${cat.name}"?`)) {
                      onDeleteCategory(cat.id);
                    }
                  }}
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete Category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        maxWidth="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Beverages, Desserts, Mocktails"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>

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
              Save Category
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
