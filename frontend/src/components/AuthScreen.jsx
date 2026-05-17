import { useState } from 'react';
import { api } from '../api';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode]       = useState('login');   // 'login' | 'register'
  const [form, setForm]       = useState({ name: '', employeeId: '', email: '', password: '' });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
    setApiError('');
  }

  function validate() {
    const e = {};
    if (mode === 'register' && !form.name.trim())       e.name       = 'Name is required.';
    if (mode === 'register' && !form.employeeId.trim()) e.employeeId = 'Employee ID is required.';
    if (!form.email.trim())    e.email    = 'Email is required.';
    if (!form.password.trim()) e.password = 'Password is required.';
    if (mode === 'register' && form.password.length < 6)
      e.password = 'Password must be at least 6 characters.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError('');
    try {
      const res = mode === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register({ name: form.name, employeeId: form.employeeId, email: form.email, password: form.password });

      localStorage.setItem('ot_token', res.token);
      localStorage.setItem('ot_user',  JSON.stringify(res.user));
      onAuth(res.user);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode((m) => m === 'login' ? 'register' : 'login');
    setErrors({});
    setApiError('');
    setForm({ name: '', employeeId: '', email: '', password: '' });
  }

  return (
    <div className="min-h-dvh bg-dark-900 flex items-center justify-center px-4"
      style={{
        paddingTop:    'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-4">
            <span className="text-white text-2xl font-extrabold">OT</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">OT Tracker</h1>
          <p className="text-sm text-dark-300 mt-1">Personal overtime log</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6 animate-slide-up">
          <h2 className="text-lg font-bold text-white mb-5">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>

          {/* API Error */}
          {apiError && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-sm animate-fade-in">
              <span>✕</span> {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Name — register only */}
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  name="name"
                  placeholder="e.g. Saveen Kudagama"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  className={`input-field ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
                />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>
            )}

            {/* Employee ID — register only */}
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-emp-id" className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
                  Employee ID
                </label>
                <input
                  id="auth-emp-id"
                  type="text"
                  name="employeeId"
                  placeholder="e.g. EMP001"
                  autoComplete="off"
                  value={form.employeeId}
                  onChange={handleChange}
                  className={`input-field uppercase ${errors.employeeId ? 'border-red-500 focus:border-red-500' : ''}`}
                />
                {errors.employeeId && <p className="text-xs text-red-400 mt-1">{errors.employeeId}</p>}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                className={`input-field ${errors.email ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                name="password"
                placeholder={mode === 'register' ? 'Min 6 characters' : '••••••••'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={handleChange}
                className={`input-field ${errors.password ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                mode === 'login' ? '→ Sign In' : '✓ Create Account'
              )}
            </button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-dark-300 mt-5">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={switchMode}
              className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
            >
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
