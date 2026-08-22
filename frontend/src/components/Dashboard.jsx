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
  leaveStats, user,
  selYear, selMonth, isCurrentMonth,
  onPrev, onNext, onPrevYear, onNextYear, onToday,
}) {
  const {
    totalOTHours      = 0,
    totalOTDays       = 0,
    totalShiftHours   = 0,
    totalShiftDays    = 0,
    totalWorkingHours = 0,
    totalCalls        = 0,
    secondOffOTHours  = 0,
    secondOffOTDays   = 0,
    normalOTHours     = 0,
    normalOTAmount    = 0,
    secondOffOTAmount = 0,
    totalOTAmount     = 0,
    prevMonthShortfall = 0,
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

  const CALL_GOAL = 2000;
  const combinedGoal = CALL_GOAL + prevMonthShortfall;
  
  const callsRemaining = Math.max(0, CALL_GOAL - totalCalls);
  const combinedCallsRemaining = Math.max(0, combinedGoal - totalCalls);
  
  const dailyCallsNeeded = useMemo(() => {
    if (!isCurrentMonth || !selYear || !selMonth) return 0;
    const now = new Date();
    const today = now.getDate();
    const totalDays = new Date(selYear, selMonth, 0).getDate();
    const remainingDays = totalDays - today + 1; // Include today
    return remainingDays > 0 ? Math.ceil(callsRemaining / remainingDays) : 0;
  }, [isCurrentMonth, selYear, selMonth, callsRemaining]);

  const dailyCombinedNeeded = useMemo(() => {
    if (!isCurrentMonth || !selYear || !selMonth || prevMonthShortfall === 0) return 0;
    const now = new Date();
    const today = now.getDate();
    const totalDays = new Date(selYear, selMonth, 0).getDate();
    const remainingDays = totalDays - today + 1; // Include today
    return remainingDays > 0 ? Math.ceil(combinedCallsRemaining / remainingDays) : 0;
  }, [isCurrentMonth, selYear, selMonth, combinedCallsRemaining, prevMonthShortfall]);

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
          {/* ── Working Stats ─────────────── */}
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

          {/* ── Call Target Card ─────────────── */}
          <div className="bg-dark-700/40 rounded-xl p-4 border border-brand-500/20 mb-2.5 relative overflow-hidden shadow-lg">
            {/* Subtle glow effect */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-500/10 blur-2xl rounded-full pointer-events-none" />
            
            <div className="flex justify-between items-end mb-3 relative z-10">
              <div>
                <p className="text-[10px] text-brand-300/80 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-bold">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Monthly Call Target
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-brand-400 tracking-tight leading-none drop-shadow-sm">{totalCalls}</span>
                  <span className="text-sm font-semibold text-dark-400 flex items-center gap-1">
                    / {CALL_GOAL} 
                    {prevMonthShortfall > 0 && (
                      <span className="text-fuchsia-400/80 text-[10px] bg-fuchsia-500/10 px-1.5 py-0.5 rounded border border-fuchsia-500/20">
                        + {prevMonthShortfall} missed
                      </span>
                    )}
                  </span>
                </div>
              </div>
              
              {isCurrentMonth && (
                <div className="flex flex-col items-end gap-1.5">
                  {callsRemaining > 0 ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-dark-400 uppercase tracking-widest mb-0.5">Base Target</span>
                      <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                        {dailyCallsNeeded} <span className="text-[9px] font-semibold text-amber-400/80 uppercase">/ day</span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm uppercase tracking-wider">
                      <span>✓</span> Base Reached
                    </span>
                  )}

                  {prevMonthShortfall > 0 && (
                    combinedCallsRemaining > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-fuchsia-400/80 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                          To Cover Shortfall
                        </span>
                        <span className="text-xs font-extrabold text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                          {dailyCombinedNeeded} <span className="text-[9px] font-semibold text-fuchsia-400/80 uppercase">/ day</span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm uppercase tracking-wider">
                        <span>🎉</span> All Cleared!
                      </span>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 w-full bg-dark-800 rounded-full overflow-hidden z-10 border border-dark-600/50">
              <div 
                className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out rounded-full ${
                  combinedCallsRemaining === 0 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                    : 'bg-gradient-to-r from-brand-600 to-brand-400'
                }`}
                style={{ width: `${Math.min(100, (totalCalls / combinedGoal) * 100)}%` }}
              />
            </div>
          </div>

          {/* ── Yearly Leave Balances ─────────────────────────────────── */}
          {(user?.casualLeaveAllowance > 0 || user?.sickLeaveAllowance > 0 || leaveStats?.casualTaken > 0 || leaveStats?.sickTaken > 0) && (
            <div className="bg-dark-700/40 rounded-xl p-4 border border-fuchsia-500/10 mb-2.5 relative overflow-hidden shadow-lg">
              {/* Subtle background glow */}
              <div className="absolute -left-4 -top-4 w-24 h-24 bg-fuchsia-500/10 blur-2xl rounded-full pointer-events-none" />
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-red-500/10 blur-2xl rounded-full pointer-events-none" />

              <p className="text-[10px] text-dark-300 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-bold relative z-10">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {selYear} Leave Balances
              </p>

              <div className="grid grid-cols-2 gap-3 relative z-10">
                {/* Casual Leave */}
                <div className="bg-dark-800/60 rounded-xl p-3 border border-fuchsia-500/20 shadow-inner">
                  <p className="text-[10px] text-fuchsia-400/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    Casual
                  </p>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-[9px] text-dark-400 uppercase tracking-wide block mb-0.5">Remaining</span>
                      <span className="text-2xl font-extrabold text-white leading-none drop-shadow-sm">
                        {(user?.casualLeaveAllowance || 0) - (leaveStats?.casualTaken || 0)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-dark-400 uppercase tracking-wide block mb-0.5">Taken</span>
                      <span className="text-lg font-bold text-fuchsia-400 leading-none">
                        {leaveStats?.casualTaken || 0}
                      </span>
                    </div>
                  </div>
                  {/* Mini Progress bar */}
                  <div className="h-1.5 w-full bg-dark-900 rounded-full overflow-hidden border border-dark-700/50">
                    <div 
                      className="h-full bg-gradient-to-r from-fuchsia-600 to-fuchsia-400 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, ((leaveStats?.casualTaken || 0) / Math.max(1, user?.casualLeaveAllowance || 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Sick Leave */}
                <div className="bg-dark-800/60 rounded-xl p-3 border border-red-500/20 shadow-inner">
                  <p className="text-[10px] text-red-400/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    Sick
                  </p>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-[9px] text-dark-400 uppercase tracking-wide block mb-0.5">Remaining</span>
                      <span className="text-2xl font-extrabold text-white leading-none drop-shadow-sm">
                        {(user?.sickLeaveAllowance || 0) - (leaveStats?.sickTaken || 0)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-dark-400 uppercase tracking-wide block mb-0.5">Taken</span>
                      <span className="text-lg font-bold text-red-400 leading-none">
                        {leaveStats?.sickTaken || 0}
                      </span>
                    </div>
                  </div>
                  {/* Mini Progress bar */}
                  <div className="h-1.5 w-full bg-dark-900 rounded-full overflow-hidden border border-dark-700/50">
                    <div 
                      className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, ((leaveStats?.sickTaken || 0) / Math.max(1, user?.sickLeaveAllowance || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 2×2 grid: OT + Shift breakdown ───────────────────────── */}
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <StatTile label="OT Hours"   value={totalOTHours.toFixed(1)} unit="hrs"  color="text-brand-300" />
            <StatTile label="OT Days"    value={totalOTDays}             unit="days" color="text-violet-300" />
            <StatTile label="Shift Hours" value={totalShiftHours.toFixed(1)} unit="hrs"  color="text-teal-300" />
            <StatTile label="Shift Days"  value={totalShiftDays}             unit="days" color="text-sky-300" />
          </div>

          {/* ── 2nd Off OT Card ────────────────────────────────────────── */}
          <div className="bg-cyan-500/10 rounded-xl p-3.5 border border-cyan-500/20 mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0 shadow-inner">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] text-cyan-400/80 uppercase tracking-wide mb-0.5">2nd Off OT</p>
                <div className="flex items-end gap-2">
                  <p className="text-xl font-extrabold tracking-tight text-cyan-300 leading-none">
                    {secondOffOTHours.toFixed(1)}
                    <span className="text-xs font-medium text-cyan-500/80 ml-1">hrs</span>
                  </p>
                  <p className="text-[10px] font-bold text-cyan-200 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30">
                    Rs. {secondOffOTAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-cyan-400/80 uppercase tracking-wide mb-0.5">Days</p>
              <p className="text-xl font-extrabold tracking-tight text-cyan-300 leading-none">
                {secondOffOTDays}
              </p>
            </div>
          </div>

          {/* ── Financial Summary Card ─────────────────────────────────── */}
          <div className="bg-gradient-to-r from-brand-900/40 to-emerald-900/30 rounded-xl p-3.5 border border-emerald-500/20 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-brand-300/80 uppercase tracking-wide mb-0.5">Normal OT ({normalOTHours.toFixed(1)}h)</p>
              <p className="text-lg font-extrabold tracking-tight text-brand-300 leading-none">
                Rs. {normalOTAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-emerald-400/80 uppercase tracking-wide mb-0.5">Total OT Amount</p>
              <p className="text-2xl font-extrabold tracking-tight text-emerald-400 leading-none drop-shadow-md">
                <span className="text-sm text-emerald-500/80 mr-1">Rs.</span>
                {totalOTAmount.toLocaleString()}
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
