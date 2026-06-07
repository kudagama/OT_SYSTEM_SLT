import { useMemo, useState } from 'react';
import { SHIFT_COLORS, formatDate, getMonthLabel } from '../constants';

function ConfirmModal({ record, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card p-6 w-full max-w-sm animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-lg">
            🗑️
          </div>
          <div>
            <h4 className="text-white font-bold">Delete Entry</h4>
            <p className="text-xs text-dark-300">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-dark-200 mb-5">
          Delete OT record for{' '}
          <span className="text-white font-semibold">{formatDate(record.date)}</span>
          {record.otHours > 0 && (
            <> ({record.otHours}h)</>
          )}?
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-ghost border border-dark-500 text-center justify-center">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl py-2.5 transition-all duration-200 text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function OTCard({ record, onEdit, onDelete }) {
  // Fallback to a neutral style if shift type isn't in the color map
  const colors = SHIFT_COLORS[record.shiftType] || {
    bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30',
  };

  return (
    <div className="flex items-start gap-3 p-3.5 bg-dark-700/40 hover:bg-dark-700/70 rounded-xl border border-dark-600/50 hover:border-dark-500 transition-all duration-200 group animate-fade-in">
      {/* Date column */}
      <div className="flex flex-col items-center min-w-[40px] pt-0.5">
        <span className="text-lg font-extrabold text-white leading-none">
          {new Date(record.date).toUTCString().slice(5, 7)}
        </span>
        <span className="text-xs text-dark-300 uppercase tracking-wide">
          {new Date(record.date).toUTCString().slice(8, 11)}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px self-stretch bg-dark-500 mx-1" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2 mb-1">
          <span className={`badge border ${colors.bg} ${colors.text} ${colors.border}`}>
            {record.shiftType}
          </span>
          <span className="text-sm font-bold text-white">
            {record.otHours}h
            <span className="text-dark-300 font-normal text-xs ml-1">OT</span>
          </span>
        </div>
        {/* Time ranges: Approved OT Range & Pearl logs */}
        <div className="flex flex-col gap-1 text-xs text-dark-300 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase font-bold text-brand-400 bg-brand-500/10 border border-brand-500/25 px-1.5 py-0.5 rounded shrink-0">OT Range</span>
            {record.otStartTime && record.otEndTime ? (
              <>
                <span className="font-semibold text-white">{record.otStartTime}</span>
                <span className="text-dark-500">→</span>
                <span className="font-semibold text-white">{record.otEndTime}</span>
              </>
            ) : (
              <span className="text-dark-500 italic">No time set</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded shrink-0">Pearl</span>
            {record.pearlLoginTime && record.pearlLogoutTime ? (
              <>
                <span className="font-semibold text-white">{record.pearlLoginTime}</span>
                <span className="text-dark-500">→</span>
                <span className="font-semibold text-white">{record.pearlLogoutTime}</span>
              </>
            ) : (
              <span className="text-dark-500 italic text-[11px] font-medium">No Pearl logs set — edit to add</span>
            )}
          </div>
        </div>
        {record.notes && (
          <p className="text-xs text-dark-300 truncate">{record.notes}</p>
        )}
      </div>


      {/* Actions — always visible on touch, hover-only on desktop */}
      <div className="flex gap-1 shrink-0
                      opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                      transition-opacity duration-150">
        <button
          onClick={() => onEdit(record)}
          title="Edit"
          className="w-9 h-9 flex items-center justify-center rounded-lg
                     text-dark-200 hover:text-brand-300 hover:bg-brand-500/10
                     active:bg-brand-500/20 transition-all duration-150 text-xs"
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(record)}
          title="Delete"
          className="w-9 h-9 flex items-center justify-center rounded-lg
                     text-dark-200 hover:text-red-300 hover:bg-red-500/10
                     active:bg-red-500/20 transition-all duration-150 text-xs"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

export default function OTHistory({ records, loading, onEdit, onDelete, filterYear, filterMonth }) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filter records to the selected month
  const filtered = useMemo(() => {
    if (!filterYear || !filterMonth) return records;
    return records.filter((r) => {
      const d = new Date(r.date);
      return d.getUTCFullYear() === filterYear && d.getUTCMonth() + 1 === filterMonth;
    });
  }, [records, filterYear, filterMonth]);

  // Group filtered records by Month/Year (just one group normally)
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      const key = getMonthLabel(r.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Label for empty state
  const selectedMonthLabel = useMemo(() => {
    if (!filterYear || !filterMonth) return '';
    return new Date(filterYear, filterMonth - 1, 1).toLocaleDateString('en-GB', {
      month: 'long', year: 'numeric',
    });
  }, [filterYear, filterMonth]);

  function handleDeleteConfirm() {
    if (deleteTarget) {
      onDelete(deleteTarget._id);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      {deleteTarget && (
        <ConfirmModal
          record={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="glass-card p-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white">History</h3>
          </div>
          <span className="text-xs text-dark-300 bg-dark-700 border border-dark-500 px-2.5 py-1 rounded-lg">
            {filtered.length} entries
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-dark-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-dark-200 font-medium">No OT records for {selectedMonthLabel}</p>
            <p className="text-sm text-dark-400 mt-1">Use the arrows above to navigate months.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([monthLabel, items]) => {
              const monthTotal = items.reduce((s, r) => s + (r.otHours || 0), 0);
              return (
                <div key={monthLabel}>
                  {/* Month header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-px w-4 bg-dark-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-dark-300">
                        {monthLabel}
                      </span>
                    </div>
                    <span className="text-xs text-brand-400 font-semibold bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-lg">
                      {monthTotal.toFixed(1)}h
                    </span>
                  </div>

                  {/* Records */}
                  <div className="space-y-2">
                    {items.map((record) => (
                      <OTCard
                        key={record._id}
                        record={record}
                        onEdit={onEdit}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
