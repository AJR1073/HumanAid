import { apiFetch, API_BASE } from '../api';

import React, { useState, useEffect } from 'react';
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
    const [stats, setStats] = useState(null);
    const [categoryData, setCategoryData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, catsRes] = await Promise.all([
                    apiFetch(`${API_BASE}/stats`),
                    apiFetch(`${API_BASE}/categories?include_empty=true&all_levels=true`)
                ]);

                const statsData = await statsRes.json();
                const catsData = await catsRes.json();

                setStats(statsData);

                // Process category data for chart
                const chartData = (catsData.categories || [])
                    .filter(c => c.resource_count > 0)
                    .map(c => ({
                        name: c.name,
                        count: parseInt(c.resource_count)
                    }))
                    .sort((a, b) => b.count - a.count);

                setCategoryData(chartData);
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

    return (
        <div className="analytics-dashboard">
            <h2>Platform Overview</h2>

            <div className="stats-grid">
                <StatCard
                    title="Total Resources"
                    value={stats.resources}
                    icon="🏥"
                    color="#3B82F6"
                />
                <StatCard
                    title="Total Users"
                    value={stats.users}
                    icon="👥"
                    color="#10B981"
                />
                <StatCard
                    title="Pending Submissions"
                    value={stats.pending_submissions}
                    icon="⏳"
                    color="#F59E0B"
                />
                <StatCard
                    title="Total Views"
                    value={stats.total_views}
                    icon="👁️"
                    color="#8B5CF6"
                />
            </div>

            <div className="charts-container">
                <div className="chart-card">
                    <h3>Resources by Category</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    angle={-45}
                                    textAnchor="end"
                                    height={100}
                                    interval={0}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
