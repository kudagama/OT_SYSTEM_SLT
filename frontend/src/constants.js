export const SHIFT_TYPES = [
  '8:00 AM - 4:00 PM',
  '9:00 AM - 5:00 PM',
  '1:00 PM - 10:00 PM',
  '2:00 PM - 10:00 PM',
  '4:00 PM - 8:00 AM',
  '7:00 AM - 3:00 PM',
  '1st Off',
  '2nd Off',
  'Night Off',
  'Custom',
];

export const SHIFT_COLORS = {
  '8:00 AM - 4:00 PM':  { bg: 'bg-sky-500/15',    text: 'text-sky-300',    border: 'border-sky-500/30' },
  '9:00 AM - 5:00 PM':  { bg: 'bg-teal-500/15',   text: 'text-teal-300',   border: 'border-teal-500/30' },
  '1:00 PM - 10:00 PM': { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-500/30' },
  '2:00 PM - 10:00 PM': { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' },
  '4:00 PM - 8:00 AM':  { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  '7:00 AM - 3:00 PM':  { bg: 'bg-green-500/15',  text: 'text-green-300',  border: 'border-green-500/30' },
  '1st Off':             { bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/30' },
  '2nd Off':             { bg: 'bg-cyan-500/15',   text: 'text-cyan-300',   border: 'border-cyan-500/30' },
  'Night Off':           { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  'Custom':              { bg: 'bg-pink-500/15',   text: 'text-pink-300',   border: 'border-pink-500/30' },
};

export function getAvailableShiftTypes(dateStr) {
  if (!dateStr) return SHIFT_TYPES;
  const isNewEra = dateStr >= '2026-06-01';
  return SHIFT_TYPES.filter(shift => {
    if (isNewEra && shift === '2:00 PM - 10:00 PM') return false;
    if (!isNewEra && shift === '1:00 PM - 10:00 PM') return false;
    return true;
  });
}

/**
 * Format a date string (ISO) to a display string, e.g. "Mon, 12 May 2025"
 */
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Get "Month Year" label from an ISO date string, e.g. "May 2025"
 */
export function getMonthLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Returns today's date as YYYY-MM-DD string (local time)
 */
export function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse shift duration in hours from a shift-type string like "4:00 PM - 8:00 AM".
 * Returns 0 for non-timed shifts (1st Off, 2nd Off, Night Off, etc.).
 */
export function getShiftDurationHours(shiftType) {
  if (shiftType === '1:00 PM - 10:00 PM') return 8;
  const match = shiftType?.match(/(\d+:\d+\s*[AP]M)\s*-\s*(\d+:\d+\s*[AP]M)/i);
  if (!match) return 0;
  const toMins = (str) => {
    const [time, period] = str.trim().split(/\s+/);
    let [h, m] = time.split(':').map(Number);
    if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };
  let s = toMins(match[1]);
  let e = toMins(match[2]);
  if (e <= s) e += 1440; // overnight shift
  return (e - s) / 60;
}
