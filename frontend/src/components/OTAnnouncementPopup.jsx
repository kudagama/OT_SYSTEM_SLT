import { useState, useEffect } from 'react';

const SEEN_KEY = 'ot_seen_announcements'; // localStorage key

function getSeenIds() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); }
  catch { return []; }
}

function markAsSeen(id) {
  const seen = getSeenIds();
  if (!seen.includes(id)) {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  });
}

// Convert "HH:MM" (24h) → "H:MM AM/PM"
function fmt12h(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function OTAnnouncementPopup({ announcements = [] }) {
  // Filter to only unseen announcements
  const [queue, setQueue] = useState([]);
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const seen = getSeenIds();
    const unseen = announcements.filter((a) => !seen.includes(a._id));
    if (unseen.length > 0) {
      setQueue(unseen);
      // Small delay so the popup animates in nicely after page load
      setTimeout(() => setVisible(true), 400);
    }
  }, [announcements]);

  const current = queue[0];

  function handleDismiss() {
    if (!current) return;
    setDismissing(true);
    markAsSeen(current._id);
    setTimeout(() => {
      const next = queue.slice(1);
      setQueue(next);
      setDismissing(false);
      if (next.length === 0) setVisible(false);
    }, 300);
  }

  if (!visible || !current) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4
        transition-opacity duration-300 ${dismissing ? 'opacity-0' : 'opacity-100'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      {/* Card */}
      <div
        className={`relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl
          transition-all duration-300
          ${dismissing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e1b4b 100%)',
          border: '1px solid rgba(139,92,246,0.35)',
          boxShadow: '0 0 60px rgba(139,92,246,0.25), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Glowing top bar */}
        <div
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #7c3aed)',
            animation: 'shimmer 2s linear infinite',
            backgroundSize: '200% 100%',
          }}
        />

        {/* Animated background orb */}
        <div
          style={{
            position: 'absolute', top: '-40px', right: '-40px',
            width: '180px', height: '180px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div className="p-5 relative">
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-3">
            {/* Pulsing dot */}
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: '#a78bfa' }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ backgroundColor: '#7c3aed' }}
              />
            </span>
            <span
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: '#a78bfa' }}
            >
              Special OT Available
            </span>
            {queue.length > 1 && (
              <span
                className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
              >
                {queue.length} new
              </span>
            )}
          </div>

          {/* Title */}
          <h2
            className="text-lg font-extrabold leading-tight mb-1"
            style={{ color: '#ede9fe' }}
          >
            {current.title}
          </h2>

          {/* OT Date */}
          <div
            className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            <span className="text-base">📅</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#a78bfa' }}>OT Date</p>
              <p className="text-sm font-bold" style={{ color: '#ede9fe' }}>{formatDate(current.otDate)}</p>
            </div>
          </div>

          {/* Time slot — if provided */}
          {(current.startTime || current.endTime) && (
            <div
              className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <span className="text-base">⏰</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#6ee7b7' }}>Time Slot</p>
                <p className="text-sm font-bold" style={{ color: '#d1fae5' }}>
                  {fmt12h(current.startTime)}{current.startTime && current.endTime ? ' – ' : ''}{fmt12h(current.endTime)}
                </p>
              </div>
            </div>
          )}

          {/* Message */}
          {current.message && (
            <p
              className="text-sm leading-relaxed mb-4"
              style={{ color: '#c4b5fd' }}
            >
              {current.message}
            </p>
          )}

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="w-full py-3 rounded-xl font-extrabold text-sm tracking-wide
              transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 28px rgba(124,58,237,0.6)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)'; }}
          >
            {queue.length > 1 ? `Got it! (${queue.length - 1} more)` : '✓ Got it!'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
