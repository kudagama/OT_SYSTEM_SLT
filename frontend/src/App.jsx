import { useState, useEffect, useCallback, useMemo } from 'react';
import Dashboard              from './components/Dashboard';
import OTForm                 from './components/OTForm';
import OTHistory              from './components/OTHistory';
import AuthScreen             from './components/AuthScreen';
import ProfileModal           from './components/ProfileModal';
import WeeklySchedule         from './components/WeeklySchedule';
import AdminDashboard         from './components/AdminDashboard';
import OTAnnouncementPopup    from './components/OTAnnouncementPopup';
import OTAnnouncementsSection from './components/OTAnnouncementsSection';
import { api }                from './api';
import { getShiftDurationHours, todayISODate } from './constants';

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getStoredToken() {
  localStorage.removeItem('ot_user'); // purge legacy cached user — we load from DB now
  return localStorage.getItem('ot_token');
}

export default function App() {
  const now = new Date();

  const [user, setUser]               = useState(null);   // hydrated from DB
  const [hydrating, setHydrating]     = useState(!!getStoredToken()); // show spinner on startup
  const [records, setRecords]         = useState([]);
  const [schedule, setSchedule]       = useState({});   // { "YYYY-MM-DD": "shiftType" }
  const [shiftChanges, setShiftChanges] = useState({}); // { "YYYY-MM-DD": "previousShiftType" }
  const [loadingRec, setLoadingRec]   = useState(true);
  const [schedSaving, setSchedSaving] = useState(false);
  const [editRecord, setEditRecord]   = useState(null);
  const [error, setError]             = useState(null);
  const [annError, setAnnError]       = useState(null); // DEBUG for announcements
  const [showProfile, setShowProfile] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedOTDate, setSelectedOTDate] = useState(todayISODate());

  // ── Selected month ────────────────────────────────────────────────────────
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);

  const isCurrentMonth =
    selYear === now.getFullYear() && selMonth === now.getMonth() + 1;

  function goToPrevMonth() {
    if (selMonth === 1) { setSelYear((y) => y - 1); setSelMonth(12); }
    else                { setSelMonth((m) => m - 1); }
  }
  function goToNextMonth() {
    if (isCurrentMonth) return;
    if (selMonth === 12) { setSelYear((y) => y + 1); setSelMonth(1); }
    else                 { setSelMonth((m) => m + 1); }
  }
  function goToPrevYear() { setSelYear((y) => y - 1); }
  function goToNextYear() {
    const nextYear = selYear + 1;
    if (nextYear > now.getFullYear()) return;
    if (nextYear === now.getFullYear() && selMonth > now.getMonth() + 1)
      setSelMonth(now.getMonth() + 1);
    setSelYear(nextYear);
  }
  function goToToday() {
    setSelYear(now.getFullYear());
    setSelMonth(now.getMonth() + 1);
  }

  // ── Hydrate user from DB on startup ──────────────────────────────────────
  useEffect(() => {
    if (!getStoredToken()) { setHydrating(false); return; }
    api.me()
      .then((res) => setUser(res.user ?? res))   // /auth/me returns { user } or user directly
      .catch(() => {
        localStorage.removeItem('ot_token');      // token invalid — force re-login
      })
      .finally(() => setHydrating(false));
  }, []);

  // ── Fetch records ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoadingRec(true);
    try {
      const res = await api.getAll();
      setRecords(res.data);
      setError(null);
    } catch (err) {
      if (err.message.includes('token') || err.message.includes('log in')) {
        handleLogout();
      } else {
        setError(err.message);
      }
    } finally {
      setLoadingRec(false);
    }
  }, []);

  // ── Fetch schedule ────────────────────────────────────────────────────────
  const fetchSchedule = useCallback(async () => {
    try {
      const res = await api.getSchedule();
      setSchedule(res.entries || {});
      setShiftChanges(res.shiftChanges || {});
    } catch { /* non-critical — summary still works from records */ }
  }, []);

  useEffect(() => {
    let interval;
    if (user && user.role !== 'admin') {
      fetchRecords();
      fetchSchedule();
      
      const fetchAnnouncements = () => {
        api.getActiveAnnouncements()
          .then((res) => {
            const todayStr = todayISODate();
            const valid = (res.data || []).filter(a => {
              if (!a.otDate) return true;
              return new Date(a.otDate).toISOString().split('T')[0] >= todayStr;
            });
            setAnnouncements(valid);
          })
          .catch((err) => {
            console.error("Announcements fetch error:", err);
            setAnnError(err.message);
          });
      };

      // Initial fetch
      fetchAnnouncements();

      // Poll every 10 seconds for real-time updates (e.g. when someone else accepts a slot)
      interval = setInterval(fetchAnnouncements, 10000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, fetchRecords, fetchSchedule]);

  // ── Schedule mutations (lifted from WeeklySchedule) ───────────────────────
  const handleSetShift = useCallback(async (dateKey, shiftType, previousShift = null) => {
    setSchedule((prev) => ({ ...prev, [dateKey]: shiftType })); // optimistic
    if (previousShift) {
      setShiftChanges((prev) => ({ ...prev, [dateKey]: previousShift }));
    } else {
      setShiftChanges((prev) => { const n = { ...prev }; delete n[dateKey]; return n; });
    }
    setSchedSaving(true);
    try {
      const res = await api.setScheduleDay(dateKey, { shiftType, previousShift });
      setSchedule(res.entries || {});
      setShiftChanges(res.shiftChanges || {});
      fetchRecords(); // To pick up any auto-generated OT
    } catch {
      fetchSchedule(); // revert
    } finally { setSchedSaving(false); }
  }, [fetchRecords, fetchSchedule]);

  const handleClearShift = useCallback(async (dateKey) => {
    setSchedule((prev) => { const n = { ...prev }; delete n[dateKey]; return n; });
    setShiftChanges((prev) => { const n = { ...prev }; delete n[dateKey]; return n; });
    setSchedSaving(true);
    try {
      const res = await api.deleteScheduleDay(dateKey);
      setSchedule(res.entries || {});
      setShiftChanges(res.shiftChanges || {});
      fetchRecords(); // To remove any auto-generated OT
    } catch {
      fetchSchedule(); // revert
    } finally { setSchedSaving(false); }
  }, [fetchSchedule, fetchRecords]);

  // ── Enhanced summary (records + schedule for selected month) ──────────────
  const summary = useMemo(() => {
    // OT records for this month
    const monthRecords = records.filter((r) => {
      const d = new Date(r.date);
      return d.getUTCFullYear() === selYear && d.getUTCMonth() + 1 === selMonth;
    });

    // Schedule entries for this month (as { dateKey: shiftType })
    const monthSchedule = Object.fromEntries(
      Object.entries(schedule).filter(([key]) => {
        const [y, m] = key.split('-').map(Number);
        return y === selYear && m === selMonth;
      })
    );

    // Merge: dayMap[dateKey] = { otHours, shiftType }
    // OT records take priority for shiftType (authoritative)
    const dayMap = {};
    monthRecords.forEach((r) => {
      const key = new Date(r.date).toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
      if (dayMap[key]) {
        dayMap[key].otHours += r.otHours || 0;
      } else {
        dayMap[key] = { otHours: r.otHours || 0, shiftType: r.shiftType };
      }
    });
    // Add schedule days that have no OT record
    Object.entries(monthSchedule).forEach(([key, shiftType]) => {
      if (!dayMap[key]) dayMap[key] = { otHours: 0, shiftType };
    });

    const allDays = Object.values(dayMap);

    const totalOTHours      = allDays.reduce((s, d) => s + d.otHours, 0);
    const totalOTDays       = monthRecords.length;
    const totalShiftHours   = allDays.reduce((s, d) => s + getShiftDurationHours(d.shiftType), 0);
    const totalShiftDays    = allDays.reduce((s, d) => {
      if (d.shiftType === 'Duty Leave' || d.shiftType === 'Training') return s;
      return s + 1;
    }, 0); // unique days with any activity (excluding Training/Duty Leave)
    const totalWorkingHours = totalShiftHours + totalOTHours;

    const secondOffOTHours  = allDays.reduce((s, d) => s + (d.shiftType === '2nd Off' ? d.otHours : 0), 0);
    const secondOffOTDays   = allDays.reduce((s, d) => s + ((d.shiftType === '2nd Off' && d.otHours > 0) ? 1 : 0), 0);

    const normalOTHours     = totalOTHours - secondOffOTHours;
    const normalOTAmount    = normalOTHours * 200;
    const secondOffOTAmount = secondOffOTHours * 250;
    const totalOTAmount     = normalOTAmount + secondOffOTAmount;

    return { totalOTHours, totalOTDays, totalShiftHours, totalShiftDays, totalWorkingHours, secondOffOTHours, secondOffOTDays, normalOTHours, normalOTAmount, secondOffOTAmount, totalOTAmount };
  }, [records, schedule, selYear, selMonth]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  function handleAuth(loggedInUser) { setUser(loggedInUser); }

  function handleLogout() {
    localStorage.removeItem('ot_token');    // only the token — no ot_user to clean
    setUser(null); setRecords([]); setSchedule({}); setShiftChanges({});
    setEditRecord(null); setError(null);
  }

  function handleProfileUpdate(updatedUser) {
    setUser(updatedUser);                   // in-memory only — no localStorage
  }

  // ── Data handlers ─────────────────────────────────────────────────────────
  const handleSaved = useCallback(() => {
    fetchRecords();
    setEditRecord(null);
  }, [fetchRecords]);

  const handleDelete = useCallback(async (id) => {
    try {
      await api.remove(id);
      setRecords((prev) => prev.filter((r) => r._id !== id));
    } catch (err) { setError(err.message); }
  }, []);

  // ── Loading state while hydrating from DB ────────────────────────────────
  if (hydrating) {
    return (
      <div className="min-h-dvh bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600
                          flex items-center justify-center shadow-2xl shadow-brand-500/40">
            <span className="text-white text-xl font-extrabold">WT</span>
          </div>
          <svg className="w-5 h-5 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-xs text-dark-400">Loading your account…</p>
        </div>
      </div>
    );
  }

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!user) return <AuthScreen onAuth={handleAuth} />;

  // ── Admin role → Admin Dashboard ──────────────────────────────────────────
  if (user.role === 'admin') {
    return (
      <AdminDashboard
        adminUser={user}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-dark-900">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-dark-900/90 backdrop-blur-md border-b border-dark-700"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <span className="text-white text-xs font-extrabold">WT</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">WorkTrack</h1>
              <p className="text-[10px] text-dark-400 leading-none mt-0.5">{user.name}</p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-300 bg-dark-800 border border-dark-600 px-2.5 py-1 rounded-lg">
              {now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
            </span>
            <button
              id="header-profile-btn"
              onClick={() => setShowProfile(true)}
              title="View profile"
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600
                         flex items-center justify-center shadow-md shadow-brand-500/20
                         hover:scale-105 active:scale-95 transition-all duration-150 shrink-0"
            >
              <span className="text-white text-[10px] font-extrabold leading-none">
                {(user.name || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-safe">
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-sm animate-fade-in">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Connection Error</p>
              <p className="text-xs text-red-400">{error} — Is the backend running?</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        <Dashboard
          summary={summary}
          loading={loadingRec}
          selYear={selYear}
          selMonth={selMonth}
          isCurrentMonth={isCurrentMonth}
          onPrev={goToPrevMonth}
          onNext={goToNextMonth}
          onPrevYear={goToPrevYear}
          onNextYear={goToNextYear}
          onToday={goToToday}
        />

        {/* OT Announcements Section — shown when active slots exist */}
        <OTAnnouncementsSection
          announcements={announcements}
          onAnnouncementsChange={setAnnouncements}
          userSchedule={schedule}
        />

        {/* Weekly shift schedule — fully controlled by App */}
        <WeeklySchedule
          schedule={schedule}
          shiftChanges={shiftChanges}
          saving={schedSaving}
          onSetShift={handleSetShift}
          onClearShift={handleClearShift}
          selYear={selYear}
          selMonth={selMonth}
          onMonthChange={(y, m) => { setSelYear(y); setSelMonth(m); }}
          onSelectDay={setSelectedOTDate}
        />

        {/* OT Entry Form */}
        <OTForm
          onSaved={handleSaved}
          editRecord={editRecord}
          onCancelEdit={() => setEditRecord(null)}
          schedule={schedule}
          selectedDate={selectedOTDate}
        />

        {/* History */}
        <OTHistory
          records={records}
          loading={loadingRec}
          filterYear={selYear}
          filterMonth={selMonth}
          onEdit={(record) => { setEditRecord(record); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onDelete={handleDelete}
        />
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-dark-900/90 backdrop-blur-md border-t border-dark-700 text-center"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: '0.5rem' }}>
        <p className="text-xs text-dark-400 pb-1">WorkTrack · {user.name}'s records</p>
      </footer>

      {/* ── Profile Modal ────────────────────────────────────────────────── */}
      {showProfile && (
        <ProfileModal
          user={user}
          records={records}
          onClose={() => setShowProfile(false)}
          onLogout={() => { setShowProfile(false); handleLogout(); }}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
      {/* ── OT Announcement Popup (employees only) ──────────────────────── */}
      <OTAnnouncementPopup announcements={announcements} />
    </div>
  );
}
