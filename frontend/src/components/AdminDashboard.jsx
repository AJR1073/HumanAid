import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Check, X, Shield, Clock, MapPin, Phone, Globe, Mail } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const AdminDashboard = () => {
    const { user, isAdmin } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' | 'admins'
    const [adminEmail, setAdminEmail] = useState('');
    const [promoteStatus, setPromoteStatus] = useState(null);

    useEffect(() => {
        if (isAdmin && activeTab === 'submissions') {
            fetchSubmissions();
        }
    }, [isAdmin, activeTab]);

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

    const handleAction = async (id, action) => {
        try {
            if (!confirm(`Are you sure you want to ${action} this submission?`)) return;

            const res = await fetch(`${API_BASE}/submissions/${id}/${action}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid }) // Simple audit log
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
            </div>
        </div>
    );
};

export default AdminDashboard;
