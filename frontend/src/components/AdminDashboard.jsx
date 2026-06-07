import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { getShiftDurationHours, todayISODate, getAvailableShiftTypes } from '../constants';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(hrs) { return Number(hrs || 0).toFixed(1); }

function relativeDate(dateStr) {
  if (!dateStr) return '—';
  const d    = new Date(dateStr);
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <  7)  return `${diff}d ago`;
  if (diff < 30)  return `${Math.floor(diff / 7)}w ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard({ adminUser, onLogout }) {
  const [stats,        setStats]        = useState(null);
  const [users,        setUsers]         = useState([]);
  const [loading,      setLoading]       = useState(true);
  const [search,       setSearch]        = useState('');
  const [selected,     setSelected]      = useState(null);  // selected user object
  const [userRecords,  setUserRecords]   = useState([]);
  const [userSchedule, setUserSchedule]  = useState({});    // employee schedule
  const [recLoading,   setRecLoading]    = useState(false);
  const [filterYear,   setFilterYear]    = useState(new Date().getFullYear());
  const [filterMonth,  setFilterMonth]   = useState(new Date().getMonth() + 1);

  // ── Announcements state ───────────────────────────────────────────────────
  const [announcements,   setAnnouncements]  = useState([]);
  const [showAnnForm,     setShowAnnForm]    = useState(false);
  const [annSaving,       setAnnSaving]      = useState(false);
  const [annForm,         setAnnForm]        = useState({ title: '', message: '', otDate: '', startTime: '', endTime: '', shiftType: '8:00 AM - 4:00 PM', timeMode: 'shift' });
  const [annError,        setAnnError]       = useState('');

  // ── Load stats + users ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [s, u, a] = await Promise.all([api.adminStats(), api.adminUsers(), api.adminGetAnnouncements()]);
        setStats(s);
        setUsers(u.users || []);
        const todayStr = todayISODate();
        const validAnns = (a.data || []).filter(ann => {
          if (!ann.otDate) return true;
          return new Date(ann.otDate).toISOString().split('T')[0] >= todayStr;
        });
        setAnnouncements(validAnns);
      } catch { /* ignore */ }
      finally   { setLoading(false); }
    })();
  }, []);

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    setAnnError('');
    if (!annForm.title || !annForm.otDate) { setAnnError('Title and OT date are required.'); return; }
    
    // Auto-parse shift times if in 'shift' mode
    let payload = { ...annForm };
    if (payload.timeMode === 'shift' && payload.shiftType !== 'Custom') {
      const match = payload.shiftType.match(/(\d+):(\d+)\s*([AP]M)\s*-\s*(\d+):(\d+)\s*([AP]M)/i);
      if (match) {
        let [ , sh, sm, sAmpm, eh, em, eAmpm ] = match;
        sh = parseInt(sh, 10);
        eh = parseInt(eh, 10);
        if (sAmpm.toUpperCase() === 'PM' && sh !== 12) sh += 12;
        if (sAmpm.toUpperCase() === 'AM' && sh === 12) sh = 0;
        if (eAmpm.toUpperCase() === 'PM' && eh !== 12) eh += 12;
        if (eAmpm.toUpperCase() === 'AM' && eh === 12) eh = 0;
        payload.startTime = `${sh.toString().padStart(2, '0')}:${sm}`;
        payload.endTime   = `${eh.toString().padStart(2, '0')}:${em}`;
      } else {
        payload.startTime = '';
        payload.endTime = '';
      }
    }

    setAnnSaving(true);
    try {
      const res = await api.adminCreateAnnouncement(payload);
      setAnnouncements((prev) => [res.data, ...prev]);
      setAnnForm({ title: '', message: '', otDate: '', startTime: '', endTime: '', shiftType: '8:00 AM - 4:00 PM', timeMode: 'shift' });
      setShowAnnForm(false);
    } catch (err) {
      setAnnError(err.message || 'Failed to post announcement.');
    } finally {
      setAnnSaving(false);
    }
  }

  async function handleDeleteAnnouncement(id) {
    try {
      await api.adminDeleteAnnouncement(id);
      setAnnouncements((prev) => prev.map((a) => a._id === id ? { ...a, isActive: false } : a));
    } catch { /* ignore */ }
  }

  // ── Load records & schedule when employee selected ─────────────────────────
  useEffect(() => {
    if (!selected) return;
    setRecLoading(true);
    Promise.all([
      api.adminUserRecords(selected.id),
      api.adminUserSchedule(selected.id)
    ])
      .then(([r, s]) => {
        setUserRecords(r.data || []);
        setUserSchedule(s.data || {});
      })
      .catch(() => {
        setUserRecords([]);
        setUserSchedule({});
      })
      .finally(() => setRecLoading(false));
  }, [selected]);

  // ── Filtered user list ────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      (u.employeeId || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  // ── Filtered records for selected employee ────────────────────────────────
  const monthRecords = useMemo(() => {
    return userRecords.filter((r) => {
      const d = new Date(r.date);
      return d.getUTCFullYear() === filterYear && d.getUTCMonth() + 1 === filterMonth;
    });
  }, [userRecords, filterYear, filterMonth]);

  const monthOTHours = useMemo(
    () => monthRecords.reduce((s, r) => s + (r.otHours || 0), 0),
    [monthRecords]
  );

  const initials = (adminUser?.name || 'A').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-dark-900">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-dark-900/90 backdrop-blur-md border-b border-dark-700"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500
                            flex items-center justify-center shadow-lg shadow-amber-500/30">
              <span className="text-white text-xs font-extrabold">⚙</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">Admin Panel</h1>
              <p className="text-[10px] text-amber-400 leading-none mt-0.5">WorkTrack</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500
                            flex items-center justify-center shadow-md shadow-amber-500/20">
              <span className="text-white text-[10px] font-extrabold leading-none">{initials}</span>
            </div>
            <button
              onClick={onLogout}
              className="text-xs font-semibold text-dark-300 hover:text-red-300
                         bg-dark-800 border border-dark-600 hover:border-red-500/40
                         px-3 py-1.5 rounded-lg transition-all duration-150"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Global Stats bar */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-dark-700 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Employees" value={stats?.totalUsers ?? 0}        unit=""     color="text-brand-300" />
            <StatCard label="All-time OT"     value={fmt(stats?.totalOTHours)}       unit="hrs"  color="text-violet-300" />
            <StatCard label="Active This Month" value={stats?.activeThisMonth ?? 0}  unit="emp"  color="text-teal-300" />
            <StatCard label="Month OT"         value={fmt(stats?.monthOTHours)}      unit="hrs"  color="text-amber-300" />
          </div>
        )}

        {/* Announcements Panel */}
        <AnnouncementsPanel
          announcements={announcements}
          showForm={showAnnForm}
          onToggleForm={() => { setShowAnnForm((v) => !v); setAnnError(''); }}
          form={annForm}
          onFormChange={(field, val) => setAnnForm((f) => ({ ...f, [field]: val }))}
          onSubmit={handleCreateAnnouncement}
          onDelete={handleDeleteAnnouncement}
          saving={annSaving}
          error={annError}
        />

        {/* Employee List Panel */}
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">👥</span>
              <h2 className="text-sm font-bold text-white">Employees</h2>
              <span className="text-[10px] font-bold text-dark-400 bg-dark-700 border border-dark-600
                               px-2 py-0.5 rounded-full">
                {filteredUsers.length}
              </span>
            </div>
          </div>

          {/* Search */}
          <input
            type="search"
            placeholder="Search name, ID or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field mb-3 text-sm"
          />

          {/* List */}
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-dark-700 rounded-xl" />)}
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-dark-400 text-center py-4">No employees found.</p>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left
                    transition-all duration-150 active:scale-[.99]
                    ${selected?.id === u.id
                      ? 'bg-brand-500/10 border-brand-500/40 ring-1 ring-brand-500/20'
                      : 'bg-dark-700/40 border-dark-600 hover:bg-dark-700/80 hover:border-dark-500'
                    }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600
                                  flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-white text-xs font-extrabold">
                      {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                      <span className="text-[10px] font-bold text-brand-300 font-mono
                                       bg-brand-500/10 border border-brand-500/20
                                       px-1.5 py-0.5 rounded shrink-0">
                        {u.employeeId}
                      </span>
                    </div>
                    <p className="text-[10px] text-dark-400 truncate mt-0.5">{u.email}</p>
                    <p className="text-[10px] text-dark-500 mt-0.5">
                      Joined {u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-bold text-violet-300">{fmt(u.totalOTHours)}h</p>
                    <p className="text-[10px] text-dark-400">{u.totalEntries} days</p>
                    {u.secondOffEntries > 0 && (
                      <span className="inline-block text-[9px] font-bold text-cyan-300
                                       bg-cyan-500/10 border border-cyan-500/25 px-1.5 py-0.5 rounded">
                        2nd Off ×{u.secondOffEntries}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Employee Detail Panel ───────────────────────────────────── */}
        {selected && (
          <EmployeeDetail
            user={selected}
            records={monthRecords}
            allRecords={userRecords}
            schedule={userSchedule}
            loading={recLoading}
            filterYear={filterYear}
            filterMonth={filterMonth}
            onYearChange={setFilterYear}
            onMonthChange={setFilterMonth}
            monthOTHours={monthOTHours}
            onClose={() => setSelected(null)}
          />
        )}
      </main>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, color }) {
  return (
    <div className="bg-dark-700/60 rounded-xl p-3 border border-dark-500">
      <p className="text-[10px] text-dark-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-extrabold tracking-tight leading-none ${color}`}>
        {value}
        {unit && <span className="text-xs font-medium text-dark-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

// ── Employee detail ───────────────────────────────────────────────────────────
function EmployeeDetail({ user, records, allRecords, schedule, loading, filterYear, filterMonth,
  onYearChange, onMonthChange, monthOTHours, onClose }) {

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const now      = new Date();

  // 2nd Off records for this month
  const monthSecondOff = useMemo(
    () => records.filter((r) => r.shiftType === '2nd Off'),
    [records]
  );

  // Month shift hours + full working hours
  const monthShiftHours = useMemo(() => {
    let sum = 0;
    Object.entries(schedule).forEach(([dateStr, shiftType]) => {
      const d = new Date(dateStr);
      if (d.getUTCFullYear() === filterYear && d.getUTCMonth() + 1 === filterMonth) {
        sum += getShiftDurationHours(shiftType);
      }
    });
    return sum;
  }, [schedule, filterYear, filterMonth]);
  const monthTotalWorkingHours = monthOTHours + monthShiftHours;

  // Available months that have records
  const availableMonths = useMemo(() => {
    const set = new Set();
    allRecords.forEach((r) => {
      const d = new Date(r.date);
      set.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
    });
    return Array.from(set).sort().reverse();
  }, [allRecords]);

  return (
    <div className="glass-card p-4 sm:p-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600
                        flex items-center justify-center shadow-lg shadow-brand-500/25 shrink-0">
          <span className="text-white text-base font-extrabold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white truncate">{user.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-[10px] font-bold text-brand-300 font-mono bg-brand-500/10
                             border border-brand-500/20 px-1.5 py-0.5 rounded">
              {user.employeeId}
            </span>
            <span className="text-[10px] text-dark-400 truncate">{user.email}</span>
          </div>
          <p className="text-[10px] text-dark-500 mt-0.5">
            Joined {user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </p>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-300
                     hover:text-white hover:bg-dark-600 transition-all duration-150 shrink-0">
          ✕
        </button>
      </div>

      {/* All-time mini stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-dark-700/50 rounded-xl p-2.5 border border-dark-500 flex flex-col justify-between">
          <p className="text-[9px] text-dark-400 uppercase tracking-wide mb-0.5">Total OT</p>
          <div>
            <p className="text-base font-extrabold text-brand-300 leading-none">
              {fmt(user.totalOTHours)}
              <span className="text-[10px] font-medium text-dark-400 ml-0.5">hrs</span>
            </p>
            <p className="text-[10px] text-dark-500 mt-1">{user.totalEntries} days</p>
          </div>
        </div>
        <div className="bg-dark-700/50 rounded-xl p-2.5 border border-dark-500">
          <p className="text-[9px] text-dark-400 uppercase tracking-wide mb-1">This Month Summary</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            <div>
              <p className="text-base font-extrabold text-teal-300 leading-none">
                {fmt(monthOTHours)}<span className="text-[9px] font-medium text-dark-400 ml-0.5">h</span>
              </p>
              <p className="text-[9px] text-dark-500">OT</p>
            </div>
            <div>
              <p className="text-base font-extrabold text-amber-300 leading-none">
                {fmt(monthShiftHours)}<span className="text-[9px] font-medium text-dark-400 ml-0.5">h</span>
              </p>
              <p className="text-[9px] text-dark-500">Shift</p>
            </div>
            <div className="col-span-2 pt-1.5 border-t border-dark-600">
              <p className="text-[10px] font-medium text-white flex justify-between">
                <span>Total Work:</span>
                <span className="font-bold text-brand-300">{fmt(monthTotalWorkingHours)} hrs</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* This month 2nd Off stats — only if any */}
      {monthSecondOff.length > 0 && (
        <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-2.5 mb-3">
          <p className="text-[9px] text-cyan-400 uppercase tracking-wide font-bold mb-0.5">This Month 2nd Off OT</p>
          <div className="flex items-end gap-2">
            <p className="text-base font-extrabold text-cyan-300 leading-none">
              {fmt(monthSecondOff.reduce((s, r) => s + (r.otHours || 0), 0))}
              <span className="text-[10px] font-medium text-dark-400 ml-0.5">hrs</span>
            </p>
            <p className="text-[10px] text-cyan-500 mb-0.5">{monthSecondOff.length} occurrences</p>
          </div>
        </div>
      )}

      {/* Month navigator */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => {
          if (filterMonth === 1) { onYearChange(filterYear - 1); onMonthChange(12); }
          else onMonthChange(filterMonth - 1);
        }} className="btn-icon">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="flex-1 text-center text-sm font-bold text-white">
          {MONTH_NAMES[filterMonth - 1]} {filterYear}
        </span>
        <button
          disabled={filterYear >= now.getFullYear() && filterMonth >= now.getMonth() + 1}
          onClick={() => {
            if (filterMonth === 12) { onYearChange(filterYear + 1); onMonthChange(1); }
            else onMonthChange(filterMonth + 1);
          }}
          className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Records list */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded-xl" />)}
        </div>
      ) : records.length === 0 ? (
        <p className="text-xs text-dark-400 text-center py-6">No OT recorded for this month.</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const d = new Date(r.date);
            const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
            return (
              <div key={r._id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border
                  ${r.shiftType === '2nd Off'
                    ? 'bg-cyan-500/10 border-cyan-500/25'
                    : 'bg-dark-700/40 border-dark-600'
                  }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-white truncate">{dateStr}</p>
                    {r.shiftType === '2nd Off' && (
                      <span className="text-[9px] font-bold text-cyan-300 bg-cyan-500/20
                                       border border-cyan-500/30 px-1.5 py-0.5 rounded shrink-0">
                        2nd Off
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-dark-400 truncate">{r.shiftType}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold mb-0.5 ${r.shiftType === '2nd Off' ? 'text-cyan-300' : 'text-brand-300'}`}>
                    {fmt(r.otHours)}h
                  </p>
                  {r.otStartTime && r.otEndTime && (
                    <p className="text-[9px] text-dark-500 leading-tight">OT: {r.otStartTime}–{r.otEndTime}</p>
                  )}
                  {r.pearlLoginTime && r.pearlLogoutTime && (
                    <p className="text-[9px] text-amber-400/80 leading-tight">Pearl: {r.pearlLoginTime}–{r.pearlLogoutTime}</p>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex justify-between items-center pt-1 border-t border-dark-600 mt-1">
            <span className="text-xs text-dark-400">{records.length} entries</span>
            <span className="text-sm font-bold text-brand-300">{fmt(monthOTHours)} hrs total</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Announcements Panel ───────────────────────────────────────────────────────
function AnnouncementsPanel({ announcements, showForm, onToggleForm, form, onFormChange, onSubmit, onDelete, saving, error }) {
  const active   = announcements.filter((a) => a.isActive);
  const inactive = announcements.filter((a) => !a.isActive);

  // Track expanded acceptances per announcement id
  const [expandedId,   setExpandedId]   = useState(null);
  const [acceptances,  setAcceptances]  = useState({});   // { [annId]: [] }
  const [loadingAccId, setLoadingAccId] = useState(null);

  async function toggleAcceptances(annId) {
    if (expandedId === annId) { setExpandedId(null); return; }
    setExpandedId(annId);
    if (acceptances[annId]) return; // already loaded
    setLoadingAccId(annId);
    try {
      const res = await api.adminGetAcceptances(annId);
      setAcceptances((prev) => ({ ...prev, [annId]: res.data || [] }));
    } catch { setAcceptances((prev) => ({ ...prev, [annId]: [] })); }
    finally   { setLoadingAccId(null); }
  }

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function fmt12h(t) {
    if (!t) return '';
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  return (
    <div className="glass-card p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📢</span>
          <h2 className="text-sm font-bold text-white">OT Announcements</h2>
          {active.length > 0 && (
            <span className="text-[10px] font-bold text-violet-300 bg-violet-500/15 border border-violet-500/30
                             px-2 py-0.5 rounded-full animate-pulse">
              {active.length} live
            </span>
          )}
        </div>
        <button
          onClick={onToggleForm}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-150
            ${showForm
              ? 'text-dark-300 bg-dark-700 border-dark-500 hover:border-dark-400'
              : 'text-violet-300 bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/20'
            }`}
        >
          {showForm ? '✕ Cancel' : '+ New Announcement'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={onSubmit} className="mb-4 p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-2.5 animate-slide-up">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">New Special OT Announcement</p>

          {error && (
            <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Title */}
          <div>
            <label className="text-[10px] text-dark-400 font-semibold block mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => onFormChange('title', e.target.value)}
              placeholder="e.g. Special OT Available – This Saturday!"
              className="input-field text-sm"
              required
            />
          </div>

          {/* OT Date */}
          <div>
            <label className="text-[10px] text-dark-400 font-semibold block mb-1">OT Date *</label>
            <input
              type="date"
              value={form.otDate}
              onChange={(e) => onFormChange('otDate', e.target.value)}
              className="input-field text-sm"
              required
            />
          </div>

          {/* Time Mode Selection */}
          <div>
            <label className="text-[10px] text-dark-400 font-semibold block mb-2">Time Mode</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="timeMode"
                  value="shift"
                  checked={form.timeMode === 'shift'}
                  onChange={(e) => {
                    onFormChange('timeMode', 'shift');
                    onFormChange('shiftType', '8:00 AM - 4:00 PM');
                  }}
                  className="accent-violet-500"
                />
                Shift Time
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="timeMode"
                  value="custom"
                  checked={form.timeMode === 'custom'}
                  onChange={(e) => {
                    onFormChange('timeMode', 'custom');
                    onFormChange('shiftType', 'Custom');
                  }}
                  className="accent-violet-500"
                />
                Custom Time
              </label>
            </div>
          </div>

          {/* Conditional Time Inputs */}
          {form.timeMode === 'shift' ? (
            <div>
              <label className="text-[10px] text-dark-400 font-semibold block mb-1">
                Select Shift <span className="text-violet-400">(Auto-populates OT record)</span>
              </label>
              <select
                value={form.shiftType}
                onChange={(e) => onFormChange('shiftType', e.target.value)}
                className="input-field text-sm"
              >
                {getAvailableShiftTypes(form.otDate).filter(s => s !== 'Custom').map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-dark-400 font-semibold block mb-1">Start Time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => onFormChange('startTime', e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-dark-400 font-semibold block mb-1">End Time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => onFormChange('endTime', e.target.value)}
                  className="input-field text-sm"
                />
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="text-[10px] text-dark-400 font-semibold block mb-1">Message (optional)</label>
            <textarea
              value={form.message}
              onChange={(e) => onFormChange('message', e.target.value)}
              placeholder="Additional details for employees…"
              rows={2}
              className="input-field text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: saving ? '#4c1d95' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
            }}
          >
            {saving ? 'Posting…' : '📢 Post Announcement'}
          </button>
        </form>
      )}

      {/* Active announcements */}
      {active.length === 0 && !showForm && (
        <p className="text-xs text-dark-400 text-center py-3">No active announcements. Click "+ New Announcement" to notify employees.</p>
      )}

      {active.length > 0 && (
        <div className="space-y-3 mb-3">
          {active.map((a) => {
            const isExpanded   = expandedId === a._id;
            const accList      = acceptances[a._id] || [];
            const isLoadingAcc = loadingAccId === a._id;
            const accCount     = a.acceptanceCount ?? accList.length;

            return (
              <div
                key={a._id}
                className="rounded-xl border overflow-hidden"
                style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)' }}
              >
                {/* Main card row */}
                <div className="flex items-start gap-3 p-3">
                  <span className="text-lg shrink-0 mt-0.5">📢</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{a.title}</p>
                    <p className="text-[10px] text-violet-300 mt-0.5">
                      📅 {fmtDate(a.otDate)}
                      {(a.startTime || a.endTime) && (
                        <> &nbsp;·&nbsp; ⏰ {fmt12h(a.startTime)}{a.startTime && a.endTime ? '–' : ''}{fmt12h(a.endTime)}</>
                      )}
                    </p>
                    {a.message && <p className="text-[11px] text-dark-400 mt-1 line-clamp-2">{a.message}</p>}

                    {/* Acceptance count + expand button */}
                    <button
                      onClick={() => toggleAcceptances(a._id)}
                      className="mt-2 flex items-center gap-1.5 text-[10px] font-bold transition-all duration-150"
                      style={{ color: isExpanded ? '#a78bfa' : '#7c3aed' }}
                    >
                      <span
                        className="px-2 py-0.5 rounded-full font-extrabold"
                        style={{
                          background: accCount > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                          color:      accCount > 0 ? '#6ee7b7' : '#64748b',
                          border:     accCount > 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(100,116,139,0.2)',
                        }}
                      >
                        {accCount} accepted
                      </span>
                      {isLoadingAcc
                        ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        : <span>{isExpanded ? '▲ Hide' : '▼ View'}</span>
                      }
                    </button>
                  </div>

                  <button
                    onClick={() => onDelete(a._id)}
                    title="Deactivate announcement"
                    className="text-[10px] font-bold text-red-400 hover:text-red-300
                               bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40
                               px-2 py-1 rounded-lg transition-all duration-150 shrink-0"
                  >
                    Remove
                  </button>
                </div>

                {/* Expandable acceptances list */}
                {isExpanded && (
                  <div
                    className="border-t px-3 py-2.5 space-y-1.5"
                    style={{ borderColor: 'rgba(139,92,246,0.2)', background: 'rgba(0,0,0,0.15)' }}
                  >
                    {isLoadingAcc ? (
                      <p className="text-[10px] text-dark-400 text-center py-2 animate-pulse">Loading…</p>
                    ) : accList.length === 0 ? (
                      <p className="text-[10px] text-dark-500 text-center py-2">No one has accepted yet.</p>
                    ) : (
                      accList.map((u, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[9px] font-extrabold text-white"
                            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
                          >
                            {(u.name || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-white truncate">{u.name}</p>
                            <p className="text-[10px] text-dark-400">{u.employeeId}</p>
                          </div>
                          <p className="text-[10px] text-dark-500 shrink-0">
                            {new Date(u.acceptedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Past / deactivated */}
      {inactive.length > 0 && (
        <details className="mt-1">
          <summary className="text-[10px] text-dark-500 cursor-pointer hover:text-dark-300 transition-colors">
            {inactive.length} past announcement{inactive.length > 1 ? 's' : ''}
          </summary>
          <div className="space-y-1.5 mt-2">
            {inactive.map((a) => (
              <div key={a._id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/30 border border-dark-600/50 opacity-50">
                <span className="text-xs">📢</span>
                <p className="text-[11px] text-dark-400 truncate flex-1">{a.title}</p>
                <p className="text-[10px] text-dark-500 shrink-0">{fmtDate(a.otDate)}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
