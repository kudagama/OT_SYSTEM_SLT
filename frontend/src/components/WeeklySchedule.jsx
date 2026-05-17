import { useState, useMemo, useCallback } from 'react';
import { SHIFT_TYPES, SHIFT_COLORS } from '../constants';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Get the 7 dates (Mon–Sun) of the week containing `refDate` */
function getWeekDates(refDate = new Date()) {
  const d   = new Date(refDate);
  const dow = d.getDay();                      // 0 = Sun … 6 = Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

/** YYYY-MM-DD from a Date (local) */
function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Persist schedule in localStorage per user */
function loadSchedule(userId) {
  try {
    return JSON.parse(localStorage.getItem(`ot_schedule_${userId}`)) || {};
  } catch { return {}; }
}
function saveSchedule(userId, schedule) {
  localStorage.setItem(`ot_schedule_${userId}`, JSON.stringify(schedule));
}

/** Compact shift label: strip minutes if :00, return e.g. "8 AM–4 PM" or "1st Off" */
function shortShift(shift) {
  if (!shift.includes('-') || shift.includes('Off')) return shift;
  const parts = shift.split(' - ');
  const fmt = (t) => t.replace(':00', '').replace(' ', '');
  return `${fmt(parts[0])}–${fmt(parts[1])}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WeeklySchedule({ userId }) {
  const today     = useMemo(() => new Date(), []);
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const todayKey  = toKey(today);

  const [schedule, setSchedule]     = useState(() => loadSchedule(userId));
  const [pickerDay, setPickerDay]   = useState(null);  // date key string or null
  const [weekOffset, setWeekOffset] = useState(0);     // 0 = current week

  // ── Week with offset support ─────────────────────────────────────────────
  const displayDates = useMemo(() => {
    const ref = new Date(today);
    ref.setDate(today.getDate() + weekOffset * 7);
    return getWeekDates(ref);
  }, [today, weekOffset]);

  const weekLabel = useMemo(() => {
    const first = displayDates[0];
    const last  = displayDates[6];
    const opts  = { day: 'numeric', month: 'short' };
    return `${first.toLocaleDateString('en-GB', opts)} – ${last.toLocaleDateString('en-GB', opts)}`;
  }, [displayDates]);

  const isCurrentWeek = weekOffset === 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openPicker  = useCallback((key) => setPickerDay(key), []);
  const closePicker = useCallback(() => setPickerDay(null), []);

  const setShift = useCallback((key, shiftType) => {
    setSchedule((prev) => {
      const next = { ...prev, [key]: shiftType };
      saveSchedule(userId, next);
      return next;
    });
    closePicker();
  }, [userId, closePicker]);

  const clearShift = useCallback((key) => {
    setSchedule((prev) => {
      const next = { ...prev };
      delete next[key];
      saveSchedule(userId, next);
      return next;
    });
    closePicker();
  }, [userId, closePicker]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="glass-card p-4 sm:p-5 animate-slide-up">

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30
                          flex items-center justify-center text-sm">
            📅
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-dark-300">My Week</p>
            <p className="text-sm font-semibold text-white leading-tight">{weekLabel}</p>
          </div>
        </div>

        {/* Week nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="btn-icon"
            title="Previous week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[10px] font-bold text-brand-300 bg-brand-500/10
                         border border-brand-500/25 px-2 py-1 rounded-lg
                         hover:bg-brand-500/20 transition-all duration-150"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="btn-icon"
            title="Next week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day cards — horizontal scroll on small screens */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {displayDates.map((date, idx) => {
          const key      = toKey(date);
          const shift    = schedule[key];
          const colors   = shift ? (SHIFT_COLORS[shift] || { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30' }) : null;
          const isToday  = key === todayKey;
          const isPast   = date < today && !isToday;

          return (
            <button
              key={key}
              onClick={() => openPicker(key)}
              className={`
                flex flex-col items-center shrink-0 snap-start
                w-[calc((100%-6*0.5rem)/7)] min-w-[44px] max-w-[64px]
                rounded-xl border py-2.5 px-1 gap-1.5
                transition-all duration-150 active:scale-95
                ${isToday
                  ? 'border-brand-500/60 bg-brand-500/10 ring-1 ring-brand-500/30'
                  : isPast
                    ? 'border-dark-600/60 bg-dark-700/30 opacity-60'
                    : 'border-dark-600 bg-dark-700/40 hover:bg-dark-700/70 hover:border-dark-500'
                }
              `}
            >
              {/* Day name */}
              <span className={`text-[10px] font-bold uppercase tracking-wide leading-none
                ${isToday ? 'text-brand-300' : 'text-dark-400'}`}>
                {DAY_LABELS[idx]}
              </span>

              {/* Date number */}
              <span className={`text-base font-extrabold leading-none
                ${isToday ? 'text-white' : isPast ? 'text-dark-400' : 'text-dark-200'}`}>
                {date.getDate()}
              </span>

              {/* Shift badge or + */}
              {shift ? (
                <span className={`
                  text-[9px] font-bold leading-tight text-center px-1 py-0.5 rounded-md
                  border ${colors.bg} ${colors.text} ${colors.border}
                  w-full truncate
                `}>
                  {shortShift(shift)}
                </span>
              ) : (
                <span className="text-[11px] text-dark-500 leading-none">＋</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Shift picker sheet */}
      {pickerDay && (
        <ShiftPicker
          dateKey={pickerDay}
          current={schedule[pickerDay]}
          displayDates={displayDates}
          onSelect={(shift) => setShift(pickerDay, shift)}
          onClear={() => clearShift(pickerDay)}
          onClose={closePicker}
        />
      )}
    </div>
  );
}

// ── Shift picker bottom sheet ─────────────────────────────────────────────────
function ShiftPicker({ dateKey, current, displayDates, onSelect, onClear, onClose }) {
  const dateObj = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [dateKey]);

  const label = dateObj.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-dark-900/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center animate-slide-up"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm bg-dark-800 border border-dark-600 rounded-t-3xl
                        shadow-2xl overflow-hidden">

          {/* Handle + header */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-dark-500 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-dark-600">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-dark-400 font-semibold">Set shift for</p>
              <p className="text-sm font-bold text-white">{label}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                         text-dark-300 hover:text-white hover:bg-dark-600
                         transition-all duration-150">
              ✕
            </button>
          </div>

          {/* Shift options */}
          <div className="p-3 grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto overscroll-contain">
            {SHIFT_TYPES.map((shift) => {
              const colors  = SHIFT_COLORS[shift] || {};
              const selected = current === shift;
              return (
                <button
                  key={shift}
                  onClick={() => onSelect(shift)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl border text-left
                    transition-all duration-150 active:scale-[.98]
                    ${selected
                      ? `${colors.bg} ${colors.border} ring-1 ring-offset-0`
                      : 'bg-dark-700/40 border-dark-600 hover:bg-dark-700/80 hover:border-dark-500'
                    }
                  `}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 border
                    ${selected ? colors.border + ' ' + colors.bg : 'border-dark-500 bg-dark-600'}`}
                  />
                  <span className={`text-sm font-semibold ${selected ? colors.text : 'text-dark-200'}`}>
                    {shift}
                  </span>
                  {selected && (
                    <span className={`ml-auto text-xs font-bold ${colors.text}`}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Clear button */}
          {current && (
            <div className="px-3 pb-4 pt-1">
              <button
                onClick={onClear}
                className="w-full py-2.5 rounded-xl text-xs font-semibold
                           text-dark-300 bg-dark-700 hover:bg-dark-600
                           border border-dark-600 hover:border-dark-500
                           transition-all duration-150"
              >
                🗑 Clear shift for this day
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
