import { useState, useEffect, useCallback } from 'react';
import { SHIFT_TYPES, todayISODate } from '../constants';
import { api } from '../api';

const EMPTY_FORM = {
  date:         todayISODate(),
  shiftType:    SHIFT_TYPES[0],
  otStartTime:  '',
  otEndTime:    '',
  otHours:      '',
  notes:        '',
};

/**
 * OT Calculation Rules:
 *  1. Minimum 1 hour  — if total time < 60 min, payable OT = 0 (not eligible).
 *  2. First full hour is always counted as 1.0 h.
 *  3. Remaining minutes after the 1st hour are floored to the nearest 15-min
 *     interval: 0–14 min → +0h | 15–29 min → +0.25h | 30–44 min → +0.5h | 45–59 min → +0.75h
 *
 * Returns { hours, totalMins, eligible, remainderMins, roundedRemainder }
 */
function calcOT(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMins = sh * 60 + sm;
  let endMins   = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60; // overnight
  const totalMins = endMins - startMins;

  // Rule 1: minimum 1 hour
  if (totalMins < 60) {
    return { hours: 0, totalMins, eligible: false, remainderMins: 0, roundedRemainder: 0 };
  }

  // Rule 2 & 3: 1 guaranteed hour + floor remainder to nearest 15
  const remainderMins    = totalMins - 60;
  const roundedRemainder = Math.floor(remainderMins / 15) * 15; // floor to nearest 15
  const hours            = 1 + roundedRemainder / 60;

  return { hours, totalMins, eligible: true, remainderMins, roundedRemainder };
}

/** Legacy thin wrapper used for backward-compat (returns numeric hours or '') */
function calcHours(start, end) {
  const r = calcOT(start, end);
  return r === null ? '' : r.hours;
}

/**
 * Parse shift duration in hours from a shift-type string like "4:00 PM - 8:00 AM".
 * Returns 0 for non-timed shifts (1st Off, 2nd Off, Night Off, etc.).
 */
function getShiftDurationHours(shiftType) {
  const match = shiftType.match(/(\d+:\d+\s*[AP]M)\s*-\s*(\d+:\d+\s*[AP]M)/i);
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

export default function OTForm({ onSaved, editRecord, onCancelEdit }) {
  const [form, setForm]       = useState(EMPTY_FORM);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState(null);

  // Populate form when editing
  useEffect(() => {
    if (editRecord) {
      setForm({
        date:        editRecord.date?.split('T')[0] || todayISODate(),
        shiftType:   editRecord.shiftType || SHIFT_TYPES[0],
        otStartTime: editRecord.otStartTime || '',
        otEndTime:   editRecord.otEndTime   || '',
        otHours:     editRecord.otHours ?? '',
        notes:       editRecord.notes   || '',
      });
      setErrors({});
    }
  }, [editRecord]);

  const isEditing = Boolean(editRecord);

  // Auto-recalc otHours whenever start/end time changes
  const recalcHours = useCallback((start, end) => {
    const result = calcOT(start, end);
    if (result !== null) {
      setForm((f) => ({ ...f, otHours: result.hours, _otResult: result }));
      if (errors.otHours) setErrors((e) => ({ ...e, otHours: undefined }));
    }
  }, [errors.otHours]);

  function validate() {
    const e = {};
    if (!form.date)      e.date = 'Date is required.';
    if (!form.shiftType) e.shiftType = 'Please select a shift type.';
    if (form.otStartTime && form.otEndTime) {
      // times provided — auto-calculated; ineligible (< 1h) saved as 0 hours
      // 24h cap: check calculated result
      const hrs = parseFloat(form.otHours) || 0;
      const shiftH = getShiftDurationHours(form.shiftType);
      if (hrs + shiftH >= 24) {
        e.otHours = `Total exceeds 24h — shift ${shiftH}h + OT ${hrs}h = ${shiftH + hrs}h. Max OT allowed: ${24 - shiftH}h.`;
      }
    } else if (form.otHours === '' || form.otHours === null) {
      e.otHours = 'Enter OT hours manually or pick a start & end time.';
    } else {
      const hrs     = parseFloat(form.otHours);
      const shiftH  = getShiftDurationHours(form.shiftType);
      if (hrs < 0) {
        e.otHours = 'OT hours cannot be negative.';
      } else if (hrs + shiftH >= 24) {
        e.otHours = `Total exceeds 24h — shift ${shiftH}h + OT ${hrs}h = ${shiftH + hrs}h. Max OT allowed: ${24 - shiftH}h.`;
      }
    }
    return e;
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => {
      const updated = { ...f, [name]: value };
      // auto-recalc when either time field changes
      if (name === 'otStartTime') recalcHours(value, f.otEndTime);
      if (name === 'otEndTime')   recalcHours(f.otStartTime, value);
      return updated;
    });
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        otHours: parseFloat(form.otHours),
      };
      if (isEditing) {
        await api.update(editRecord._id, payload);
        showToast('Record updated successfully!');
      } else {
        await api.create(payload);
        showToast('OT entry saved!');
        setForm(EMPTY_FORM);
      }
      onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setErrors({});
    if (onCancelEdit) onCancelEdit();
  }

  // derived display for auto-calculated hours
  const shiftDuration = getShiftDurationHours(form.shiftType);
  const maxOT         = 24 - shiftDuration;                      // hard ceiling
  const autoCalced    = form.otStartTime && form.otEndTime && form.otHours !== '';
  const otResult      = form._otResult || null;
  const otExceeds24   = autoCalced && otResult && (parseFloat(form.otHours) + shiftDuration) >= 24;

  return (
    <div className="glass-card p-5 animate-slide-up relative">
      {/* Toast */}
      {toast && (
        <div
          className={`absolute -top-3 left-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-xl animate-fade-in
            ${toast.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/20 border border-red-500/40 text-red-300'
            }`}
        >
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* Form header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
            ${isEditing ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-brand-600/20 border border-brand-500/30'}`}>
            {isEditing ? '✏️' : '＋'}
          </div>
          <h3 className="text-base font-bold text-white">
            {isEditing ? 'Edit OT Record' : 'Add New OT Entry'}
          </h3>
        </div>
        {isEditing && (
          <button type="button" onClick={handleCancel} className="btn-ghost text-xs">
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Date */}
        <div>
          <label htmlFor="ot-date" className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
            Date *
          </label>
          <input
            id="ot-date"
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className={`input-field ${errors.date ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
          />
          {errors.date && <p className="text-xs text-red-400 mt-1">{errors.date}</p>}
        </div>

        {/* Shift Type */}
        <div>
          <label htmlFor="ot-shift" className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
            Shift Type *
          </label>
          <select
            id="ot-shift"
            name="shiftType"
            value={form.shiftType}
            onChange={handleChange}
            className={`input-field ${errors.shiftType ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
          >
            {SHIFT_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.shiftType && <p className="text-xs text-red-400 mt-1">{errors.shiftType}</p>}
        </div>

        {/* ── OT Time Range ─────────────────────────────────────────────────── */}
        <div>
          <label className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
            OT Time Range
            <span className="normal-case text-dark-400 ml-1">(auto-calculates hours)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Start Time */}
            <div>
              <label htmlFor="ot-start" className="block text-xs text-dark-400 mb-1">From</label>
              <input
                id="ot-start"
                type="time"
                name="otStartTime"
                value={form.otStartTime}
                onChange={handleChange}
                className="input-field"
              />
            </div>
            {/* End Time */}
            <div>
              <label htmlFor="ot-end" className="block text-xs text-dark-400 mb-1">To</label>
              <input
                id="ot-end"
                type="time"
                name="otEndTime"
                value={form.otEndTime}
                onChange={handleChange}
                className="input-field"
              />
            </div>
          </div>

          {/* Auto-calc indicator */}
          {autoCalced && otResult && (
            <div className="mt-2 animate-fade-in space-y-1">
              {/* Overnight badge */}
              {form.otEndTime < form.otStartTime && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  🌙 Overnight
                </span>
              )}

              {/* 24h exceeded warning — takes priority */}
              {otExceeds24 ? (
                <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs text-red-300 space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Exceeds 24h limit!
                  </div>
                  <div className="text-red-400/80 pl-5">
                    Shift {shiftDuration}h + OT {form.otHours}h = {shiftDuration + parseFloat(form.otHours)}h &mdash; max OT is <strong>{maxOT}h</strong>
                  </div>
                </div>
              ) : otResult.eligible ? (
                /* Eligible — show breakdown */
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs text-emerald-300 space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Payable OT: <span className="text-emerald-200 font-bold">{form.otHours}h</span>
                  </div>
                  <div className="text-emerald-400/80 pl-5">
                    1h base + {otResult.roundedRemainder}min
                    {otResult.remainderMins !== otResult.roundedRemainder && (
                      <span className="text-amber-400/80 ml-1">
                        (rounded ↓ from {otResult.remainderMins}min)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Ineligible — less than 1 hour */
                <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-xs text-red-300 space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Not eligible — total {otResult.totalMins}min &lt; 1 hour minimum
                  </div>
                  <div className="text-red-400/80 pl-5">Payable OT: 0h</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* OT Hours (manual / override) */}
        <div>
          <label htmlFor="ot-hours" className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
            OT Hours *
            <span className="normal-case text-dark-400 ml-1">
              {autoCalced ? '(auto-filled, edit if needed)' : '(enter manually)'}
            </span>
            <span className="normal-case text-amber-400/80 ml-2 font-normal">max {maxOT}h</span>
          </label>
          <input
            id="ot-hours"
            type="number"
            name="otHours"
            min="0"
            max={maxOT}
            step="0.25"
            placeholder={`0 – ${maxOT}h`}
            value={form.otHours}
            onChange={handleChange}
            className={`input-field ${
              errors.otHours
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : otExceeds24
                  ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                  : autoCalced
                    ? 'border-emerald-500/40 focus:border-emerald-500 focus:ring-emerald-500/20'
                    : ''
            }`}
          />
          {errors.otHours && <p className="text-xs text-red-400 mt-1">{errors.otHours}</p>}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="ot-notes" className="block text-xs font-semibold text-dark-200 mb-1.5 uppercase tracking-wide">
            Notes <span className="normal-case text-dark-400">(optional)</span>
          </label>
          <input
            id="ot-notes"
            type="text"
            name="notes"
            placeholder="e.g. Covered morning shift"
            value={form.notes}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        {/* Submit */}
        <button
          id="ot-submit-btn"
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {isEditing ? 'Updating...' : 'Saving...'}
            </>
          ) : (
            isEditing ? '✓ Update Record' : '+ Save OT'
          )}
        </button>
      </form>
    </div>
  );
}
