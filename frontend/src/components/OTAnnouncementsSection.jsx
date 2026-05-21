import { useState } from 'react';
import { api } from '../api';

function fmt12h(t) {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'UTC',
  });
}

function calcOTHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 4) / 4;
}

function parseShiftType(shiftType) {
  if (!shiftType || shiftType.includes('Off') || shiftType === 'Custom') return null;
  const match = shiftType.match(/(\d+):(\d+)\s*([AP]M)\s*-\s*(\d+):(\d+)\s*([AP]M)/i);
  if (!match) return null;
  const toMins = (h, m, ampm) => {
    h = parseInt(h, 10);
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + parseInt(m, 10);
  };
  let s = toMins(match[1], match[2], match[3]);
  let e = toMins(match[4], match[5], match[6]);
  if (e <= s) e += 1440;
  return { startMins: s, endMins: e, durationHours: (e - s) / 60 };
}

function checkOverlap(shiftStr, otStartHHMM, otEndHHMM) {
  const shift = parseShiftType(shiftStr);
  if (!shift || !otStartHHMM || !otEndHHMM) return false;

  const [sh, sm] = otStartHHMM.split(':').map(Number);
  const s2 = sh * 60 + sm;
  
  const [eh, em] = otEndHHMM.split(':').map(Number);
  let e2 = eh * 60 + em;
  if (e2 <= s2) e2 += 1440;

  return Math.max(shift.startMins, s2) < Math.min(shift.endMins, e2);
}

export default function OTAnnouncementsSection({ announcements, onAnnouncementsChange, userSchedule = {} }) {
  const [loadingId, setLoadingId] = useState(null);
  const [errorData, setErrorData] = useState(null); // { id, msg }

  if (!announcements || announcements.length === 0) return null;

  async function handleToggle(ann) {
    // If slot is full and this user hasn't accepted → can't do anything
    if (ann.isFull && !ann.accepted) return;

    setLoadingId(ann._id);
    setErrorData(null);
    try {
      let res;
      if (ann.accepted) {
        res = await api.unacceptAnnouncement(ann._id);
      } else {
        res = await api.acceptAnnouncement(ann._id);
      }
      onAnnouncementsChange(announcements.map((a) =>
        a._id === ann._id
          ? { ...a, accepted: res.accepted, acceptanceCount: res.acceptanceCount, isFull: res.isFull }
          : a
      ));
    } catch (err) {
      setErrorData({ id: ann._id, msg: err.message || 'Failed to process request.' });
      // Clear error after 3s
      setTimeout(() => setErrorData(null), 3000);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="glass-card p-4 sm:p-5">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: '#a78bfa' }}
          />
          <span
            className="relative inline-flex rounded-full h-2.5 w-2.5"
            style={{ backgroundColor: '#7c3aed' }}
          />
        </span>
        <h2 className="text-sm font-bold text-white">Special OT Available</h2>
        <span
          className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(139,92,246,0.15)',
            color: '#c4b5fd',
            border: '1px solid rgba(139,92,246,0.3)',
          }}
        >
          {announcements.length} slot{announcements.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Announcement cards */}
      <div className="space-y-3">
        {announcements.map((ann) => {
          const isLoading = loadingId === ann._id;
          const hasError  = errorData && errorData.id === ann._id;
          const accepted  = ann.accepted;
          const isFull    = ann.isFull && !accepted; // full for THIS user (not the one who accepted)

          // Schedule Checks
          const dateKey = ann.otDate ? new Date(ann.otDate).toISOString().split('T')[0] : null;
          const regularShift = dateKey ? userSchedule[dateKey] : null;
          
          let hasOverlap = false;
          let exceeds24 = false;
          let shiftData = null;

          if (regularShift) {
            shiftData = parseShiftType(regularShift);
            hasOverlap = checkOverlap(regularShift, ann.startTime, ann.endTime);
            if (shiftData) {
              const otHours = calcOTHours(ann.startTime, ann.endTime);
              exceeds24 = shiftData.durationHours + otHours >= 24;
            }
          }

          const canAccept = !isFull && !hasOverlap && !exceeds24;

          return (
            <div
              key={ann._id}
              className="rounded-xl overflow-hidden transition-all duration-200"
              style={{
                background: accepted
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))'
                  : isFull
                  ? 'linear-gradient(135deg, rgba(100,116,139,0.08), rgba(100,116,139,0.03))'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.03))',
                border: accepted
                  ? '1px solid rgba(16,185,129,0.3)'
                  : isFull
                  ? '1px solid rgba(100,116,139,0.2)'
                  : '1px solid rgba(139,92,246,0.25)',
                opacity: isFull ? 0.75 : 1,
              }}
            >
              {/* Top accent bar */}
              <div
                style={{
                  height: '2px',
                  background: accepted
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : isFull
                    ? 'linear-gradient(90deg, #64748b, #94a3b8)'
                    : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                }}
              />

              <div className="p-3">
                {/* Title row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-bold text-white leading-tight">{ann.title}</p>
                  {accepted && (
                    <span
                      className="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(16,185,129,0.15)',
                        color: '#6ee7b7',
                        border: '1px solid rgba(16,185,129,0.3)',
                      }}
                    >
                      ✓ Accepted
                    </span>
                  )}
                  {isFull && (
                    <span
                      className="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(100,116,139,0.15)',
                        color: '#94a3b8',
                        border: '1px solid rgba(100,116,139,0.25)',
                      }}
                    >
                      🔒 Slot Taken
                    </span>
                  )}
                </div>

                {/* Date & time */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📅</span>
                    <span className="text-[11px] font-semibold" style={{ color: accepted ? '#6ee7b7' : isFull ? '#94a3b8' : '#c4b5fd' }}>
                      {formatDate(ann.otDate)}
                    </span>
                  </div>
                  {(ann.startTime || ann.endTime) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">⏰</span>
                      <span className="text-[11px] font-semibold" style={{ color: accepted ? '#6ee7b7' : isFull ? '#94a3b8' : '#c4b5fd' }}>
                        {fmt12h(ann.startTime)}{ann.startTime && ann.endTime ? ' – ' : ''}{fmt12h(ann.endTime)}
                      </span>
                    </div>
                  )}
                  {ann.shiftType && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🏷️</span>
                      <span className="text-[11px] font-semibold text-dark-400">{ann.shiftType}</span>
                    </div>
                  )}
                </div>

                {/* Message */}
                {ann.message && (
                  <p className="text-[11px] text-dark-300 leading-relaxed mb-2.5">{ann.message}</p>
                )}

                {/* Shift Reminder / Warnings */}
                {regularShift && !accepted && (
                  <div className="mb-2.5 space-y-1">
                    <p className="text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded px-2 py-1 inline-block">
                      ℹ️ Reminder: You have a regular shift ({regularShift}) today.
                    </p>
                    {hasOverlap && (
                      <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 inline-block mt-1">
                        ❌ Conflicts with your regular shift hours.
                      </p>
                    )}
                    {exceeds24 && !hasOverlap && (
                      <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 inline-block mt-1">
                        ❌ Total time (Shift + OT) exceeds 24h limit.
                      </p>
                    )}
                  </div>
                )}

                {/* Error */}
                {hasError && (
                  <p className="text-[10px] text-red-400 mb-2">❌ {errorData.msg}</p>
                )}

                {/* Footer: acceptance count + action button */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-dark-400">
                    {ann.acceptanceCount > 0
                      ? `${ann.acceptanceCount} employee${ann.acceptanceCount > 1 ? 's' : ''} accepted`
                      : 'No acceptances yet'}
                  </span>

                  {/* Accept / Cancel / Full button */}
                  {isFull ? (
                    <span
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-not-allowed select-none"
                      style={{
                        background: 'rgba(100,116,139,0.1)',
                        color: '#64748b',
                        border: '1px solid rgba(100,116,139,0.2)',
                      }}
                    >
                      🔒 Full
                    </span>
                  ) : (
                    <button
                      onClick={() => handleToggle(ann)}
                      disabled={isLoading || (!accepted && !canAccept)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold
                        transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={
                        accepted
                          ? {
                              background: 'rgba(239,68,68,0.1)',
                              color: '#fca5a5',
                              border: '1px solid rgba(239,68,68,0.25)',
                            }
                          : {
                              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                              color: '#fff',
                              boxShadow: (!accepted && !canAccept) ? 'none' : '0 2px 12px rgba(124,58,237,0.35)',
                              border: '1px solid transparent',
                            }
                      }
                    >
                      {isLoading ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : accepted ? (
                        <>✕ Cancel</>
                      ) : (
                        <>✓ Accept</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
