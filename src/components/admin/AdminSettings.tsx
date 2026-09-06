import React, { useState } from 'react';
import { CafeInfo } from '../../types';
import { Save, RotateCcw, ShieldCheck, Store, Percent, Phone, MapPin, Sparkles } from 'lucide-react';
import { storageService } from '../../services/storage';

interface AdminSettingsProps {
  cafe: CafeInfo;
  onUpdateCafe: (updated: CafeInfo) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ cafe, onUpdateCafe }) => {
  const [formData, setFormData] = useState<CafeInfo>(cafe);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCafe(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    if (
      window.confirm(
        'Reset all cafe data, tables, menu, and sample orders to initial demo state? This will reset local storage.'
      )
    ) {
      storageService.resetToDemo();
      setFormData(storageService.getCafe());
      alert('Demo data restored successfully.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-black text-stone-900 tracking-tight">Cafe Settings</h2>
        <p className="text-xs text-stone-500">
          Configure business details, GST tax slabs, and system preferences
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Settings saved successfully! Updated in live QR menus.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-stone-200 p-6 shadow-2xs space-y-5 text-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
          <Store className="w-4 h-4 text-amber-600" />
          <h3 className="font-bold text-stone-900 text-sm">General Profile</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Cafe Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Tagline / Subtitle
            </label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Phone / Support Number
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Currency Symbol
            </label>
            <input
              type="text"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
            Physical Address
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Taxes & Charges */}
        <div className="pt-4 border-t border-stone-100">
          <div className="flex items-center gap-2 mb-3">
            <Percent className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-sm">Taxation & Service Charge</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                GST Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={formData.taxPercent}
                onChange={(e) => setFormData({ ...formData, taxPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-amber-700 font-medium mt-1 block">
                Currently commented out in all customer & table bills
              </span>
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Service Charge (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="15"
                value={formData.serviceChargePercent}
                onChange={(e) => setFormData({ ...formData, serviceChargePercent: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">Optional cafe service fee</span>
            </div>
          </div>
        </div>

        {/* Orders Toggle */}
        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-stone-900">Accepting QR Orders</div>
            <div className="text-[11px] text-stone-500">
              When switched off, customers see a notice that the kitchen is closed.
            </div>
          </div>
          <input
            type="checkbox"
            checked={formData.isAcceptingOrders}
            onChange={(e) => setFormData({ ...formData, isAcceptingOrders: e.target.checked })}
            className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500"
          />
        </div>

        {/* Actions */}
        <div className="pt-5 border-t border-stone-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Demo Data</span>
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
