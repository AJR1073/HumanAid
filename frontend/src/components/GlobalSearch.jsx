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

    const handleSearch = async (value) => {
        setQuery(value);
        if (value.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        setIsOpen(true);

        try {
            // Search resources
            const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(value)}&limit=8`);
            const data = await res.json();
            setResults(data.results || []);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (result) => {
        setQuery('');
        setIsOpen(false);
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
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search resources, cities, or support..."
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                />
                {query && (
                    <button className="clear-search-btn" onClick={clearSearch}>
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
