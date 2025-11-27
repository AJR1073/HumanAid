import { useState, useEffect } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import { MapPin, Search, Menu, X, Heart, Users, Navigation, MapPinned } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function App() {
  const [mode, setMode] = useState('need_help'); // 'need_help' or 'want_help'
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null); // Track current search location
  const [showStats, setShowStats] = useState(false); // For mobile stats toggle
  
  // Map state
  const [viewState, setViewState] = useState({
    longitude: -89.6501, // Illinois center
    latitude: 40.6331,
    zoom: 7
  });

  // Load categories
  useEffect(() => {
    fetchCategories();
    fetchStats();
  }, [mode]);

  // Load resources when category or location changes
  useEffect(() => {
    fetchResources();
  }, [selectedCategory, currentLocation]);

  // Debug: Log when resources change
  useEffect(() => {
    console.log('[HumanAid] Resources state updated:', {
      total: resources.length,
      withCoords: resources.filter(r => r.latitude && r.longitude).length,
      sample: resources.slice(0, 2).map(r => ({ id: r.id, name: r.name, lat: r.latitude, lon: r.longitude }))
    });
  }, [resources]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/resources?mode=${mode}`);
      const data = await response.json();
      // Use total from backend, or fallback to count
      const totalResources = data.total || data.count || data.resources.length;
      // Count unique cities from returned resources (sample)
      const uniqueCities = new Set(data.resources.map(r => `${r.city}, ${r.state}`)).size;
      setStats({
        totalResources: totalResources,
        citiesCovered: uniqueCities
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/categories?mode=${mode}`);
      const data = await response.json();
      setCategories(data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      let url;
      
      // If we have a current location (from ZIP or "Near Me"), use that
      if (currentLocation) {
        url = `${API_BASE}/resources?lat=${currentLocation.lat}&lon=${currentLocation.lon}&radius=${currentLocation.radius || 25}`;
      } else {
        // Default: show all resources
        url = `${API_BASE}/resources?limit=100`;
      }
      
      // Add category filter if selected
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[HumanAid] Fetched resources:', {
        count: data.resources.length,
        withCoords: data.resources.filter(r => r.latitude && r.longitude).length,
        url: url
      });
      
      // Backend now calculates and sorts by distance, just use the data
      setResources(data.resources);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setResources(data.results);
      
      // Center map on first result
      if (data.results.length > 0) {
        setViewState({
          ...viewState,
          longitude: data.results[0].longitude,
          latitude: data.results[0].latitude,
          zoom: 12
        });
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Update map view
        setViewState({
          ...viewState,
          longitude,
          latitude,
          zoom: 12
        });

        // Reverse geocode to get place name
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`)
          .then(res => res.json())
          .then(data => {
            const placeName = data.features && data.features[0] ? data.features[0].place_name : 'your location';
            setCurrentLocation({ lat: latitude, lon: longitude, radius: 25, placeName });
          })
          .catch(() => {
            setCurrentLocation({ lat: latitude, lon: longitude, radius: 25, placeName: 'your location' });
          });
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enable location services.');
        setGettingLocation(false);
      }
    );
  };

  const searchByZipCode = async (e) => {
    e.preventDefault();
    if (!zipCode.trim()) return;

    setLoading(true);
    try {
      // First, try to geocode the zip code to get coordinates
      const geocodeResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zipCode)}.json?country=US&types=postcode&access_token=${MAPBOX_TOKEN}`
      );
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.features && geocodeData.features.length > 0) {
        const [longitude, latitude] = geocodeData.features[0].center;
        const placeName = geocodeData.features[0].place_name;
        
        // Center map on zip code location
        setViewState({
          ...viewState,
          longitude,
          latitude,
          zoom: 11
        });
        
        // Set current location (this will trigger fetchResources via useEffect)
        setCurrentLocation({ lat: latitude, lon: longitude, radius: 50, placeName });
        
        // Show info message after resources load
        setTimeout(() => {
          setSearchInfo(`Searching within 50 miles of ${placeName}`);
          setTimeout(() => setSearchInfo(null), 5000);
        }, 500);
      } else {
        alert(`We couldn't find ZIP code "${zipCode}". Please check the ZIP code and try again, or use the "Near Me" button to search by your current location.`);
      }
    } catch (error) {
      console.error('Error searching by zip code:', error);
      alert('Unable to search at this time. Please try using the "Near Me" button or search by city name.');
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Heart className="logo-icon" />
            <h1>HumanAid</h1>
          </div>
          
          {/* Mode Toggle */}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === 'need_help' ? 'active' : ''}`}
              onClick={() => setMode('need_help')}
            >
              <Users size={20} />
              <span>I Need Help</span>
            </button>
            <button
              className={`mode-btn ${mode === 'want_help' ? 'active' : ''}`}
              onClick={() => setMode('want_help')}
            >
              <Heart size={20} />
              <span>I Want to Help</span>
            </button>
          </div>

          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <form onSubmit={handleSearch} className="search-bar">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              className="search-input"
              placeholder={mode === 'need_help' ? 
                'Search for food, shelter, healthcare...' : 
                'Search volunteer opportunities...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
          
          <form onSubmit={searchByZipCode} className="zip-form">
            <input
              type="text"
              className="zip-input"
              placeholder="Enter ZIP code"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              maxLength="5"
            />
            <button type="submit" className="zip-btn">Go</button>
          </form>

          <button 
            type="button" 
            className="location-btn"
            onClick={useMyLocation}
            disabled={gettingLocation}
            title="Use my location"
          >
            <Navigation size={20} />
            {gettingLocation ? 'Getting...' : 'Near Me'}
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* Stats Toggle Button (Mobile Only) */}
        {stats && (
          <button 
            className="stats-toggle-btn"
            onClick={() => setShowStats(!showStats)}
            aria-label="Toggle statistics"
          >
            📊 {stats.totalResources.toLocaleString()} Resources
          </button>
        )}

        {/* Stats Banner */}
        {stats && (
          <div className={`stats-banner ${showStats ? 'show' : ''}`}>
            <div className="stat-item">
              <div className="stat-number">{stats.totalResources.toLocaleString()}</div>
              <div className="stat-label">Food Assistance Resources</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number">95+</div>
              <div className="stat-label">Cities Covered</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number">IL & MO</div>
              <div className="stat-label">Across Both States</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number">✓</div>
              <div className="stat-label">Food Banks, Pantries, Soup Kitchens</div>
            </div>
          </div>
        )}

        {/* Search Info Banner */}
        {searchInfo && (
          <div className="search-info-banner">
            <p>{searchInfo}</p>
            <button onClick={() => setSearchInfo(null)}>×</button>
          </div>
        )}
        
        {/* Content Grid - Sidebar, Map, Resource List */}
        <div className="content-grid">
          {/* Sidebar */}
          <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
            <h2>Categories</h2>
            <div className="category-list">
              <button
                className={`category-item ${!selectedCategory ? 'active' : ''}`}
                onClick={() => setSelectedCategory(null)}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`category-item ${selectedCategory === cat.slug ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.slug)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </aside>

          {/* Map */}
          <div className="map-container">
          {MAPBOX_TOKEN && !mapError ? (
            <Map
              {...viewState}
              onMove={evt => setViewState(evt.viewState)}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              mapboxAccessToken={MAPBOX_TOKEN}
              style={{ width: '100%', height: '100%' }}
              onError={(e) => {
                console.error('Map error:', e);
                setMapError(e.error?.message || 'Map failed to load');
              }}
              reuseMaps
            >
              {resources.map((resource) => (
                resource.latitude && resource.longitude && (
                  <Marker
                    key={resource.id}
                    longitude={resource.longitude}
                    latitude={resource.latitude}
                    onClick={(e) => {
                      e.originalEvent.stopPropagation();
                      setSelectedResource(resource);
                    }}
                  >
                    <div className="custom-marker">
                      <div className="marker-pin"></div>
                      <div className="marker-shadow"></div>
                    </div>
                  </Marker>
                )
              ))}

              {selectedResource && (
                <Popup
                  longitude={selectedResource.longitude}
                  latitude={selectedResource.latitude}
                  onClose={() => setSelectedResource(null)}
                  closeButton={true}
                  closeOnClick={false}
                >
                  <div className="popup-content">
                    <h3>{selectedResource.name}</h3>
                    <p>{selectedResource.address}</p>
                    <p>{selectedResource.city}, {selectedResource.state} {selectedResource.zip_code}</p>
                    {selectedResource.phone && (
                      <p><strong>Phone:</strong> {selectedResource.phone}</p>
                    )}
                    <div className="popup-actions">
                      {/* Get Directions Button */}
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedResource.latitude},${selectedResource.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="directions-btn"
                      >
                        <MapPinned size={16} />
                        Get Directions
                      </a>
                      {selectedResource.website && (
                        <a 
                          href={selectedResource.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="website-btn"
                        >
                          Visit Website
                        </a>
                      )}
                    </div>
                  </div>
                </Popup>
              )}
            </Map>
          ) : (
            <div className="map-placeholder">
              {mapError ? (
                <>
                  <p>⚠️ Map Error</p>
                  <p>{mapError}</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
                    Try refreshing the page or check browser WebGL support
                  </p>
                </>
              ) : !MAPBOX_TOKEN ? (
                <>
                  <p>Map requires Mapbox token</p>
                  <p>Set VITE_MAPBOX_TOKEN in .env file</p>
                </>
              ) : null}
            </div>
          )}

          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Loading resources...</p>
            </div>
          )}
        </div>

        {/* Resource List */}
        <div className="resource-list">
          <div className="resource-list-header">
            <h2>
              {selectedCategory 
                ? `${categories.find(c => c.slug === selectedCategory)?.name || 'Resources'}`
                : 'All Resources'
              }
              {currentLocation && currentLocation.placeName && (
                <span className="location-context"> near {currentLocation.placeName.split(',')[0]}</span>
              )}
              <span className="count">({resources.length})</span>
            </h2>
            {currentLocation && (
              <button className="clear-location-btn" onClick={() => setCurrentLocation(null)}>
                Clear Location
              </button>
            )}
          </div>
          
          <div className="resources">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="resource-card"
                onClick={() => {
                  setSelectedResource(resource);
                  if (resource.latitude && resource.longitude) {
                    setViewState({
                      ...viewState,
                      longitude: resource.longitude,
                      latitude: resource.latitude,
                      zoom: 14
                    });
                  }
                }}
              >
                <h3>{resource.name}</h3>
                <p className="address">
                  {resource.address}<br />
                  {resource.city}, {resource.state} {resource.zip_code}
                </p>
                {resource.phone && (
                  <p className="phone">📞 {resource.phone}</p>
                )}
                <div className="resource-links">
                  {resource.latitude && resource.longitude && (
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${resource.latitude},${resource.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="directions-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🗺️ Directions
                    </a>
                  )}
                  {resource.website && (
                    <a 
                      href={resource.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="website-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🌐 Website
                    </a>
                  )}
                </div>
                {resource.distance !== undefined && (
                  <p className="distance">
                    📍 {resource.distance < 1 
                      ? `${(resource.distance * 5280).toFixed(0)} feet away`
                      : `${resource.distance.toFixed(1)} miles away`
                    }
                  </p>
                )}
                {resource.categories && (
                  <div className="tags">
                    {resource.categories.map((cat, idx) => (
                      <span key={idx} className="tag">{cat}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default App;
