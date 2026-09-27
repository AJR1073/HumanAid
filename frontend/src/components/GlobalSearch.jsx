import { apiFetch } from '../api';
import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X } from 'lucide-react';
import './GlobalSearch.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const GlobalSearch = ({ onLocationSelect, onResourceSelect, currentMode = 'need_help' }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }
        let active = true;
        const controller = new AbortController();
        setLoading(true);
        setIsOpen(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal });
                if (!res.ok) throw new Error('Search unavailable.');
                const data = await res.json();
                if (active) setResults(data.results || []);
            } catch (error) {
                if (active && error.name !== 'AbortError') setResults([]);
            } finally {
                if (active) setLoading(false);
            }
        }, 250);
        return () => { active = false; clearTimeout(timer); controller.abort(); };
    }, [query]);

    const handleSelect = (result) => {
        setQuery('');
        setIsOpen(false);

        // Track analytics
        apiFetch(`${API_BASE}/analytics/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resource_id: result.id,
                action_type: 'view_resource',
                details: { source: 'global_search', query: query }
            })
        }).catch(err => console.error('Tracking failed', err));

        if (onResourceSelect) {
            onResourceSelect(result);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
    };

    return (
        <div className="global-search-wrapper" ref={wrapperRef}>
            <div className={`global-search-input-container ${isOpen ? 'active' : ''}`}>
                <Search className="search-icon" size={20} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search resources, cities, or support..."
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                />
                {query && (
                    <button className="clear-search-btn" aria-label="Clear search" onClick={clearSearch}>
                        <X size={16} />
                    </button>
                )}
            </div>

            {isOpen && (results.length > 0 || loading) && (
                <div className="global-search-results">
                    {loading ? (
                        <div className="search-loading">Searching...</div>
                    ) : (
                        results.map((result) => (
                            <div
                                key={result.id}
                                className="search-result-item"
                                role="button"
                                tabIndex={0}
                                onKeyDown={event => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        handleSelect(result);
                                    }
                                }}
                                onClick={() => handleSelect(result)}
                            >
                                <div className="result-icon">
                                    {result.primary_category_icon || '📍'}
                                </div>
                                <div className="result-info">
                                    <div className="result-name">{result.name}</div>
                                    <div className="result-location">
                                        {result.city}, {result.state} • {result.primary_category || 'Resource'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
