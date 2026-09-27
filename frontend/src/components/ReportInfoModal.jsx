import { apiFetch, API_BASE } from '../api';
import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const ReportInfoModal = ({ isOpen, onClose, resource }) => {
    const [issueType, setIssueType] = useState('');
    const [description, setDescription] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !resource) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!issueType) {
            alert('Please select an issue type.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiFetch(`${API_BASE}/resources/${resource.id}/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    issue_type: issueType,
                    description,
                    contact_email: email
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert('Report submitted. Thank you for helping keep our data accurate!');
                onClose();
                setIssueType('');
                setDescription('');
                setEmail('');
            } else {
                throw new Error(data.error || 'Failed to submit');
            }
        } catch (error) {
            console.error('Error reporting issue:', error);
            alert('Failed to submit report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-modal-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={e => e.stopPropagation()}>
                <button className="auth-modal-close" aria-label="Close report" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="auth-header">
                    <div className="auth-icon-wrapper" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                        <AlertTriangle size={32} />
                    </div>
                    <h2>Report Issue</h2>
                    <p>Help us improve "{resource.name}"</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="report-issue">What's wrong?</label>
                        <select
                            id="report-issue"
                            value={issueType}
                            onChange={e => setIssueType(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #D1D5DB',
                                marginTop: '0.5rem'
                            }}
                        >
                            <option value="">Select an issue...</option>
                            <option value="incorrect_info">Incorrect Information (Hours, Phone, etc.)</option>
                            <option value="closed">Place is Permanently Closed</option>
                            <option value="duplicate">Duplicate Listing</option>
                            <option value="wrong_category">Wrong Category</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="report-details">Details</label>
                        <textarea
                            id="report-details"
                            maxLength={4000}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Please provide the correct info or more details..."
                            rows={4}
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #D1D5DB',
                                marginTop: '0.5rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="report-email">Your Email (Optional)</label>
                        <input
                            type="email"
                            id="report-email"
                            maxLength={254}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="In case we need to verify..."
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={submitting}
                        style={{ background: '#DC2626' }} // Red for report
                    >
                        {submitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ReportInfoModal;
