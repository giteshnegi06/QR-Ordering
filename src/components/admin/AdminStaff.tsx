import React, { useEffect, useState } from 'react';
import { AdminUser } from '../../types';
import { staffService } from '../../services/staff';
import {
  Users,
  Plus,
  Trash2,
  ChefHat,
  ShieldCheck,
  Loader2,
  Mail,
  Lock,
  User,
  KeyRound,
  Check,
} from 'lucide-react';

const roleStyles: Record<string, string> = {
  admin: 'bg-stone-900 text-white',
  kitchen: 'bg-blue-100 text-blue-800',
  staff: 'bg-purple-100 text-purple-800',
};

export const AdminStaff: React.FC = () => {
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'kitchen' | 'staff'>('kitchen');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password reset — inline per-row, so it never leaves the Staff page.
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [justResetId, setJustResetId] = useState<string | null>(null);

  const loadStaff = () => {
    setIsLoading(true);
    setLoadError(null);
    staffService
      .list()
      .then(setStaff)
      .catch((err) => setLoadError(err.message || 'Could not load staff accounts'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim() || !password) {
      setFormError('Please fill in name, email, and password.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await staffService.add({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      setStaff((prev) => [created, ...prev]);
      setName('');
      setEmail('');
      setPassword('');
      setRole('kitchen');
    } catch (err: any) {
      setFormError(err.message || 'Could not add staff account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (member: AdminUser) => {
    if (!window.confirm(`Remove ${member.name}'s login access?`)) return;
    const prev = staff;
    setStaff((s) => s.filter((m) => m.id !== member.id));
    try {
      await staffService.remove(member.id);
    } catch (err: any) {
      setStaff(prev);
      window.alert(err.message || 'Could not remove this account');
    }
  };

  const openResetPassword = (memberId: string) => {
    setResetTargetId((current) => (current === memberId ? null : memberId));
    setResetPasswordValue('');
    setResetError(null);
  };

  const handleResetPassword = async (e: React.FormEvent, member: AdminUser) => {
    e.preventDefault();
    setResetError(null);

    if (resetPasswordValue.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }

    setIsResetting(true);
    try {
      await staffService.resetPassword(member.id, resetPasswordValue);
      setResetTargetId(null);
      setResetPasswordValue('');
      setJustResetId(member.id);
      window.setTimeout(() => setJustResetId((id) => (id === member.id ? null : id)), 3000);
    } catch (err: any) {
      setResetError(err.message || 'Could not reset password');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-stone-900 tracking-tight">Staff Accounts</h2>
        <p className="text-xs text-stone-500">
          Give kitchen staff their own login so they can open the Kitchen KDS without sharing your
          admin password.
        </p>
      </div>

      {/* Add Staff Form */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-600" />
          <h3 className="font-bold text-stone-900 text-sm">Add Staff Account</h3>
        </div>

        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('kitchen')}
                  className={`py-2.5 px-3 rounded-xl font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    role === 'kitchen'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>Kitchen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('staff')}
                  className={`py-2.5 px-3 rounded-xl font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    role === 'staff'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Staff</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
                Temporary Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{isSubmitting ? 'Adding...' : 'Add Staff Account'}</span>
          </button>
        </form>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-600" />
          <h3 className="font-bold text-stone-900 text-sm">
            {isLoading ? 'Loading Staff...' : `${staff.length} Staff Account${staff.length === 1 ? '' : 's'}`}
          </h3>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-stone-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : loadError ? (
          <div className="p-6 text-center text-xs text-rose-600 font-semibold">{loadError}</div>
        ) : staff.length === 0 ? (
          <div className="p-10 text-center text-xs text-stone-400">
            No staff accounts yet. Add one above to give kitchen staff their own login.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {staff.map((member) => (
              <div key={member.id}>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm truncate">{member.name}</span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          roleStyles[member.role] || roleStyles.staff
                        }`}
                      >
                        {member.role}
                      </span>
                      {justResetId === member.id && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Password reset
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-stone-500 truncate">{member.email}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openResetPassword(member.id)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        resetTargetId === member.id
                          ? 'text-amber-700 bg-amber-50'
                          : 'text-stone-400 hover:text-amber-700 hover:bg-amber-50'
                      }`}
                      title="Reset password"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(member)}
                      className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Remove staff account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {resetTargetId === member.id && (
                  <form
                    onSubmit={(e) => handleResetPassword(e, member)}
                    className="px-4 pb-4 -mt-1 flex flex-col sm:flex-row sm:items-start gap-2"
                  >
                    <div className="flex-1">
                      <div className="relative">
                        <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          value={resetPasswordValue}
                          onChange={(e) => setResetPasswordValue(e.target.value)}
                          placeholder={`New password for ${member.name}`}
                          className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      {resetError && (
                        <p className="text-[11px] text-rose-600 font-semibold mt-1">{resetError}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="submit"
                        disabled={isResetting}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetTargetId(null)}
                        className="px-3 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
