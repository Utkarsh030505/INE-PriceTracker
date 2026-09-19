function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function StatusCell({ status }) {
  const colors = {
    success: 'text-green-700 bg-green-50',
    failed: 'text-red-700 bg-red-50',
    retrying: 'text-yellow-700 bg-yellow-50',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[status] || 'text-gray-600 bg-gray-50'}`}>
      {status}
    </span>
  );
}

export default function ScrapeLogs({ logs }) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-gray-500">No scrape logs yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
            <th className="py-2 px-3 font-medium">Time</th>
            <th className="py-2 px-3 font-medium">Attempt</th>
            <th className="py-2 px-3 font-medium">Status</th>
            <th className="py-2 px-3 font-medium">Error</th>
            <th className="py-2 px-3 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-50">
              <td className="py-1.5 px-3 text-xs text-gray-600">{formatTime(log.scraped_at)}</td>
              <td className="py-1.5 px-3 text-xs">{log.attempt_number}</td>
              <td className="py-1.5 px-3"><StatusCell status={log.status} /></td>
              <td className="py-1.5 px-3 text-xs text-gray-500 max-w-[200px] truncate">
                {log.error_message || '—'}
              </td>
              <td className="py-1.5 px-3 text-xs text-gray-500">
                {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
