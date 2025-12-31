import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Check, X, Shield, Clock, MapPin, Phone, Globe, Mail } from 'lucide-react';
import AdminResourceModal from './AdminResourceModal';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const AdminDashboard = () => {
    const { user, isAdmin } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' | 'resources' | 'admins'
    const [resources, setResources] = useState([]); // Admin resources list
    const [resourceSearch, setResourceSearch] = useState('');
    const [missingZipOnly, setMissingZipOnly] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [promoteStatus, setPromoteStatus] = useState(null);
    const [admins, setAdmins] = useState([]); // List of current admins

    // Edit Modal State
    const [editingResource, setEditingResource] = useState(null);
    const [categories, setCategories] = useState([]);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_BASE}/categories?include_empty=true&all_levels=true`);
            const data = await res.json();
            setCategories(data.categories || []);
        } catch (e) {
            console.error('Failed to fetch categories', e);
        }
    };

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/submissions/pending`);
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
            const res = await fetch(`${API_BASE}/admin/resources?search=${encodeURIComponent(resourceSearch)}&missing_zip=${missingZipOnly}`);
            const data = await res.json();
            setResources(data.resources || []);
        } catch (error) {
            console.error('Error fetching resources:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/list`);
            const data = await res.json();
            setAdmins(data.admins || []);
        } catch (error) {
            console.error('Error fetching admins:', error);
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
        }
    }, [isAdmin, activeTab, resourceSearch, missingZipOnly]);

    const handleSaveResource = async (id, updatedData) => {
        const res = await fetch(`${API_BASE}/admin/resources/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        if (!res.ok) throw new Error('Failed to update');

        // Refresh list
        fetchResources();
    };

    const handleAction = async (id, action) => {
        try {
            if (!confirm(`Are you sure you want to ${action} this submission?`)) return;

            const res = await fetch(`${API_BASE}/submissions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: action,
                    reviewedBy: user.uid
                })
            });

            if (res.ok) {
                setSubmissions(submissions.filter(s => s.id !== id));
            }
        } catch (error) {
            console.error(`Error ${action} submission:`, error);
            alert(`Failed to ${action} submission`);
        }
    };

    const handlePromote = async (e) => {
        e.preventDefault();
        if (!adminEmail) return;

        try {
            const res = await fetch(`${API_BASE}/admin/promote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: adminEmail })
            });

            if (res.ok) {
                setPromoteStatus({ type: 'success', msg: `Users with email ${adminEmail} are now Admins.` });
                setAdminEmail('');
                fetchAdmins();
            } else {
                throw new Error('Failed');
            }
        } catch (error) {
            setPromoteStatus({ type: 'error', msg: 'Failed to promote user. Ensure email exists.' });
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
                        className={activeTab === 'submissions' ? 'active' : ''}
                        onClick={() => setActiveTab('submissions')}
                    >
                        Submissions ({submissions.length})
                    </button>
                    <button
                        className={activeTab === 'resources' ? 'active' : ''}
                        onClick={() => setActiveTab('resources')}
                    >
                        All Resources
                    </button>
                    <button
                        className={activeTab === 'admins' ? 'active' : ''}
                        onClick={() => setActiveTab('admins')}
                    >
                        Manage Admins
                    </button>
                </div>
            </div>

            <div className="admin-content">
                {activeTab === 'submissions' ? (
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
                ) : activeTab === 'resources' ? (
                    <div className="resources-manager">
                        <div className="resource-search-bar">
                            <input
                                type="text"
                                placeholder="Name, City, or Zip (e.g. 62002)..."
                                value={resourceSearch}
                                onChange={(e) => setResourceSearch(e.target.value)}
                            />
                            <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                                Search by Resource Name, City, or 5-digit Zip Code.
                            </small>
                        </div>
                        {loading ? (
                            <div className="loading-spinner">Loading...</div>
                        ) : resources.length === 0 ? (
                            <div className="empty-state">No resources found</div>
                        ) : (
                            <div className="submissions-grid">
                                {resources.map(res => (
                                    <div key={res.id} className="submission-card">
                                        <div className="sub-header">
                                            <h3>{res.name}</h3>
                                            <span className={`status-badge ${res.is_active ? 'active' : 'inactive'}`}>
                                                {res.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="sub-details">
                                            <p><strong>Category:</strong> {res.category_name || res.primary_category_id}</p>
                                            <p>{res.address}, {res.city}</p>
                                            <div style={{ marginTop: '10px' }}>
                                                <button
                                                    className="edit-resource-btn"
                                                    onClick={() => setEditingResource(res)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.5rem',
                                                        background: '#3B82F6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    Edit / Fix
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
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
                )}

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
                                                    const res = await fetch(`${API_BASE}/admin/demote`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ email: admin.email })
                                                    });
                                                    if (res.ok) fetchAdmins();
                                                    else alert('Failed to demote');
                                                } catch (e) { console.error(e); alert('Error demoting'); }
                                            }}
                                            style={{
                                                background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171',
                                                padding: '5px 10px', borderRadius: '6px', cursor: 'pointer'
                                            }}
                                        >
                                            Demote
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {editingResource && (
                <AdminResourceModal
                    isOpen={!!editingResource}
                    onClose={() => setEditingResource(null)}
                    resource={editingResource}
                    categories={categories}
                    onSave={handleSaveResource}
                />
            )}
        </div>
    );
};

export default AdminDashboard;
