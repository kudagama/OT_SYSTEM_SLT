import { useState, useMemo, useEffect } from 'react';
import { SHIFT_TYPES, SHIFT_COLORS, getAvailableShiftTypes } from '../constants';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(refDate = new Date()) {
  const d   = new Date(refDate);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return day;
  });
}

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shortShift(shift) {
  if (!shift || !shift.includes(' - ') || shift.includes('Off')) return shift;
  const parts = shift.split(' - ');
  const fmt   = (t) => t.replace(':00', '').replace(' ', '');
  return `${fmt(parts[0])}–${fmt(parts[1])}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fully controlled — schedule state lives in App.jsx
// Props: schedule, saving, onSetShift(dateKey, shiftType), onClearShift(dateKey)
// ─────────────────────────────────────────────────────────────────────────────
export default function WeeklySchedule({ schedule = {}, saving = false, onSetShift, onClearShift, selYear, selMonth, onMonthChange, onSelectDay }) {
  const today     = useMemo(() => new Date(), []);
  const todayKey  = toKey(today);

  const [pickerDay,   setPickerDay]   = useState(null);
  const [viewDay,     setViewDay]     = useState(null);
  const [refDate,     setRefDate]     = useState(today);

  const handleNav = (daysToAdd) => {
    const next = new Date(refDate);
    next.setDate(next.getDate() + daysToAdd);
    setRefDate(next);
    if (onMonthChange) onMonthChange(next.getFullYear(), next.getMonth() + 1);
  };

  const handleToday = () => {
    const d = new Date();
    setRefDate(d);
    if (onMonthChange) onMonthChange(d.getFullYear(), d.getMonth() + 1);
  };

  // Sync with Dashboard's selected month/year
  useEffect(() => {
    if (selYear && selMonth) {
      if (refDate.getFullYear() !== selYear || refDate.getMonth() + 1 !== selMonth) {
        // Jump to the 1st day of the selected month
        setRefDate(new Date(selYear, selMonth - 1, 1));
      }
    }
  }, [selYear, selMonth]); // intentionally NOT including refDate in dependencies

  const displayDates = useMemo(() => {
    return getWeekDates(refDate);
  }, [refDate]);

  const weekLabel = useMemo(() => {
    const first = displayDates[0];
    const last  = displayDates[6];
    const opts  = { day: 'numeric', month: 'short' };
    return `${first.toLocaleDateString('en-GB', opts)} – ${last.toLocaleDateString('en-GB', opts)}`;
  }, [displayDates]);

  return (
    <div className="glass-card p-4 sm:p-5 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30
                          flex items-center justify-center text-sm shrink-0">
            📅
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-dark-300">My Week</p>
            <p className="text-sm font-semibold text-white leading-tight">{weekLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {saving && (
            <svg className="w-3.5 h-3.5 animate-spin text-brand-400 mr-1" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          <button onClick={() => handleNav(-7)} className="btn-icon" title="Previous week">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={handleToday}
            className="text-[10px] font-bold text-brand-300 bg-brand-500/10
                       border border-brand-500/25 px-2 py-1 rounded-lg
                       hover:bg-brand-500/20 transition-all duration-150"
          >
            Today
          </button>
          
          <button onClick={() => handleNav(7)} className="btn-icon" title="Next week">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day cards */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {displayDates.map((date, idx) => {
          const key     = toKey(date);
          const shift   = schedule[key];
          const colors  = shift ? (SHIFT_COLORS[shift] || { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30' }) : null;
          const isToday = key === todayKey;
          const isPast  = date < today && !isToday;

          return (
            <button
              key={key}
              onClick={() => {
                if (shift) setViewDay(key);
                else setPickerDay(key);
                if (onSelectDay) onSelectDay(key);
              }}
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
              <span className={`text-[10px] font-bold uppercase tracking-wide leading-none
                ${isToday ? 'text-brand-300' : 'text-dark-400'}`}>
                {DAY_LABELS[idx]}
              </span>
              <span className={`text-base font-extrabold leading-none
                ${isToday ? 'text-white' : isPast ? 'text-dark-400' : 'text-dark-200'}`}>
                {date.getDate()}
              </span>
              {shift ? (
                <span className={`
                  text-[9px] font-bold leading-tight text-center px-1 py-0.5 rounded-md
                  border ${colors.bg} ${colors.text} ${colors.border} w-full truncate
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

      {/* Shift picker */}
      {pickerDay && (
        <ShiftPicker
          dateKey={pickerDay}
          current={schedule[pickerDay]}
          onSelect={(shift) => { onSetShift(pickerDay, shift); setPickerDay(null); }}
          onClear={() => { onClearShift(pickerDay); setPickerDay(null); }}
          onClose={() => setPickerDay(null)}
        />
      )}

      {/* Shift viewer */}
      {viewDay && (
        <ShiftViewer
          dateKey={viewDay}
          shift={schedule[viewDay]}
          onEdit={() => { setPickerDay(viewDay); setViewDay(null); }}
          onClose={() => setViewDay(null)}
        />
      )}
    </div>
  );
}

// ── Shift viewer bottom sheet ─────────────────────────────────────────────────
function ShiftViewer({ dateKey, shift, onEdit, onClose }) {
  const dateObj = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [dateKey]);

  const label = dateObj.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const colors = SHIFT_COLORS[shift] || { bg: 'bg-dark-700/50', text: 'text-white', border: 'border-dark-600' };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-dark-900/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center animate-slide-up"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm bg-dark-800 border border-dark-600 rounded-t-3xl shadow-2xl overflow-hidden">
          
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-dark-500 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-dark-400 font-semibold mb-0.5">Shift Details</p>
              <p className="text-sm font-bold text-white">{label}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-300 hover:text-white hover:bg-dark-600 transition-all duration-150">
              ✕
            </button>
          </div>

          <div className="px-5 pb-5 pt-2">
            <div className={`p-5 rounded-2xl border mb-5 flex items-center justify-center text-center ${colors.bg} ${colors.border}`}>
              <p className={`text-lg font-extrabold ${colors.text}`}>{shift}</p>
            </div>
            
            <button
              onClick={onEdit}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 transition-all duration-150 shadow-lg shadow-brand-500/25"
            >
              Edit Shift
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

// ── Shift picker bottom sheet ─────────────────────────────────────────────────
function ShiftPicker({ dateKey, current, onSelect, onClear, onClose }) {
  const dateObj = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [dateKey]);

  const label = dateObj.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-dark-900/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center animate-slide-up"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm bg-dark-800 border border-dark-600 rounded-t-3xl shadow-2xl overflow-hidden">

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
                         text-dark-300 hover:text-white hover:bg-dark-600 transition-all duration-150">
              ✕
            </button>
          </div>

          <div className="p-3 grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto overscroll-contain">
            {getAvailableShiftTypes(dateKey).map((shift) => {
              const colors   = SHIFT_COLORS[shift] || {};
              const selected = current === shift;
              return (
                <button
                  key={shift}
                  onClick={() => onSelect(shift)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl border text-left
                    transition-all duration-150 active:scale-[.98]
                    ${selected
                      ? `${colors.bg} ${colors.border}`
                      : 'bg-dark-700/40 border-dark-600 hover:bg-dark-700/80 hover:border-dark-500'
                    }
                  `}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 border
                    ${selected ? `${colors.border} ${colors.bg}` : 'border-dark-500 bg-dark-600'}`}
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

          {current && (
            <div className="px-3 pb-4 pt-1">
              <button
                onClick={onClear}
                className="w-full py-2.5 rounded-xl text-xs font-semibold
                           text-dark-300 bg-dark-700 hover:bg-dark-600
                           border border-dark-600 hover:border-dark-500 transition-all duration-150">
                🗑 Clear shift for this day
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
