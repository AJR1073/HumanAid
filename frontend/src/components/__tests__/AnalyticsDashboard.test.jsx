import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnalyticsDashboard from '../AnalyticsDashboard';
import AuthContext from '../../contexts/AuthContext';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: () => <div>BarChart</div>, Bar: () => null, XAxis: () => null,
  YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null,
  Legend: () => null, PieChart: () => <div>PieChart</div>, Pie: () => null, Cell: () => null
}));
const renderDashboard = (user = { uid: 'test-admin' }) => render(
  <AuthContext.Provider value={{ user, isAdmin: true }}><AnalyticsDashboard /></AuthContext.Provider>
);
const response = data => ({ ok: true, json: async () => data });

describe('AnalyticsDashboard', () => {
  beforeEach(() => { global.fetch = vi.fn(); });
  it('renders loading state initially', () => {
    fetch.mockImplementation(() => new Promise(() => {}));
    renderDashboard();
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });
  it('loads overview, detailed and realtime analytics while tracking without client identity', async () => {
    fetch.mockImplementation(async url => {
      if (url.endsWith('/stats')) return response({ resources: 100, users: 50, total_views: 500 });
      if (url.endsWith('/admin/analytics/views')) return response({ viewsOverTime: [], deviceData: [], locationData: [] });
      if (url.endsWith('/admin/analytics/realtime')) return response({ activeUsers: 2, recentActivity: [] });
      return response({ success: true });
    });
    renderDashboard();
    expect(await screen.findByText('Platform Overview')).toBeInTheDocument();
    for (const count of ['100', '50', '2', '500']) expect(screen.getByText(count)).toBeInTheDocument();
    const tracking = fetch.mock.calls.find(([url]) => url.endsWith('/analytics/track'));
    const body = JSON.parse(tracking[1].body);
    expect(body).not.toHaveProperty('user_id');
    expect(body.details).not.toHaveProperty('debug_email');
  });
  it('handles a 403 instead of rendering rejected admin data', async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Forbidden' }) });
    renderDashboard(null);
    await waitFor(() => expect(screen.getByText('Failed to load data')).toBeInTheDocument());
  });
});
