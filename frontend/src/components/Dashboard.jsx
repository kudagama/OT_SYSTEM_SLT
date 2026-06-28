import { useMemo } from 'react';

const OT_GOAL = 100; // monthly OT hour goal for progress bar

function NavBtn({ onClick, disabled, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`btn-icon transition-all duration-150
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

// Mini stat tile
function StatTile({ label, value, unit, color = 'text-white', accent }) {
  return (
    <div className={`bg-dark-700/60 rounded-xl p-3 sm:p-3.5 border border-dark-500 ${accent || ''}`}>
      <p className="text-[10px] text-dark-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl sm:text-2xl font-extrabold tracking-tight leading-none ${color}`}>
        {value}
        <span className="text-xs font-medium text-dark-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}

export default function Dashboard({
  summary, loading,
  selYear, selMonth, isCurrentMonth,
  onPrev, onNext, onPrevYear, onNextYear, onToday,
}) {
  const {
    totalOTHours      = 0,
    totalOTDays       = 0,
    totalShiftHours   = 0,
    totalShiftDays    = 0,
    totalWorkingHours = 0,
    secondOffOTHours  = 0,
    secondOffOTDays   = 0,
  } = summary || {};

  const progressPct = useMemo(
    () => Math.min(100, Math.round((totalOTHours / OT_GOAL) * 100)),
    [totalOTHours]
  );

  const monthLabel = useMemo(() => {
    if (!selYear || !selMonth) return '—';
    return new Date(selYear, selMonth - 1, 1).toLocaleDateString('en-GB', {
      month: 'long', year: 'numeric',
    });
  }, [selYear, selMonth]);

  const barColor =
    progressPct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-green-400'
    : progressPct >= 60 ? 'bg-gradient-to-r from-brand-500 to-indigo-400'
    :                     'bg-gradient-to-r from-brand-600 to-violet-500';

  const atCurrentYear = selYear >= new Date().getFullYear();
  const hasData = totalShiftDays > 0 || totalOTDays > 0;

  return (
    <div className="glass-card p-4 sm:p-5 animate-slide-up">

      {/* ── Row 1: Label + Month title ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-dark-300">
            Monthly Summary
          </p>
          <h2 className="text-base sm:text-lg font-bold text-white mt-0.5 truncate">
            {monthLabel}
          </h2>
        </div>
        {!isCurrentMonth && (
          <button
            onClick={onToday}
            className="shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider
                       text-brand-300 bg-brand-500/10 border border-brand-500/25 rounded-xl
                       hover:bg-brand-500/20 active:bg-brand-500/30 transition-all duration-150 animate-fade-in"
          >
            Today
          </button>
        )}
      </div>

      {/* ── Row 2: Navigation bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-1 mb-4">
        <div className="flex items-center gap-1">
          <NavBtn onClick={onPrevYear} title="Previous year">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </svg>
          </NavBtn>
          <NavBtn onClick={onPrev} title="Previous month">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </NavBtn>
        </div>

        <span className="text-xs font-bold text-dark-200 bg-dark-700 border border-dark-500
                         px-3 py-1 rounded-lg select-none">
          {selYear}
        </span>

        <div className="flex items-center gap-1">
          <NavBtn onClick={onNext} disabled={isCurrentMonth}
            title={isCurrentMonth ? 'Current month' : 'Next month'}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </NavBtn>
          <NavBtn onClick={onNextYear} disabled={atCurrentYear}
            title={atCurrentYear ? 'Current year' : 'Next year'}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </NavBtn>
        </div>
      </div>

      {/* ── Stats & Progress ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="grid grid-cols-2 gap-2.5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-dark-700 rounded-xl" />)}
          </div>
          <div className="h-14 bg-dark-700 rounded-xl" />
          <div className="h-3 bg-dark-700 rounded-full" />
        </div>
      ) : (
        <>
          {/* ── Total Working Hours — prominent single row ─────────────── */}
          <div className="bg-gradient-to-r from-dark-700/80 to-dark-700/40 rounded-xl p-3.5
                          border border-dark-500 mb-2.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-dark-400 uppercase tracking-wide mb-0.5">Total Working Hours</p>
              <p className="text-3xl font-extrabold tracking-tight text-white leading-none">
                {totalWorkingHours.toFixed(1)}
                <span className="text-sm font-medium text-dark-400 ml-1">hrs</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-dark-400 uppercase tracking-wide mb-0.5">Working Days</p>
              <p className="text-2xl font-extrabold tracking-tight text-amber-300 leading-none">
                {totalShiftDays}
                <span className="text-xs font-medium text-dark-400 ml-1">days</span>
              </p>
            </div>
          </div>

          {/* ── 2×2 grid: OT + Shift breakdown ───────────────────────── */}
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <StatTile label="OT Hours"   value={totalOTHours.toFixed(1)} unit="hrs"  color="text-brand-300" />
            <StatTile label="OT Days"    value={totalOTDays}             unit="days" color="text-violet-300" />
            <StatTile label="Shift Hours" value={totalShiftHours.toFixed(1)} unit="hrs"  color="text-teal-300" />
            <StatTile label="Shift Days"  value={totalShiftDays}             unit="days" color="text-sky-300" />
          </div>

          {/* ── 2nd Off OT Card ────────────────────────────────────────── */}
          <div className="bg-cyan-500/10 rounded-xl p-3.5 border border-cyan-500/20 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0 shadow-inner">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-cyan-400/80 uppercase tracking-wide mb-0.5">2nd Off OT Hours</p>
                <p className="text-xl font-extrabold tracking-tight text-cyan-300 leading-none">
                  {secondOffOTHours.toFixed(1)}
                  <span className="text-xs font-medium text-cyan-500/80 ml-1">hrs</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-cyan-400/80 uppercase tracking-wide mb-0.5">2nd Off OT Days</p>
              <p className="text-xl font-extrabold tracking-tight text-cyan-300 leading-none">
                {secondOffOTDays}
                <span className="text-xs font-medium text-cyan-500/80 ml-1">days</span>
              </p>
            </div>
          </div>

          {/* No data message */}
          {!hasData && !isCurrentMonth && (
            <p className="text-xs text-dark-400 text-center py-1">
              No data recorded for {monthLabel}.
            </p>
          )}

          {/* OT progress bar */}
          {totalOTDays > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-dark-300">OT Goal: {OT_GOAL}h</span>
                <span className={`text-xs font-bold
                  ${progressPct >= 100 ? 'text-emerald-400' : 'text-brand-400'}`}>
                  {progressPct}%
                </span>
              </div>
              <div className="h-2.5 bg-dark-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {progressPct >= 100 && (
                <p className="text-xs text-emerald-400 mt-2 font-medium">
                  🎉 OT goal reached! Great work this month.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
