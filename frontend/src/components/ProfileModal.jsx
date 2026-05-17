import { useMemo, useState } from 'react';
import { api } from '../api';

/**
 * ProfileModal — full-height mobile bottom sheet with scroll.
 * View mode: details + all-time stats.
 * Edit mode: inline form (Name, Employee ID).
 */
export default function ProfileModal({ user, records, onClose, onLogout, onProfileUpdate }) {
  const [editMode, setEditMode]       = useState(false);
  const [form, setForm]               = useState({ name: user?.name || '', employeeId: user?.employeeId || '' });
  const [errors, setErrors]           = useState({});
  const [saving, setSaving]           = useState(false);
  const [apiError, setApiError]       = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── All-time stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalHours   = records.reduce((s, r) => s + (r.otHours || 0), 0);
    const totalDays    = records.length;
    const uniqueMonths = new Set(
      records.map((r) => {
        const d = new Date(r.date);
        return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      })
    ).size;
    const avgPerMonth = uniqueMonths > 0 ? totalHours / uniqueMonths : 0;
    return { totalHours, totalDays, uniqueMonths, avgPerMonth };
  }, [records]);

  // ── Avatar initials ───────────────────────────────────────────────────────
  const initials = (user?.name || 'U')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  // ── Member since ──────────────────────────────────────────────────────────
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

  // ── Edit helpers ──────────────────────────────────────────────────────────
  function enterEdit() {
    setForm({ name: user?.name || '', employeeId: user?.employeeId || '' });
    setErrors({}); setApiError(''); setSaveSuccess(false);
    setEditMode(true);
  }
  function cancelEdit() { setEditMode(false); setErrors({}); setApiError(''); }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
    setApiError('');
  }

  function validate() {
    const e = {};
    if (!form.name.trim())       e.name       = 'Name is required.';
    if (!form.employeeId.trim()) e.employeeId = 'Employee ID is required.';
    return e;
  }

  async function handleSave(ev) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError('');
    try {
      const res = await api.updateProfile({ name: form.name.trim(), employeeId: form.employeeId.trim() });
      localStorage.setItem('ot_token', res.token);
      localStorage.setItem('ot_user',  JSON.stringify(res.user));
      onProfileUpdate(res.user);
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); setEditMode(false); }, 1200);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    /* ── Backdrop ──────────────────────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-dark-900/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* ── Sheet container ─────────────────────────────────────────────────
           Mobile  : slides up from bottom, max 92dvh, scrollable inside
           Desktop : centered card, fixed max-height                        */}
      <div
        className="
          w-full max-w-sm
          bg-dark-800 border border-dark-600
          rounded-t-3xl sm:rounded-2xl
          shadow-2xl animate-slide-up
          flex flex-col
          max-h-[92dvh] sm:max-h-[85vh]
        "
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Drag handle (mobile only) ───────────────────────────────────── */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden">
          <div className="w-10 h-1 bg-dark-500 rounded-full" />
        </div>

        {/* ── Sticky header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-dark-600 shrink-0">
          <h2 className="text-base font-bold text-white">
            {editMode ? 'Edit Profile' : 'My Profile'}
          </h2>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <button
                id="profile-edit-btn"
                onClick={enterEdit}
                className="flex items-center gap-1.5 text-xs font-semibold
                           text-brand-300 bg-brand-500/10 border border-brand-500/25
                           hover:bg-brand-500/20 active:bg-brand-500/30
                           px-3 py-1.5 rounded-lg transition-all duration-150"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                       m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            ) : (
              <button
                onClick={cancelEdit}
                className="text-xs font-semibold text-dark-300 hover:text-white
                           bg-dark-700 border border-dark-500 hover:border-dark-400
                           px-3 py-1.5 rounded-lg transition-all duration-150"
              >
                Cancel
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close profile"
              className="w-8 h-8 flex items-center justify-center rounded-lg
                         text-dark-300 hover:text-white hover:bg-dark-600
                         active:bg-dark-500 transition-all duration-150 text-base"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="overflow-y-auto overscroll-contain flex-1">

          {/* Avatar + identity card */}
          <div className="flex items-center gap-4 px-5 py-5 border-b border-dark-600">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600
                            flex items-center justify-center shadow-lg shadow-brand-500/30 shrink-0">
              <span className="text-white text-2xl font-extrabold">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-lg leading-tight truncate">{user?.name}</p>
              {user?.employeeId && (
                <span className="inline-block mt-1 text-xs font-bold tracking-wider
                                 text-brand-300 bg-brand-500/10 border border-brand-500/25
                                 px-2.5 py-0.5 rounded-lg">
                  {user.employeeId}
                </span>
              )}
              <p className="text-xs text-dark-400 mt-1 truncate">{user?.email}</p>
            </div>
          </div>

          {/* ── VIEW MODE ────────────────────────────────────────────────── */}
          {!editMode && (
            <>
              {/* Info rows */}
              <div className="px-5 py-4 space-y-4 border-b border-dark-600">
                <InfoRow icon="🪪" label="Employee ID" value={user?.employeeId || '—'} mono />
                <InfoRow icon="✉️" label="Email"        value={user?.email || '—'} />
                <InfoRow icon="📅" label="Member Since" value={memberSince} />
              </div>

              {/* All-time stats */}
              <div className="px-5 py-4 border-b border-dark-600">
                <p className="text-[10px] font-bold uppercase tracking-widest text-dark-400 mb-3">
                  All-Time OT Stats
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <StatBox value={stats.totalHours.toFixed(1)} unit="hrs"    label="Total OT"      color="text-brand-300" />
                  <StatBox value={stats.totalDays}              unit="days"   label="Days Logged"   color="text-violet-300" />
                  <StatBox value={stats.uniqueMonths}           unit="months" label="Active Months" color="text-teal-300" />
                  <StatBox value={stats.avgPerMonth.toFixed(1)} unit="hrs"    label="Avg / Month"   color="text-amber-300" />
                </div>
              </div>

              {/* Sign out */}
              <div className="px-5 py-5">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                             text-red-300 bg-red-500/10 hover:bg-red-500/20
                             active:bg-red-500/30
                             border border-red-500/25 hover:border-red-500/40
                             text-sm font-semibold transition-all duration-150"
                >
                  <span>⏻</span> Sign Out
                </button>
              </div>
            </>
          )}

          {/* ── EDIT MODE ────────────────────────────────────────────────── */}
          {editMode && (
            <form onSubmit={handleSave} noValidate className="px-5 py-5 space-y-4">

              {/* API error */}
              {apiError && (
                <div className="flex items-center gap-2 px-3 py-2.5
                                bg-red-500/15 border border-red-500/30 rounded-xl
                                text-red-300 text-xs animate-fade-in">
                  <span>✕</span> {apiError}
                </div>
              )}

              {/* Success flash */}
              {saveSuccess && (
                <div className="flex items-center gap-2 px-3 py-2.5
                                bg-emerald-500/15 border border-emerald-500/30 rounded-xl
                                text-emerald-300 text-xs animate-fade-in">
                  <span>✓</span> Profile updated!
                </div>
              )}

              {/* Full Name */}
              <div>
                <label htmlFor="edit-name"
                  className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
                  Full Name *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Saveen Kudagama"
                  autoComplete="name"
                  className={`input-field ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
                />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>

              {/* Employee ID */}
              <div>
                <label htmlFor="edit-emp-id"
                  className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
                  Employee ID *
                </label>
                <input
                  id="edit-emp-id"
                  type="text"
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleChange}
                  placeholder="e.g. EMP001"
                  autoComplete="off"
                  className={`input-field uppercase ${errors.employeeId ? 'border-red-500 focus:border-red-500' : ''}`}
                />
                {errors.employeeId && <p className="text-xs text-red-400 mt-1">{errors.employeeId}</p>}
              </div>

              {/* Email — read-only */}
              <div>
                <label className="block text-xs font-semibold text-dark-400 mb-1.5 uppercase tracking-wide">
                  Email <span className="normal-case font-normal text-dark-500">(cannot be changed)</span>
                </label>
                <div className="input-field bg-dark-700/40 text-dark-400 cursor-not-allowed select-none text-sm">
                  {user?.email}
                </div>
              </div>

              {/* Save */}
              <button
                id="profile-save-btn"
                type="submit"
                disabled={saving || saveSuccess}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Saving...
                  </>
                ) : saveSuccess ? '✓ Saved!' : '✓ Save Changes'}
              </button>
            </form>
          )}

        </div>{/* end scrollable body */}
      </div>
    </div>
  );
}

/* ── Reusable sub-components ───────────────────────────────────────────────── */
function InfoRow({ icon, label, value, mono }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-6 text-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-dark-400 leading-none mb-0.5">{label}</p>
        <p className={`text-sm text-white truncate ${mono ? 'font-mono font-bold' : 'font-medium'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function StatBox({ value, unit, label, color }) {
  return (
    <div className="bg-dark-700/60 rounded-xl p-3.5 border border-dark-500">
      <p className={`text-2xl font-extrabold tracking-tight leading-none ${color}`}>
        {value}
        <span className="text-xs font-medium text-dark-400 ml-1">{unit}</span>
      </p>
      <p className="text-[10px] text-dark-400 mt-1.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
