function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );
}

function StatusCell({ status }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] border border-emerald-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
        Success
      </span>
    );
  }
  if (status === 'retrying') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309] border border-amber-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>
        Retrying
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#FEE2E2] text-[#DC2626] border border-rose-200 shadow-2xs">
      <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]"></span>
      Failed
    </span>
  );
}

export default function ScrapeLogs({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="py-8 px-4 text-center bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB]">
        <p className="text-sm font-bold text-[#111827]">No scrape logs recorded yet</p>
        <p className="text-xs text-[#6B7280] mt-0.5">
          Each background or manual scrape attempt will be recorded here with duration and outcome.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
            <th className="py-2.5 px-3">Timestamp</th>
            <th className="py-2.5 px-3">Attempt</th>
            <th className="py-2.5 px-3">Outcome</th>
            <th className="py-2.5 px-3">Duration</th>
            <th className="py-2.5 px-3">Diagnostics / Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB]">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="py-2.5 px-3 text-[#6B7280] font-mono text-[11px] whitespace-nowrap">
                {formatTime(log.scraped_at)}
              </td>
              <td className="py-2.5 px-3 text-[#111827] font-semibold">
                Attempt {log.attempt_number}
              </td>
              <td className="py-2.5 px-3">
                <StatusCell status={log.status} />
              </td>
              <td className="py-2.5 px-3">
                {log.duration_ms != null ? (
                  <span className="font-mono text-[11px] text-[#4B5563] px-1.5 py-0.5 bg-[#F8F9FA] rounded border border-[#E5E7EB]">
                    {log.duration_ms}ms
                  </span>
                ) : (
                  <span className="text-[#6B7280]">—</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-[#6B7280] max-w-xs truncate" title={log.error_message || ''}>
                {log.error_message ? (
                  <span className="text-[#DC2626] font-mono text-[11px] bg-[#FEE2E2] px-1.5 py-0.5 rounded border border-rose-200">
                    {log.error_message}
                  </span>
                ) : (
                  <span className="text-[#6B7280]">None (clean scrape)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
