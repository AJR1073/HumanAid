import { apiFetch, API_BASE } from '../api';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import './AnalyticsDashboard.css';


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const StatCard = ({ title, value, icon, color }) => (
    <div className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
        <div className="stat-icon" style={{ color: color }}>{icon}</div>
        <div className="stat-content">
            <h3>{value}</h3>
            <p>{title}</p>
        </div>
    </div>
);

const AnalyticsDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [detailedStats, setDetailedStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Track admin dashboard view
        const trackAdminView = async () => {
            if (!user) return;
            try {
                await apiFetch(`${API_BASE}/analytics/track`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action_type: 'view_admin_dashboard',
                        details: {
                            page: 'Analytics Dashboard',
                            user_agent: navigator.userAgent
                        }
                    })
                });
            } catch (error) {
                console.error('Failed to track admin view:', error);
            }
        };
        trackAdminView();
    }, [user]);

    // Fetch stats
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, detailedRes, realtimeRes] = await Promise.all([
                    apiFetch(`${API_BASE}/stats`),
                    apiFetch(`${API_BASE}/admin/analytics/views`),
                    apiFetch(`${API_BASE}/admin/analytics/realtime`)
                ]);

                if (![statsRes, detailedRes, realtimeRes].every(response => response.ok)) {
                    throw new Error('Unable to load analytics.');
                }
                const statsData = await statsRes.json();
                const detailedData = await detailedRes.json();
                const realtimeData = await realtimeRes.json();

                setStats(statsData);
                setDetailedStats({ ...detailedData, ...realtimeData });

            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="loading-spinner">Loading analytics...</div>;
    if (!stats) return <div className="error-message">Failed to load data</div>;

    // Line Chart Data Format
    const lineChartData = detailedStats?.viewsOverTime?.map(d => ({
        date: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        views: parseInt(d.count)
    })) || [];

    return (
        <div className="analytics-dashboard">
            <h2>Platform Overview</h2>

            <div className="stats-grid">
                <StatCard title="Total Resources" value={stats.resources} icon="🏥" color="#3B82F6" />
                <StatCard title="Total Users" value={stats.users} icon="👥" color="#10B981" />
                <StatCard title="Active Now" value={detailedStats?.activeUsers || 0} icon="🟢" color="#22c55e" />
                <StatCard title="Total Views" value={stats.total_views} icon="👁️" color="#8B5CF6" />
            </div>

            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>

                {/* Views Over Time */}
                <div className="chart-card">
                    <h3>Views (Last 30 Days)</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={lineChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="views" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Device Breakdown */}
                <div className="chart-card">
                    <h3>Views by Device</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={detailedStats?.deviceData || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(detailedStats?.deviceData || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Location Breakdown */}
                <div className="chart-card">
                    <h3>Views by Location</h3>
                    <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f3f4f6', textAlign: 'left', fontSize: '0.9rem', color: '#666' }}>
                                    <th style={{ padding: '0.75rem' }}>Location</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Views</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailedStats?.locationData?.map((loc, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{loc.location}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>{loc.views}</td>
                                    </tr>
                                ))}
                                {(!detailedStats?.locationData?.length) && (
                                    <tr><td colSpan="2" style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>No location data available</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Resources */}
                <div className="chart-card">
                    <h3>Top Viewed Resources</h3>
                    <div className="table-wrapper">
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f3f4f6', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem' }}>Resource Name</th>
                                    <th style={{ padding: '1rem' }}>Views</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailedStats?.topResources?.map((res, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '1rem' }}>{res.name}</td>
                                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{res.views}</td>
                                    </tr>
                                ))}
                                {(!detailedStats?.topResources?.length) && (
                                    <tr><td colSpan="2" style={{ padding: '1rem', textAlign: 'center' }}>No views recorded yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                    <h3>Recent Activity Loop</h3>
                    <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f3f4f6', textAlign: 'left', color: '#666', fontSize: '0.9rem' }}>
                                    <th style={{ padding: '1rem' }}>User</th>
                                    <th style={{ padding: '1rem' }}>Time</th>
                                    <th style={{ padding: '1rem' }}>User Location</th>
                                    <th style={{ padding: '1rem' }}>Device</th>
                                    <th style={{ padding: '1rem' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailedStats?.recentActivity?.map((log, i) => {
                                    // Format time in CST
                                    const dateObj = new Date(log.created_at);
                                    const timeLabel = new Intl.DateTimeFormat('en-US', {
                                        timeZone: 'America/Chicago',
                                        month: 'numeric',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    }).format(dateObj);

                                    // Parse details if string
                                    /* eslint-disable no-unused-vars */
                                    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                                    const ua = details?.user_agent || '';
                                    let device = 'Desktop 🖥️';
                                    if (ua.match(/mobile/i)) device = 'Mobile 📱';
                                    else if (ua.match(/tablet/i)) device = 'Tablet 📱';

                                    // User Display
                                    const userDisplay = log.user_name || log.user_email || 'Guest';

                                    // Action Display
                                    let actionDisplay = `Viewed ${log.resource_name || 'Resource'}`;
                                    if (log.action_type === 'view_admin_dashboard') {
                                        actionDisplay = `Viewed ${details?.page || 'Admin Dashboard'}`;
                                    }

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '1rem', fontWeight: 'bold', color: userDisplay === 'Guest' ? '#999' : '#111' }}>
                                                {userDisplay}
                                            </td>
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap', color: '#666', fontSize: '0.9rem' }}>
                                                {timeLabel} <span style={{ fontSize: '0.8em', color: '#999' }}>CST</span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>{details?.location || 'Unknown'}</td>
                                            <td style={{ padding: '1rem' }}>{device}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <strong>{actionDisplay}</strong>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!detailedStats?.recentActivity?.length) && (
                                    <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>No recent activity</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
