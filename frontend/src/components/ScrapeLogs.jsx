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
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Success
      </span>
    );
  }
  if (status === 'retrying') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        Retrying
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
      Failed
    </span>
  );
}

export default function ScrapeLogs({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="py-8 px-4 text-center bg-zinc-50/50 rounded-xl border border-zinc-100">
        <p className="text-sm font-medium text-zinc-600">No scrape logs recorded yet</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          Each background or manual scrape attempt will be recorded here with duration and outcome.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            <th className="py-2.5 px-3">Timestamp</th>
            <th className="py-2.5 px-3">Attempt</th>
            <th className="py-2.5 px-3">Outcome</th>
            <th className="py-2.5 px-3">Duration</th>
            <th className="py-2.5 px-3">Diagnostics / Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
              <td className="py-2.5 px-3 text-zinc-600 font-mono text-[11px] whitespace-nowrap">
                {formatTime(log.scraped_at)}
              </td>
              <td className="py-2.5 px-3 text-zinc-800 font-medium">
                Attempt {log.attempt_number}
              </td>
              <td className="py-2.5 px-3">
                <StatusCell status={log.status} />
              </td>
              <td className="py-2.5 px-3">
                {log.duration_ms != null ? (
                  <span className="font-mono text-[11px] text-zinc-600 px-1.5 py-0.5 bg-zinc-100 rounded border border-zinc-200/60">
                    {log.duration_ms}ms
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-zinc-500 max-w-xs truncate" title={log.error_message || ''}>
                {log.error_message ? (
                  <span className="text-rose-600 font-mono text-[11px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                    {log.error_message}
                  </span>
                ) : (
                  <span className="text-zinc-400">None (clean scrape)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
