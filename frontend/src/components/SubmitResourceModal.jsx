// Resource Submission Form for HumanAid
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const SubmitResourceModal = ({ isOpen, onClose, categories = [] }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    state: 'IL',
    zipCode: '',
    phone: '',
    website: '',
    email: '',
    hours: '',
    categoryId: '',
    notes: ''
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        description: '',
        address: '',
        city: '',
        state: 'IL',
        zipCode: '',
        phone: '',
        website: '',
        email: '',
        hours: '',
        categoryId: '',
        notes: ''
      });
      setSubmitStatus(null);
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          submittedBy: user?.email || 'anonymous',
          submittedByName: user?.displayName || 'Anonymous',
          submittedByUid: user?.uid || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit resource');
      }

      setSubmitStatus('success');
    } catch (error) {
      console.error('Submission error:', error);
      setErrorMessage(error.message || 'Failed to submit. Please try again.');
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen
  if (submitStatus === 'success') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="submit-modal success-modal" onClick={(e) => e.stopPropagation()}>
          <div className="success-content">
            <div className="success-icon">✓</div>
            <h2>Thank You!</h2>
            <p>Your resource has been submitted for review.</p>
            <p className="success-detail">
              Our team will verify the information and publish it within 24-48 hours.
            </p>
            <button className="submit-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="submit-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="submit-header">
          <h2>Submit a Resource</h2>
          <p>Help others by adding a local assistance resource</p>
        </div>

        {errorMessage && (
          <div className="submit-error">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="submit-form">
          {/* Organization Info */}
          <div className="form-section">
            <h3>Organization Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Organization Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Community Food Pantry"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the services provided..."
                rows={3}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="categoryId">Category *</label>
              <select
                id="categoryId"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              >
                <option value="">Select a category...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location Info */}
          <div className="form-section">
            <h3>Location</h3>
            
            <div className="form-group">
              <label htmlFor="address">Street Address *</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="123 Main Street"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city">City *</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Chicago"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group small">
                <label htmlFor="state">State *</label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                >
                  <option value="IL">Illinois</option>
                  <option value="MO">Missouri</option>
                </select>
              </div>

              <div className="form-group small">
                <label htmlFor="zipCode">ZIP Code *</label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="60601"
                  maxLength={5}
                  pattern="[0-9]{5}"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="form-section">
            <h3>Contact Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(312) 555-1234"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="info@organization.org"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="website">Website</label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://www.organization.org"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="hours">Hours of Operation</label>
              <input
                type="text"
                id="hours"
                name="hours"
                value={formData.hours}
                onChange={handleChange}
                placeholder="Mon-Fri 9am-5pm, Sat 10am-2pm"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="form-section">
            <h3>Additional Information</h3>
            
            <div className="form-group">
              <label htmlFor="notes">Notes for Reviewers</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional details that might help during review..."
                rows={2}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="submit-footer">
            <p className="submit-disclaimer">
              * Required fields. Submissions are reviewed before publishing.
            </p>
            <div className="submit-actions">
              <button 
                type="button" 
                className="cancel-btn"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Resource'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitResourceModal;
