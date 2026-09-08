import React, { useState, useRef } from 'react';
import { CafeInfo } from '../../types';
import { Save, RotateCcw, ShieldCheck, Store, Percent, Phone, MapPin, Sparkles, Image as ImageIcon, Upload } from 'lucide-react';
import { storageService } from '../../services/storage';

// Keep uploaded cafe images reasonably small — they're fetched on every
// cafe-info poll across every device, so an unbounded upload would bloat
// that request for everyone, not just the admin who uploaded it.
const MAX_LOGO_FILE_BYTES = 500 * 1024;

interface AdminSettingsProps {
  cafe: CafeInfo;
  onUpdateCafe: (updated: CafeInfo) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ cafe, onUpdateCafe }) => {
  const [formData, setFormData] = useState<CafeInfo>(cafe);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_LOGO_FILE_BYTES) {
      setLogoError(`Image is too large — please choose one under ${Math.round(MAX_LOGO_FILE_BYTES / 1024)}KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, logo: reader.result as string }));
    };
    reader.onerror = () => setLogoError('Could not read that file. Please try again.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCafe({
      ...formData,
      taxPercent: Number.isNaN(formData.taxPercent) ? 0 : formData.taxPercent,
      serviceChargePercent: Number.isNaN(formData.serviceChargePercent) ? 0 : formData.serviceChargePercent,
    });
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

        {/* Cafe Image / Logo */}
        <div>
          <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
            Cafe Image / Logo
          </label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden shrink-0">
              {formData.logo ? (
                <img src={formData.logo} alt="Cafe logo preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-stone-300" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-stone-900 hover:bg-black text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </button>
                {formData.logo && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logo: '' })}
                    className="px-3 py-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                type="url"
                placeholder="...or paste an image URL"
                value={formData.logo}
                onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-[11px]"
              />
              {logoError && <p className="text-[11px] text-rose-600 font-semibold">{logoError}</p>}
            </div>
          </div>
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
                value={Number.isNaN(formData.taxPercent) ? '' : formData.taxPercent}
                onChange={(e) => setFormData({ ...formData, taxPercent: e.target.valueAsNumber })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Applied to every customer order and printed table bill
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
                value={Number.isNaN(formData.serviceChargePercent) ? '' : formData.serviceChargePercent}
                onChange={(e) => setFormData({ ...formData, serviceChargePercent: e.target.valueAsNumber })}
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
