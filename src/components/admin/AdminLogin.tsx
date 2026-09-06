import React, { useState } from 'react';
import { CafeInfo } from '../../types';
import { Lock, Mail, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

interface AdminLoginProps {
  cafe: CafeInfo;
  onLoginSuccess: (email: string, role: 'admin' | 'kitchen') => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ cafe, onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@royalcafe.com');
  const [password, setPassword] = useState('admin123');
  const [role, setRole] = useState<'admin' | 'kitchen'>('admin');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter email and password');
      return;
    }
    // Demo authentication check
    onLoginSuccess(email.trim(), role);
  };

  const handleQuickDemoAdmin = () => {
    setEmail('admin@royalcafe.com');
    setPassword('admin123');
    setRole('admin');
    onLoginSuccess('admin@royalcafe.com', 'admin');
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-stone-900 p-8 text-center text-white relative">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center mx-auto mb-3 font-black shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black tracking-tight">{cafe.name} Staff Portal</h2>
          <p className="text-xs text-stone-400 mt-1">
            Protected administrative & kitchen management console
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Quick Demo Access banner */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Demo Credentials Available
              </span>
              <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-200/70 px-1.5 py-0.5 rounded">
                Instant Access
              </span>
            </div>
            <p className="text-[11px] text-amber-800 mb-2.5">
              You can instantly sign in using pre-configured administrator access:
            </p>
            <button
              type="button"
              onClick={handleQuickDemoAdmin}
              className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>One-Click Sign In as Cafe Admin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    role === 'admin'
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Admin / Manager
                </button>
                <button
                  type="button"
                  onClick={() => setRole('kitchen')}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    role === 'kitchen'
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Kitchen Staff
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-stone-900 hover:bg-black text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              Sign In to Management
            </button>
          </form>

          <div className="text-center">
            <span className="text-[11px] text-stone-400">
              Customers scanning table QR codes do not require login.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
