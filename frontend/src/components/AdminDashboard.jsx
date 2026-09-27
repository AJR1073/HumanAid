import { apiFetch, API_BASE } from '../api';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Check, X, Shield, Clock, MapPin, Phone, Globe, Mail, BarChart2, AlertTriangle, Search } from 'lucide-react';
import AdminResourceModal from './AdminResourceModal';
import AnalyticsDashboard from './AnalyticsDashboard';


const AdminDashboard = () => {
    const { isAdmin, user } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'submissions' | 'resources' | 'admins'
    const [resources, setResources] = useState([]); // Admin resources list
    const [resourceSearch, setResourceSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [missingZipOnly, setMissingZipOnly] = useState(false);
    const [reports, setReports] = useState([]); // Resource reports
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [adminEmail, setAdminEmail] = useState('');
    const [promoteStatus, setPromoteStatus] = useState(null);
    const [admins, setAdmins] = useState([]); // List of current admins

    // Edit Modal State
    const [editingResource, setEditingResource] = useState(null);
    const [resolvingReportId, setResolvingReportId] = useState(null);
    const [categories, setCategories] = useState([]);

    const fetchCategories = async () => {
        try {
            const res = await apiFetch(`${API_BASE}/categories?include_empty=true&all_levels=true`);
            const data = await res.json();
            setCategories(data.categories || []);
        } catch (e) {
            console.error('Failed to fetch categories', e);
        }
    };

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/submissions/pending`);
            if (!res.ok) throw new Error('Unable to load admin data.');
            const data = await res.json();
            setSubmissions(data);
        } catch (error) {
            console.error('Error fetching submissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchResources = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/admin/resources?page=${currentPage}&limit=20&search=${encodeURIComponent(resourceSearch)}&missing_zip=${missingZipOnly}&category=${selectedCategory}`);
            const data = await res.json();
            setResources(data.resources || []);
            setTotalPages(data.totalPages || 1);
        } catch (error) {
            console.error('Error fetching resources:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/admin/list`);
            if (!res.ok) throw new Error('Unable to load admin data.');
            const data = await res.json();
            setAdmins(data.admins || []);
        } catch (error) {
            console.error('Error fetching admins:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/admin/reports`);
            if (!res.ok) throw new Error('Unable to load admin data.');
            const data = await res.json();
            setReports(data || []);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchCategories();
            if (activeTab === 'submissions') fetchSubmissions();
            if (activeTab === 'resources') fetchResources();
            if (activeTab === 'admins') fetchAdmins();
            if (activeTab === 'reports') fetchReports();
        }
    }, [isAdmin, activeTab, resourceSearch, missingZipOnly, selectedCategory, currentPage]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [resourceSearch, missingZipOnly, selectedCategory]);

    const handleEditFromReport = async (report) => {
        try {
            const res = await apiFetch(`${API_BASE}/resources/${report.resource_id}`);
            if (!res.ok) throw new Error('Failed to fetch resource details');

            const resourceData = await res.json();
            setEditingResource(resourceData);
            setResolvingReportId(report.id);
        } catch (error) {
            console.error(error);
            alert('Could not load resource for editing: ' + error.message);
        }
    };


    const handleSaveResource = async (id, updatedData) => {
        const res = await apiFetch(`${API_BASE}/admin/resources/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.details || errorData.error || 'Failed to update');
        }

        // Refresh list depending on tab, but also handle auto-resolve
        if (activeTab === 'resources') fetchResources();
        if (activeTab === 'reports') {
            // Check if we are in "Edit & Resolve" mode
            if (resolvingReportId) {
                // Auto-resolve without confirmation since the user just fixed it
                await handleResolveReport(resolvingReportId, 'resolved', true); // Pass true to skip confirm
                setResolvingReportId(null);
            } else {
                fetchReports();
            }
        }
    };

    const handleAction = async (id, action) => {
        try {
            if (!confirm(`Are you sure you want to ${action} this submission?`)) return;

            const res = await apiFetch(`${API_BASE}/submissions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action
                })
            });

            if (!res.ok) throw new Error('Submission update failed');
            setSubmissions(submissions.filter(s => s.id !== id));
        } catch (error) {
            console.error(`Error ${action} submission:`, error);
            alert(`Failed to ${action} submission`);
        }
    };

    const handlePromote = async (e) => {
        e.preventDefault();
        if (!adminEmail) return;

        try {
            const res = await apiFetch(`${API_BASE}/admin/promote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: adminEmail })
            });

            if (res.ok) {
                setPromoteStatus({ type: 'success', msg: `The verified account for ${adminEmail} is now an admin.` });
                setAdminEmail('');
                fetchAdmins();
            } else {
                throw new Error('Failed');
            }
        } catch (error) {
            setPromoteStatus({ type: 'error', msg: 'Could not promote this account. The user must sign in and verify their email first.' });
        }
    };

    const handleAutoCategorize = async () => {
        if (!confirm('Run Auto-Categorization on all resources? This matches title/description keywords to categories.')) return;

        try {
            const res = await apiFetch(`${API_BASE}/admin/auto-categorize`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                fetchResources(); // Refresh list
            } else {
                alert('Failed to categorize.');
            }
        } catch (error) {
            console.error('Auto-categorize error:', error);
            alert('Error running auto-categorization.');
        }
    };

    const handleResolveReport = async (id, status, skipConfirm = false) => {
        if (!skipConfirm && !confirm(`Mark this report as ${status}?`)) return;

        try {
            const url = `${API_BASE}/admin/reports/${id}/resolve`;

            const res = await apiFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (!res.ok) throw new Error('Could not update the report status. Please try again.');
            await fetchReports();
        } catch (error) {
            if (skipConfirm) {
                throw new Error('The resource was saved, but the report is still open. Please retry or resolve it from the reports list.');
            }
            console.error('Error resolving report:', error);
            alert('Could not update the report status. Please try again.');
        }
    };

    if (!isAdmin) {
        return (
            <div className="admin-access-denied">
                <Shield size={48} />
                <h2>Access Denied</h2>
                <p>You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            <div className="admin-header">
                <h2>Admin Dashboard</h2>
                <div className="admin-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <BarChart2 size={18} /> Analytics
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('submissions')}
                    >
                        <Clock size={18} /> Pending ({submissions.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`}
                        onClick={() => setActiveTab('resources')}
                    >
                        <Globe size={18} /> All Resources
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reports')}
                    >
                        <AlertTriangle size={18} /> Reports ({reports.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'admins' ? 'active' : ''}`}
                        onClick={() => setActiveTab('admins')}
                    >
                        <Shield size={18} /> Manage Admins
                    </button>
                </div>
            </div>

            <div className="admin-content">
                {activeTab === 'analytics' ? (
                    <AnalyticsDashboard />
                ) : activeTab === 'submissions' ? (
                    loading ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : submissions.length === 0 ? (
                        <div className="empty-state">No pending submissions</div>
                    ) : (
                        <div className="submissions-grid">
                            {submissions.map(sub => (
                                <div key={sub.id} className="submission-card">
                                    <div className="sub-header">
                                        <h3>{sub.name}</h3>
                                        <span className="sub-date">{new Date(sub.created_at).toLocaleDateString()}</span>
                                    </div>

                                    <div className="sub-details">
                                        <p><strong>Category:</strong> {sub.primary_category_id || 'Unassigned'}</p>
                                        <p><strong>Address:</strong> {sub.address}, {sub.city}, {sub.state}</p>
                                        {sub.phone && <p><Phone size={14} /> {sub.phone}</p>}
                                        {sub.website && <p><Globe size={14} /> {sub.website}</p>}

                                        <div className="sub-description">
                                            {sub.description}
                                        </div>

                                        <div className="submitter-info">
                                            <h4>Submitted By:</h4>
                                            <p>{sub.submitted_by_name || 'Anonymous'}</p>
                                            <p className="email">{sub.submitted_by}</p>
                                        </div>
                                    </div>

                                    <div className="sub-actions">
                                        <button
                                            className="reject-btn"
                                            onClick={() => handleAction(sub.id, 'reject')}
                                        >
                                            <X size={18} /> Reject
                                        </button>
                                        <button
                                            className="approve-btn"
                                            onClick={() => handleAction(sub.id, 'approve')}
                                        >
                                            <Check size={18} /> Approve
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : activeTab === 'reports' ? (
                    loading ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : reports.length === 0 ? (
                        <div className="empty-state">No pending reports</div>
                    ) : (
                        <div className="reports-list" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                    <tr>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Resource</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Issue</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Details</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((report, i) => (
                                        <tr key={report.id} style={{ borderBottom: i === reports.length - 1 ? 'none' : '1px solid #F3F4F6' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: '500', color: '#111827' }}>{report.resource_name}</div>
                                                <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>{report.city}, {report.state}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                                                    background: report.issue_type === 'closed' ? '#FEE2E2' : '#EFF6FF',
                                                    color: report.issue_type === 'closed' ? '#DC2626' : '#2563EB'
                                                }}>
                                                    {report.issue_type.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', color: '#4B5563', fontSize: '0.9rem', maxWidth: '300px' }}>
                                                {report.description}
                                                {report.contact_email && <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '4px' }}>By: {report.contact_email}</div>}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleEditFromReport(report)}
                                                    style={{ marginRight: '8px', padding: '6px 12px' }}
                                                >
                                                    Edit &amp; Resolve
                                                </button>
                                                <button
                                                    onClick={() => handleResolveReport(report.id, 'resolved')}
                                                    style={{ marginRight: '8px', padding: '6px 12px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                                                >
                                                    Resolve
                                                </button>
                                                <button
                                                    onClick={() => handleResolveReport(report.id, 'dismissed')}
                                                    style={{ padding: '6px 12px', background: 'white', border: '1px solid #D1D5DB', color: '#374151', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                                                >
                                                    Dismiss
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : activeTab === 'resources' ? (
                    <div className="resources-manager">
                        <div className="resources-toolbar" style={{
                            background: 'white',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                            marginBottom: '2rem'
                        }}>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="search-box-large" style={{ flex: 1, position: 'relative' }}>
                                    <Search size={20} className="search-icon" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by name, city, or address..."
                                        value={resourceSearch}
                                        onChange={(e) => setResourceSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem 0.875rem 3rem',
                                            borderRadius: '8px',
                                            border: '1px solid #E5E7EB',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                            backgroundColor: '#F9FAFB'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#3B82F6';
                                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                            e.target.style.backgroundColor = 'white';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#E5E7EB';
                                            e.target.style.boxShadow = 'none';
                                            e.target.style.backgroundColor = '#F9FAFB';
                                        }}
                                    />
                                    {resourceSearch && (
                                        <button
                                            onClick={() => setResourceSearch('')}
                                            style={{
                                                position: 'absolute',
                                                right: '1rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#6B7280'
                                            }}
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                                <button className="auto-cat-btn" onClick={handleAutoCategorize} style={{
                                    background: '#FEE2E2',
                                    color: '#DC2626',
                                    border: '1px solid #FECACA',
                                    padding: '0 1.5rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: '600',
                                    fontSize: '0.9rem',
                                    transition: 'background 0.2s'
                                }}>
                                    <AlertTriangle size={16} /> Auto-Categorize
                                </button>
                            </div>

                            <div className="filters-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <select
                                    style={{
                                        padding: '0.625rem',
                                        borderRadius: '6px',
                                        border: '1px solid #D1D5DB',
                                        backgroundColor: 'white',
                                        minWidth: '150px'
                                    }}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                    }}
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>

                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem 1rem',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    backgroundColor: missingZipOnly ? '#EFF6FF' : 'white',
                                    borderColor: missingZipOnly ? '#3B82F6' : '#D1D5DB'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={missingZipOnly}
                                        onChange={(e) => setMissingZipOnly(e.target.checked)}
                                        style={{ accentColor: '#3B82F6' }}
                                    />
                                    <span style={{ fontSize: '0.9rem', color: '#374151' }}>Missing ZIP Only</span>
                                </label>
                            </div>
                        </div>

                        {loading ? (
                            <div className="loading-spinner">Loading...</div>
                        ) : resources.length === 0 ? (
                            <div className="empty-state">No resources found matching your criteria</div>
                        ) : (
                            <>
                                <div className="resources-table-container" style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                    overflow: 'hidden',
                                    border: '1px solid #E5E7EB'
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                            <tr>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Name</th>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Category</th>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Location</th>
                                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Status</th>
                                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#6B7280' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resources.map((res, i) => (
                                                <tr key={res.id} style={{
                                                    borderBottom: i === resources.length - 1 ? 'none' : '1px solid #F3F4F6',
                                                    transition: 'background 0.1s'
                                                }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                    <td style={{ padding: '1rem', color: '#111827', fontWeight: '500' }}>{res.name}</td>
                                                    <td style={{ padding: '1rem', color: '#4B5563', fontSize: '0.9rem' }}>
                                                        {typeof res.category_name === 'object'
                                                            ? (res.category_name?.name || 'Unassigned')
                                                            : (res.category_name || res.primary_category_id || 'Unassigned')}
                                                    </td>
                                                    <td style={{ padding: '1rem', color: '#6B7280', fontSize: '0.9rem' }}>
                                                        {res.address ? `${res.address}, ` : ''}{res.city}
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '0.25rem 0.625rem',
                                                            borderRadius: '9999px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '600',
                                                            backgroundColor: res.is_active ? '#ECFDF5' : '#F3F4F6',
                                                            color: res.is_active ? '#059669' : '#4B5563'
                                                        }}>
                                                            {res.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => setEditingResource(res)}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                background: 'white',
                                                                border: '1px solid #D1D5DB',
                                                                color: '#374151',
                                                                borderRadius: '6px',
                                                                fontSize: '0.875rem',
                                                                fontWeight: '500',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.375rem'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.borderColor = '#3B82F6';
                                                                e.currentTarget.style.color = '#3B82F6';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.borderColor = '#D1D5DB';
                                                                e.currentTarget.style.color = '#374151';
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                <div className="pagination-controls" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: '1.5rem',
                                    paddingBottom: '2rem',
                                    color: '#6B7280',
                                    fontSize: '0.875rem'
                                }}>
                                    <span>
                                        Showing page {currentPage} of {totalPages || 1}
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                background: currentPage === 1 ? '#F3F4F6' : 'white',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '6px',
                                                color: currentPage === 1 ? '#9CA3AF' : '#374151',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage >= totalPages}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                background: currentPage >= totalPages ? '#F3F4F6' : 'white',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '6px',
                                                color: currentPage >= totalPages ? '#9CA3AF' : '#374151',
                                                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : activeTab === 'admins' ? (
                    <>
                        <div className="admin-management">
                            <h3>Add New Admin</h3>
                            <p>Enter the email address of a user you want to promote to Admin status.</p>

                            <form onSubmit={handlePromote} className="promote-form">
                                <input
                                    type="email"
                                    placeholder="user@example.com"
                                    value={adminEmail}
                                    onChange={(e) => setAdminEmail(e.target.value)}
                                    required
                                />
                                <button type="submit">Promote to Admin</button>
                            </form>

                            {promoteStatus && (
                                <div className={`status-msg ${promoteStatus.type}`}>
                                    {promoteStatus.msg}
                                </div>
                            )}
                        </div>

                        <div className="current-admins-list" style={{ marginTop: '2rem' }}>
                            <h3>Current Admins</h3>
                            {loading ? <p>Loading...</p> : (
                                <div className="submissions-grid">
                                    {admins.map(admin => (
                                        <div key={admin.id} className="submission-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong>{admin.email}</strong>
                                                <p style={{ margin: 0, fontSize: '0.9em', color: '#666' }}>
                                                    {admin.display_name || 'No Name'} • Last Login: {admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'Never'}
                                                </p>
                                            </div>
                                            {admin.email !== user?.email && (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(`Are you sure you want to remove admin access from ${admin.email}?`)) return;
                                                        try {
                                                            const res = await apiFetch(`${API_BASE}/admin/demote`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ email: admin.email })
                                                            });
                                                            if (res.ok) fetchAdmins();
                                                            else alert('Failed to demote');
                                                        } catch (e) { console.error(e); alert('Error demoting'); }
                                                    }}
                                                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>

            {editingResource && (
                <AdminResourceModal
                    isOpen={!!editingResource}
                    onClose={() => {
                        setEditingResource(null);
                        setResolvingReportId(null);
                    }}
                    resource={editingResource}
                    categories={categories}
                    onSave={handleSaveResource}
                />
            )}
        </div>
    );
};

export default AdminDashboard;
