import { useMemo } from 'react';

const MONTH_GOAL = 100;

// Reusable nav icon button
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

export default function Dashboard({
  summary, loading,
  selYear, selMonth, isCurrentMonth,
  onPrev, onNext, onPrevYear, onNextYear, onToday,
}) {
  const { totalOTHours = 0, totalEntries = 0 } = summary || {};

  const progressPct = useMemo(
    () => Math.min(100, Math.round((totalOTHours / MONTH_GOAL) * 100)),
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

        {/* Today pill — only when not on current month */}
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

      {/* ── Row 2: Navigation bar ««  ‹  [year label]  ›  »» ─────────────── */}
      <div className="flex items-center justify-between gap-1 mb-4">
        {/* Left group: year-back + month-back */}
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

        {/* Centre: year pill */}
        <span className="text-xs font-bold text-dark-200 bg-dark-700 border border-dark-500
                         px-3 py-1 rounded-lg select-none">
          {selYear}
        </span>

        {/* Right group: month-forward + year-forward */}
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
          <div className="h-16 bg-dark-700 rounded-xl" />
          <div className="h-3 bg-dark-700 rounded-full" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-dark-700/60 rounded-xl p-3 sm:p-4 border border-dark-500">
              <p className="text-xs text-dark-300 mb-0.5">Total OT Hours</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {totalOTHours.toFixed(1)}
                <span className="text-sm font-medium text-dark-300 ml-1">hrs</span>
              </p>
            </div>
            <div className="bg-dark-700/60 rounded-xl p-3 sm:p-4 border border-dark-500">
              <p className="text-xs text-dark-300 mb-0.5">Days Logged</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {totalEntries}
                <span className="text-sm font-medium text-dark-300 ml-1">days</span>
              </p>
            </div>
          </div>

          {/* No data */}
          {totalEntries === 0 && !isCurrentMonth && (
            <p className="text-xs text-dark-400 text-center py-1">
              No OT recorded for {monthLabel}.
            </p>
          )}

          {/* Progress bar */}
          {totalEntries > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-dark-300">Goal: {MONTH_GOAL}h</span>
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
                  🎉 Goal reached! Great work this month.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
