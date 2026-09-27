
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnalyticsDashboard from '../AnalyticsDashboard';

// Mock recharts because it uses ResizeObserver which might not be available in JSDOM
// or just mock the ResponsiveContainer to render children
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }) => <div data-testid="chart-container">{children}</div>,
    BarChart: () => <div>BarChart</div>,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    PieChart: () => <div>PieChart</div>,
    Pie: () => null,
    Cell: () => null
}));

describe('AnalyticsDashboard', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('renders loading state initially', () => {
        // Return a promise that never resolves to test loading state
        global.fetch.mockImplementation(() => new Promise(() => { }));
        render(<AnalyticsDashboard />);
        expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
    });

    it('renders stats after loading', async () => {
        global.fetch
            .mockResolvedValueOnce({
                json: async () => ({
                    resources: 100,
                    categories: 10,
                    cities: 5,
                    pending_submissions: 2,
                    users: 50,
                    total_views: 500
                })
            })
            .mockResolvedValueOnce({
                json: async () => ({
                    categories: [
                        { name: 'Food', resource_count: 50 },
                        { name: 'Health', resource_count: 30 }
                    ]
                })
            });

        render(<AnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Platform Overview')).toBeInTheDocument();
        });

        expect(screen.getByText('100')).toBeInTheDocument(); // Resources
        expect(screen.getByText('50')).toBeInTheDocument(); // Users
        expect(screen.getByText('2')).toBeInTheDocument(); // Pending
        expect(screen.getByText('500')).toBeInTheDocument(); // Views
    });

    it('renders error message on fetch failure', async () => {
        global.fetch.mockRejectedValue(new Error('API Error'));

        render(<AnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load data')).toBeInTheDocument();
        });
    });
});
