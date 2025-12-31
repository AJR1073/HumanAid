import { useState, useEffect } from 'react';
import { X, Search, Globe, Save, Loader } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const AdminResourceModal = ({ isOpen, onClose, resource, categories, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        state: 'IL',
        zip_code: '',
        phone: '',
        email: '',
        website: '',
        description: '',
        hours: '',
        primary_category_id: '',
        is_active: true,
        eligibility_requirements: '',
        appointment_required: false,
        walk_ins_accepted: true,
        food_dist_type: '',
        food_dist_onsite: false,
        service_area: '',
        languages_spoken: ''
    });
    const [scanning, setScanning] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (resource) {
            setFormData({
                name: resource.name || '',
                address: resource.address || '',
                city: resource.city || '',
                state: resource.state || 'IL',
                zip_code: resource.zip_code || '',
                phone: resource.phone || '',
                email: resource.email || '',
                website: resource.website || '',
                description: resource.description || '',
                hours: resource.hours || '',
                primary_category_id: resource.primary_category_id || '',
                is_active: resource.is_active,
                eligibility_requirements: resource.eligibility_requirements || '',
                appointment_required: resource.appointment_required || false,
                walk_ins_accepted: resource.walk_ins_accepted !== undefined ? resource.walk_ins_accepted : true,
                food_dist_type: resource.food_dist_type || '',
                food_dist_onsite: resource.food_dist_onsite || false,
                service_area: resource.service_area || '',
                languages_spoken: Array.isArray(resource.languages_spoken) ? resource.languages_spoken.join(', ') : (resource.languages_spoken || '')
            });
        }
    }, [resource]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleScan = async () => {
        if (!formData.website) return alert('Please enter a website URL first');

        setScanning(true);
        try {
            const res = await fetch(`${API_BASE}/scan-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: formData.website })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setFormData(prev => ({
                ...prev,
                name: data.title || prev.name,
                description: data.description || prev.description,
                phone: data.phone || prev.phone,
                address: data.address || prev.address,
                city: data.city || prev.city,
                state: data.state || prev.state,
                zip_code: data.zipCode || prev.zip_code,
                email: data.email || prev.email,
                hours: data.hours || prev.hours,
                // Match category if possible
            }));

            alert('Auto-filled details from website!');
        } catch (error) {
            console.error('Scan failed:', error);
            alert('Failed to scan website');
        } finally {
            setScanning(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(resource.id, formData);
            onClose();
        } catch (error) {
            console.error('Failed to save:', error);
            alert('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content admin-edit-modal">
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="modal-header">
                    <h2>Edit Resource</h2>
                    <p>Update details for {formData.name}</p>
                </div>

                <form onSubmit={handleSubmit} className="resource-form">
                    <div className="form-group-row">
                        <div className="form-group">
                            <label>Name <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleChange}
                                />
                                Is Active
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Website (for Auto-fill)</label>
                        <div className="input-with-action">
                            <input
                                name="website"
                                value={formData.website}
                                onChange={handleChange}
                                placeholder="https://..."
                            />
                            <button
                                type="button"
                                className="scan-btn"
                                onClick={handleScan}
                                disabled={scanning || !formData.website}
                            >
                                {scanning ? <Loader className="spin" size={16} /> : <Globe size={16} />}
                                {scanning ? 'Scanning...' : 'Re-Scan'}
                            </button>
                        </div>
                    </div>

                    <div className="form-group-row">
                        <div className="form-group">
                            <label>Address</label>
                            <input name="address" value={formData.address} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>City <span style={{ color: '#ef4444' }}>*</span></label>
                            <input name="city" value={formData.city} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="form-group-row">
                        <div className="form-group">
                            <label>State <span style={{ color: '#ef4444' }}>*</span></label>
                            <input name="state" value={formData.state} onChange={handleChange} maxLength={2} required />
                        </div>
                        <div className="form-group">
                            <label>Zip Code</label>
                            <input name="zip_code" value={formData.zip_code} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Category <span style={{ color: '#ef4444' }}>*</span></label>
                        <select
                            name="primary_category_id"
                            value={formData.primary_category_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select Category</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Hours</label>
                        <input name="hours" value={formData.hours} onChange={handleChange} placeholder="e.g. Mon-Fri 9am-5pm" />
                    </div>

                    <hr style={{ margin: '1.5rem 0', borderColor: '#e5e7eb' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#374151' }}>Operational Details</h3>

                    <div className="form-group">
                        <label>Eligibility Requirements</label>
                        <textarea
                            name="eligibility_requirements"
                            value={formData.eligibility_requirements}
                            onChange={handleChange}
                            placeholder="e.g. Must reside in 62298, Income verification needed"
                            rows={2}
                        />
                    </div>

                    <div className="form-group">
                        <label>Service Area</label>
                        <input
                            name="service_area"
                            value={formData.service_area}
                            onChange={handleChange}
                            placeholder="e.g. Madison County"
                        />
                    </div>

                    <div className="form-group">
                        <label>Languages Spoken</label>
                        <input
                            name="languages_spoken"
                            value={formData.languages_spoken}
                            onChange={handleChange}
                            placeholder="English, Spanish"
                        />
                    </div>

                    <div className="form-group-row" style={{ marginTop: '1rem' }}>
                        <div className="form-group checkbox-group" style={{ justifyContent: 'flex-start' }}>
                            <label>
                                <input
                                    type="checkbox"
                                    name="appointment_required"
                                    checked={formData.appointment_required}
                                    onChange={handleChange}
                                />
                                Appointment Required
                            </label>
                        </div>
                        <div className="form-group checkbox-group" style={{ justifyContent: 'flex-start' }}>
                            <label>
                                <input
                                    type="checkbox"
                                    name="walk_ins_accepted"
                                    checked={formData.walk_ins_accepted}
                                    onChange={handleChange}
                                />
                                Walk-ins Accepted
                            </label>
                        </div>
                    </div>

                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem', color: '#4b5563' }}>Food Pantry Specifics</h4>
                    <div className="form-group-row">
                        <div className="form-group">
                            <label>Distribution Type</label>
                            <select
                                name="food_dist_type"
                                value={formData.food_dist_type}
                                onChange={handleChange}
                            >
                                <option value="">N/A</option>
                                <option value="boxes">Boxes</option>
                                <option value="meal">Hot Meal</option>
                                <option value="both">Both</option>
                            </select>
                        </div>
                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    name="food_dist_onsite"
                                    checked={formData.food_dist_onsite}
                                    onChange={handleChange}
                                />
                                On-site Distribution
                            </label>
                        </div>
                    </div>
                    <hr style={{ margin: '1.5rem 0', borderColor: '#e5e7eb' }} />

                    <div className="form-group-row">
                        <div className="form-group">
                            <label>Phone</label>
                            <input name="phone" value={formData.phone} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input name="email" value={formData.email} onChange={handleChange} placeholder="contact@example.org" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="submit-btn" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Minimal Styles for this modal (can move to css) */}
            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    overflow-y: auto;
                    padding: 20px;
                }
                .admin-edit-modal {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    max-width: 600px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    position: relative;
                }
                .form-group-row {
                    display: flex;
                    gap: 1rem;
                }
                .form-group-row .form-group {
                    flex: 1;
                }
                .checkbox-group {
                    display: flex;
                    align-items: flex-end;
                    justify-content: flex-end;
                    padding-bottom: 10px;
                }
                .checkbox-group label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    font-weight: 600;
                    color: #166534;
                }
                .input-with-action {
                    display: flex;
                    gap: 0.5rem;
                }
                .scan-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 0 1rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .scan-btn:hover { background: #4f46e5; }
                .scan-btn:disabled { opacity: 0.7; cursor: not-allowed; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default AdminResourceModal;
