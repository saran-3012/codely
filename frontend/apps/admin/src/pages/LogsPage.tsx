import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../api';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { AccessLog, AppLog, PaginatedResponse } from '../types';

type Tab = 'access' | 'app';
type AppLogLevel = 'error' | 'warn' | 'info' | 'debug';

const PAGE_SIZE = 50;
const REFRESH_INTERVAL_MS = 30_000;

// ── Shared helpers ────────────────────────────────────────────────────────────

const statusBadge = (code: number) => {
  const color =
    code >= 500 ? 'bg-red-700 text-red-100' :
    code >= 400 ? 'bg-yellow-700 text-yellow-100' :
    'bg-green-800 text-green-100';
  return <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${color}`}>{code}</span>;
};

const levelBadge = (level: AppLogLevel) => {
  const color =
    level === 'error' ? 'bg-red-700 text-red-100' :
    level === 'warn'  ? 'bg-yellow-700 text-yellow-100' :
    level === 'info'  ? 'bg-blue-700 text-blue-100' :
                        'bg-gray-600 text-gray-200';
  return <span className={`px-1.5 py-0.5 rounded text-xs uppercase font-semibold ${color}`}>{level}</span>;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString();

// ── Access Logs ───────────────────────────────────────────────────────────────

const AccessLogsPanel = () => {
  const [data, setData] = useState<PaginatedResponse<AccessLog> | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ from: '', to: '', method: '', status: '', path: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (filters.from)   params.from   = filters.from;
      if (filters.to)     params.to     = filters.to;
      if (filters.method) params.method = filters.method.toUpperCase();
      if (filters.status) params.status = filters.status;
      if (filters.path)   params.path   = filters.path;

      const res = await adminApi.get<PaginatedResponse<AccessLog>>('/logs/access', { params });
      setData(res.data);
    } catch {
      setError('Failed to load access logs.');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const id = setInterval(fetch, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => handleFilterChange('from', e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          placeholder="From"
          title="From"
        />
        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => handleFilterChange('to', e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          placeholder="To"
          title="To"
        />
        <input
          type="text"
          value={filters.method}
          onChange={(e) => handleFilterChange('method', e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 w-24 focus:outline-none focus:border-blue-500"
          placeholder="Method"
        />
        <input
          type="number"
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 w-24 focus:outline-none focus:border-blue-500"
          placeholder="Status"
          min={100}
          max={599}
        />
        <input
          type="text"
          value={filters.path}
          onChange={(e) => handleFilterChange('path', e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 w-48 focus:outline-none focus:border-blue-500"
          placeholder="Path"
        />
        <button
          onClick={() => { setFilters({ from: '', to: '', method: '', status: '', path: '' }); setPage(1); }}
          className="bg-gray-600 hover:bg-gray-500 text-white text-sm rounded px-3 py-1 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={fetch}
          disabled={loading}
          className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-900 text-white text-sm rounded px-3 py-1 transition-colors ml-auto"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-300 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-800">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Path</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration (ms)</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">User ID</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No logs found.</td></tr>
            )}
            {data?.data.map((log) => (
              <tr key={log.id} className="border-t border-gray-700 hover:bg-gray-750">
                <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">{fmtDate(log.createdAt)}</td>
                <td className="px-4 py-2 font-mono text-xs">{log.method}</td>
                <td className="px-4 py-2 font-mono text-xs max-w-xs truncate" title={log.path}>{log.path}</td>
                <td className="px-4 py-2">{statusBadge(log.statusCode)}</td>
                <td className="px-4 py-2 font-mono text-xs">{log.responseTimeMs}</td>
                <td className="px-4 py-2 font-mono text-xs">{log.ip ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs truncate max-w-[8rem]" title={log.userId ?? undefined}>{log.userId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>Page {data.page} of {data.totalPages} ({data.total} entries)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── App Logs ──────────────────────────────────────────────────────────────────

const AppLogsPanel = () => {
  const [data, setData] = useState<PaginatedResponse<AppLog> | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ from: '', to: '', level: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (filters.from)  params.from  = filters.from;
      if (filters.to)    params.to    = filters.to;
      if (filters.level) params.level = filters.level;

      const res = await adminApi.get<PaginatedResponse<AppLog>>('/logs/app', { params });
      setData(res.data);
    } catch {
      setError('Failed to load app logs.');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const id = setInterval(fetch, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => handleFilterChange('from', e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          title="From"
        />
        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => handleFilterChange('to', e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          title="To"
        />
        <select
          value={filters.level}
          onChange={(e) => handleFilterChange('level', e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          <option value="">All levels</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <button
          onClick={() => { setFilters({ from: '', to: '', level: '' }); setPage(1); }}
          className="bg-gray-600 hover:bg-gray-500 text-white text-sm rounded px-3 py-1 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={fetch}
          disabled={loading}
          className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-900 text-white text-sm rounded px-3 py-1 transition-colors ml-auto"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-300 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-800">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Meta</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No logs found.</td></tr>
            )}
            {data?.data.map((log) => (
              <tr key={log.id} className="border-t border-gray-700 hover:bg-gray-750">
                <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">{fmtDate(log.createdAt)}</td>
                <td className="px-4 py-2">{levelBadge(log.level)}</td>
                <td className="px-4 py-2 max-w-sm">{log.message}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-400 max-w-xs truncate" title={log.meta ? JSON.stringify(log.meta) : undefined}>
                  {log.meta ? JSON.stringify(log.meta) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>Page {data.page} of {data.totalPages} ({data.total} entries)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const LogsPage = () => {
  const { user, logout } = useAdminAuth();
  const [tab, setTab] = useState<Tab>('access');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navbar */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">Codely Admin</span>
          <span className="text-gray-500 text-sm">/ Logs</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{user?.email}</span>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
          {(['access', 'app'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'access' ? 'Access Logs' : 'App Logs'}
            </button>
          ))}
        </div>

        {/* Retention note */}
        <p className="text-xs text-gray-500 mb-4">
          {tab === 'access'
            ? 'Access logs are retained for 1 hour.'
            : 'Application logs are retained for 1 day.'}
        </p>

        {tab === 'access' ? <AccessLogsPanel /> : <AppLogsPanel />}
      </main>
    </div>
  );
};

export default LogsPage;
