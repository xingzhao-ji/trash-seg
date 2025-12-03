import React, { useState, useEffect } from 'react';
import api from './api';
import CameraCapture from './CameraCapture';
import MapView from './MapView';

function App() {
  // View state management
  const [view, setView] = useState('student'); // 'student' or 'admin'
  const [currentScreen, setCurrentScreen] = useState('studentHome');
  const [adminTab, setAdminTab] = useState('overview');

  // Data states
  const [station, setStation] = useState(null);
  const [nearbyBins, setNearbyBins] = useState([]);
  const [overviewStats, setOverviewStats] = useState([]);
  const [problemBins, setProblemBins] = useState([]);
  const [studentImpact, setStudentImpact] = useState({ compost: 0, recycle: 0, landfill: 0 });
  const [selectedBin, setSelectedBin] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [selectedFullness, setSelectedFullness] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [binFilter, setBinFilter] = useState('all');
  const [hideFullBins, setHideFullBins] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [filterFullBins, setFilterFullBins] = useState(false); // false = show all bins, true = show only full bins

  // Bin creation
  const [newBinData, setNewBinData] = useState({
    name: '',
    facilityId: '',
    qrCode: '',
    location: '',
    building: '',
    floor: '',
    latitude: null,
    longitude: null,
    streams: [],
    description: ''
  });
  const [newBinError, setNewBinError] = useState('');
  const [newBinLoading, setNewBinLoading] = useState(false);

  // Filtered bins based on fullness
  const displayedBins = nearbyBins.filter(bin => {
    if (filterFullBins) {
      return bin.fullness >= 80; // Only show full bins
    }
    return true; // Show all bins
  });
  // Get User Location
  useEffect(() => {
    if ('geolocation' in navigator) {
      // Request permission and start watching position
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          setLocationError(null);
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error('Location error:', error);
          let errorMsg = 'Unable to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMsg = 'Location request timed out.';
              break;
          }
          setLocationError(errorMsg);
          setIsLoadingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );

      // Cleanup function
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setLocationError('Geolocation is not supported by your browser.');
      setIsLoadingLocation(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [userLocation]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      // Test API connection first
      console.log('Testing API connection...');
      const health = await api.testConnection();
      console.log('API health check:', health);

      if (health.status === 'error') {
        throw new Error(`Cannot connect to server at ${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}. Make sure the backend is running.`);
      }


      console.log('Loading data from API...');

      // Prepare bins fetch with location if available
      const binsPromise = userLocation
        ? api.fetchNearbyBins(userLocation.lat, userLocation.lng, 5000)
        : api.fetchNearbyBins();

      // Load all data in parallel with individual error handling
      const [stationData, binsData, statsData, problemData, impactData] = await Promise.allSettled([
        api.fetchCurrentStation(),
        binsPromise,  // Use the location-aware promise
        api.fetchOverviewStats(),
        api.fetchProblemBins(),
        api.fetchStudentImpact()
      ]);

      // Process results
      if (stationData.status === 'fulfilled') {
        setStation(stationData.value);
      } else {
        console.error('Failed to load station:', stationData.reason);
        // Set a default station so the app still works
        setStation({
          name: 'Default Station',
          description: 'Station data unavailable',
          qrCode: 'N/A'
        });
      }

      if (binsData.status === 'fulfilled') {
        const bins = binsData.value;
        // Log if we got distance data
        if (userLocation) {
          console.log(`Loaded ${bins.length} bins with distances from user location`);
        }
        setNearbyBins(bins);
      } else {
        console.error('Failed to load bins:', binsData.reason);
        setNearbyBins([]);
      }

      if (statsData.status === 'fulfilled') {
        setOverviewStats(statsData.value);
      } else {
        console.error('Failed to load stats:', statsData.reason);
        setOverviewStats([]);
      }

      if (problemData.status === 'fulfilled') {
        setProblemBins(problemData.value);
      } else {
        console.error('Failed to load problem bins:', problemData.reason);
        setProblemBins([]);
      }

      if (impactData.status === 'fulfilled') {
        setStudentImpact(impactData.value);
      } else {
        console.error('Failed to load impact:', impactData.reason);
        setStudentImpact({ compost: 0, recycle: 0, landfill: 0 });
      }

      // If we got at least some data, clear the error
      if (stationData.status === 'fulfilled' || binsData.status === 'fulfilled') {
        setError(null);
      } else {
        setError('Failed to load data. Please check your connection and try again.');
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to connect to server. Please ensure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }
  // Navigation functions
  function goToStudentHome() {
    setCurrentScreen('studentHome');
    setSuccessMessage('');
  }

  function goToCamera() {
    setCurrentScreen('camera');
  }

  async function handleUseExampleResults() {
    try {
      const items = await api.runSegmentationOnImage(null);
      setDetectedItems(items);
      setCurrentScreen('sortingResults');
    } catch (err) {
      console.error('Error getting segmentation results:', err);
      setError('Failed to get example results.');
    }
  }

  async function handleDoneSorting() {
    // Update student impact
    const itemsByStream = {
      compost: detectedItems.filter(item => item.stream === 'compost').length,
      recycle: detectedItems.filter(item => item.stream === 'recycle').length,
      landfill: detectedItems.filter(item => item.stream === 'landfill').length
    };

    try {
      const updatedImpact = await api.updateStudentImpact(detectedItems);
      setStudentImpact(updatedImpact);
    } catch (err) {
      console.error('Error updating impact:', err);
    }

    setCurrentScreen('sortingSuccess');
  }

  function goToReportFullness() {
    setCurrentScreen('reportFullness');
    setSelectedFullness(null);
  }

  async function handleSubmitFullness() {
    if (!selectedFullness || !station) return;

    try {
      await api.reportBinFullness(station._id, selectedFullness);
      setSuccessMessage('Thanks for reporting bin status!');
      goToStudentHome();
    } catch (err) {
      console.error('Error reporting fullness:', err);
      setError('Failed to report bin fullness.');
    }
  }

  // Add bin
  function toggleStream(stream) {
    setNewBinData(prev => {
      const hasStream = prev.streams.includes(stream);
      return {
        ...prev,
        streams: hasStream
          ? prev.streams.filter(s => s !== stream)
          : [...prev.streams, stream]
      };
    });
  }

  async function handleCreateBinSubmit(e) {
    e.preventDefault();
    setNewBinError('');
    setNewBinLoading(true);

    if (!newBinData.name.trim()) {
      setNewBinError('Name is required.');
      setNewBinLoading(false);
      return;
    }

    try {
      const payload = {
        ...newBinData,
        latitude: newBinData.latitude !== null && newBinData.latitude !== '' ? Number(newBinData.latitude) : undefined,
        longitude: newBinData.longitude !== null && newBinData.longitude !== '' ? Number(newBinData.longitude) : undefined
      };
      await api.createBin(payload);
      setSuccessMessage('Bin created successfully!');
      // reset form
      setNewBinData({
        name: '',
        facilityId: '',
        qrCode: '',
        location: '',
        building: '',
        floor: '',
        latitude: null,
        longitude: null,
        streams: [],
        description: ''
      });
      // reload data so new bin shows up in lists
      await loadData();
      setCurrentScreen('adminDashboard');
      setAdminTab('overview'); // or 'overview', up to you
    } catch (err) {
      console.error('Error creating bin:', err);
      setNewBinError(err.message || 'Failed to create bin.');
    } finally {
      setNewBinLoading(false);
    }
  }



  function goToNearbyBins() {
    setCurrentScreen('nearbyBins');
  }

  function handleUseBin(bin) {
    console.log('Using bin:', bin);
    // Replace station details with the selected bin's details
    setStation({
      ...station,
      _id: bin._id,
      name: bin.name,
      description: bin.description,
      qrCode: bin.qrCode,
    });
    setCurrentScreen('studentHome'); // Navigate back to the student home screen
  }

  function handleViewToggle(newView) {
    setView(newView);
    if (newView === 'admin') {
      setCurrentScreen('adminDashboard');
      setAdminTab('overview');
    } else {
      setCurrentScreen('studentHome');
    }
  }

  function handleInvestigateBin(bin) {
    console.log('Investigating bin:', bin);
    setSelectedBin(bin);
    setCurrentScreen('binDetail');
  }

  // Filter nearby bins
  const filteredBins = nearbyBins.filter(bin => {
    if (hideFullBins && bin.fullness >= 80) return false;
    if (binFilter === 'all') return true;
    return bin.streams && bin.streams.includes(binFilter);
  });

  // Render loading state
  if (loading) {
    return (
      <div className="app-root">
        <div className="app-container">
          <div className="app-main">
            <div className="loading-state">Loading prototype data...</div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !station) {
    return (
      <div className="app-root">
        <div className="app-container">
          <div className="app-main">
            <div className="error-text">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-container">
        {/* ADD: Location status banners */}
        {isLoadingLocation && (
          <div style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            textAlign: 'center',
            fontSize: 14
          }}>
            📍 Getting your location...
          </div>
        )}

        {locationError && (
          <div style={{
            padding: '8px 16px',
            background: '#fef2f2',
            color: '#991b1b',
            textAlign: 'center',
            fontSize: 14,
            borderBottom: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12
          }}>
            <span>⚠️ {locationError}</span>
            <button
              // onClick={retryLocation}
              style={{
                padding: '4px 12px',
                background: '#991b1b',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Header */}
        <header className="app-header">
          <div className="app-header-left">
            {currentScreen !== 'studentHome' && currentScreen !== 'adminDashboard' && (
              <button
                className="back-button"
                onClick={() => {
                  if (currentScreen === 'binDetail') {
                    if (view === 'admin') {
                      setCurrentScreen('adminDashboard');
                      setAdminTab('bins');
                    } else {
                      setCurrentScreen('nearbyBins'); // student came from Nearby Bins
                    }
                  } else if (view === 'admin') {
                    setCurrentScreen('adminDashboard');
                  } else {
                    goToStudentHome();
                  }
                }}
              >
                ←
              </button>
            )}
            <h1 className="app-title">Zero Waste System</h1>
          </div>
          <div className="view-toggle">
            <button
              className={`toggle-pill ${view === 'student' ? 'active' : ''}`}
              onClick={() => handleViewToggle('student')}
            >
              Student View
            </button>
            <button
              className={`toggle-pill ${view === 'admin' ? 'active' : ''}`}
              onClick={() => handleViewToggle('admin')}
            >
              Admin View
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main">
          {/* Student Home Screen */}
          {currentScreen === 'studentHome' && (
            <div className="screen centered-screen">
              {successMessage && (
                <div className="toast success-toast">{successMessage}</div>
              )}

              <div className="card station-card">
                <div className="station-icons">
                  <span>♻️</span>
                  <span>🗑️</span>
                  <span>🌱</span>
                </div>
                <div className="station-text">
                  <div className="station-name">{station?.name || 'Loading Station...'}</div>
                  <div className="station-description">
                    {station?.description || 'Compost / Recycle / Landfill station'}
                  </div>
                  <div className="station-qr">QR: {station?.qrCode || 'N/A'}</div>
                </div>
              </div>

              <div className="actions-section">
                <button className="primary-btn big-btn" onClick={goToCamera}>
                  <span className="btn-icon">📷</span>
                  Sort my items
                </button>
                <button className="secondary-btn big-btn" onClick={goToReportFullness}>
                  <span className="btn-icon">⚠️</span>
                  Report bin fullness
                </button>
                <button className="link-row" onClick={goToNearbyBins}>
                  <span>See nearby bins</span>
                  <span>→</span>
                </button>
              </div>

              <div className="footer-note">
                Help UCLA reach zero waste by 2030
              </div>
            </div>
          )}

          {/* Camera Screen */}
          {currentScreen === 'camera' && (
            <div className="screen">
              <div className="card camera-card">
                <div style={{ width: '100%' }}>
                  <CameraCapture
                    onCancel={() => setCurrentScreen('studentHome')}
                    onCapture={async (imgBase64) => {
                      try {
                        setLoading(true);
                        setError(null);
                        // Call API with the base64 image
                        const items = await api.runSegmentationOnImage(imgBase64);
                        setDetectedItems(items);
                        setCurrentScreen('sortingResults');
                      } catch (err) {
                        console.error('Segmentation failed:', err);
                        setError('Failed to run segmentation. Try example results or check server.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="primary-btn big-btn" onClick={handleUseExampleResults}>
                  Use example results
                </button>
                <button className="secondary-btn big-btn" onClick={goToStudentHome}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Sorting Results Screen */}
          {currentScreen === 'sortingResults' && (
            <div className="screen">
              <div className="card results-card">
                {/* Compost items */}
                <div className="stream-group">
                  <div className="stream-header">
                    <span className="stream-icon">🌱</span>
                    <div>
                      <div className="stream-title">Compost</div>
                      <div className="stream-description">Food waste, paper napkins, food-soiled paper</div>
                    </div>
                  </div>
                  <div className="chip-row">
                    {detectedItems.filter(item => item.stream === 'compost').map(item => (
                      <span key={item.id} className="chip">{item.label}</span>
                    ))}
                  </div>
                </div>

                {/* Recycle items */}
                <div className="stream-group">
                  <div className="stream-header">
                    <span className="stream-icon">♻️</span>
                    <div>
                      <div className="stream-title">Recycle</div>
                      <div className="stream-description">Clean plastic, paper, metal, glass</div>
                    </div>
                  </div>
                  <div className="chip-row">
                    {detectedItems.filter(item => item.stream === 'recycle').map(item => (
                      <span key={item.id} className="chip">{item.label}</span>
                    ))}
                  </div>
                </div>

                {/* Landfill items */}
                <div className="stream-group">
                  <div className="stream-header">
                    <span className="stream-icon">🗑️</span>
                    <div>
                      <div className="stream-title">Landfill</div>
                      <div className="stream-description">Non-recyclable plastics, mixed materials</div>
                    </div>
                  </div>
                  <div className="chip-row">
                    {detectedItems.filter(item => item.stream === 'landfill').map(item => (
                      <span key={item.id} className="chip">{item.label}</span>
                    ))}
                  </div>
                </div>
              </div>

              <button className="primary-btn big-btn" onClick={handleDoneSorting}>
                Done sorting ({detectedItems.length} items)
              </button>
              <button className="link-button">Not sure about an item?</button>
            </div>
          )}

          {/* Sorting Success Screen */}
          {currentScreen === 'sortingSuccess' && (
            <div className="screen">
              <div className="card success-card">
                <div className="bin-row">
                  <div className="bin-icon bin-compost">✓</div>
                  <div className="bin-icon bin-recycle">✓</div>
                  <div className="bin-icon bin-landfill">✓</div>
                </div>
                <div className="success-message">
                  Nice! You sorted {detectedItems.length} items correctly
                </div>
              </div>

              <button className="primary-btn big-btn" onClick={goToStudentHome}>
                Done
              </button>
              <button className="secondary-btn big-btn" onClick={() => setShowImpactModal(true)}>
                See my impact
              </button>
            </div>
          )}

          {/* Report Fullness Screen */}
          {currentScreen === 'reportFullness' && (
            <div className="screen">
              <div className="screen-heading">
                <div className="screen-title-large">How full is the bin?</div>
                <div className="screen-subtitle">Help us know when to empty bins</div>
              </div>

              <div className="fullness-grid">
                {['Empty', '1/4 Full', 'Half Full', '3/4 Full', 'Full', 'Overflowing'].map(level => (
                  <div
                    key={level}
                    className={`fullness-card ${selectedFullness === level ? 'selected' : ''}`}
                    onClick={() => setSelectedFullness(level)}
                  >
                    <div className="fullness-bin-visual"></div>
                    <div className="fullness-label">{level}</div>
                  </div>
                ))}
              </div>

              <button
                className="primary-btn big-btn"
                onClick={handleSubmitFullness}
                disabled={!selectedFullness}
              >
                Submit
              </button>
            </div>
          )}

          {/* Nearby Bins Screen */}
          {currentScreen === 'nearbyBins' && (
            <div className="screen">
              <div className="filter-row">
                <div className="filter-pills">
                  {['all', 'compost', 'recycle', 'landfill'].map(filter => (
                    <button
                      key={filter}
                      className={`filter-pill ${binFilter === filter ? 'active' : ''}`}
                      onClick={() => setBinFilter(filter)}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={hideFullBins}
                    onChange={(e) => setHideFullBins(e.target.checked)}
                  />
                  Hide very full bins
                </label>
              </div>

              <div className="card map-card">
                <div className="map-title">
                  Campus Map
                  {userLocation && (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 'normal',
                      color: '#10b981',
                      marginLeft: 8
                    }}>
                      • Location enabled
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  <MapView
                    bins={filteredBins}
                    selectedBin={selectedBin}
                    onSelectBin={(bin) => {
                      handleInvestigateBin(bin);
                    }}
                    userLocation={userLocation}
                  />
                </div>
                <div className="map-legend">
                  <span><span className="legend-dot legend-good"></span>Good</span>
                  <span><span className="legend-dot legend-warning"></span>Warning</span>
                  <span><span className="legend-dot legend-critical"></span>Critical</span>
                </div>
              </div>

              <div className="bin-list">
                {filteredBins.length === 0 ? (
                  <div className="card" style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                    No bins found matching your filters
                  </div>
                ) : (
                  filteredBins.map(bin => (
                    <div
                      key={bin._id}
                      className="card bin-card"
                      onClick={() => handleInvestigateBin(bin)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="bin-card-main">
                        <div className="bin-fullness-visual">
                          <div className="fullness-bar">
                            <div
                              className="fullness-fill"
                              style={{ width: `${bin.fullness}%` }}
                            ></div>
                          </div>
                          <span className={`status-badge status-${bin.level?.toLowerCase()}`}>
                            {bin.level}
                          </span>
                        </div>
                        <div className="bin-text">
                          <div className="bin-name">{bin.name}</div>
                          <div className="bin-streams">
                            {bin.streams?.includes('compost') && <span className="stream-chip">🌱</span>}
                            {bin.streams?.includes('recycle') && <span className="stream-chip">♻️</span>}
                            {bin.streams?.includes('landfill') && <span className="stream-chip">🗑️</span>}
                          </div>
                          {/* UPDATED: Better distance display */}
                          {bin.distance != null ? (
                            <div className="bin-distance">
                              📍 {bin.distance < 1000
                                ? `${Math.round(bin.distance)}m away`
                                : `${(bin.distance / 1000).toFixed(1)}km away`
                              }
                            </div>
                          ) : userLocation ? (
                            <div className="bin-distance" style={{ color: '#9ca3af' }}>
                              Distance unavailable
                            </div>
                          ) : (
                            <div className="bin-distance" style={{ color: '#9ca3af' }}>
                              Enable location to see distance
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="bin-actions">
                        <button
                          className="secondary-btn small-btn"
                          onClick={() => handleInvestigateBin(bin)}
                        >
                          Investigate
                        </button>
                        <button
                          className="primary-btn small-btn"
                          onClick={(e) => {
                            e.stopPropagation();      // prevent card onClick from firing
                            handleUseBin(bin);
                          }}
                        >
                          Use This Bin
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Admin Dashboard */}
          {currentScreen === 'adminDashboard' && (
            <div className="screen">
              <div className="admin-tabs">
                <button
                  className={`tab-button ${adminTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setAdminTab('overview')}
                >
                  Overview
                </button>
                <button
                  className={`tab-button ${adminTab === 'map' ? 'active' : ''}`}
                  onClick={() => setAdminTab('map')}
                >
                  Map
                </button>
                <button
                  className={`tab-button ${adminTab === 'bins' ? 'active' : ''}`}
                  onClick={() => setAdminTab('bins')}
                >
                  Bins
                </button>
                <button
                  className={`tab-button ${adminTab === 'addBin' ? 'active' : ''}`}
                  onClick={() => {
                    setAdminTab('addBin');
                    setNewBinError('');
                    setCurrentScreen('adminAddBin');
                  }}
                >
                  Add Bin
                </button>
              </div>

              {/* Overview Tab */}
              {adminTab === 'overview' && (
                <div className="overview-grid">
                  {overviewStats.filter(stat => stat.statId != "avgContamination").map(stat => (
                    <div key={stat.statId} className="card overview-card">
                      <div className="overview-label">{stat.label}</div>
                      <div className="overview-value">
                        {stat.statId === 'avgContamination' ? `${stat.value}%` : stat.value}
                      </div>
                      <div className="overview-delta">{stat.delta}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Map Tab */}
              {currentScreen === 'adminDashboard' && adminTab === 'map' && (
                <div className="card admin-map-card">
                  <div className="admin-map-controls">
                    <select>
                      <option>Last 24h</option>
                      <option>Last 7 days</option>
                      <option>Last 30 days</option>
                    </select>
                    <select>
                      <option>Color by: Fill</option>
                      <option>Color by: Contamination</option>
                    </select>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <MapView
                      bins={nearbyBins}
                      selectedBin={selectedBin}
                      onSelectBin={(b) => {
                        setSelectedBin(b);
                        handleInvestigateBin(b);
                      }}
                      height={360}
                      userLocation={userLocation}
                    />
                  </div>
                  <div className="admin-map-legend map-legend">
                    <span><span className="legend-dot legend-good"></span>Good</span>
                    <span><span className="legend-dot legend-warning"></span>Warning</span>
                    <span><span className="legend-dot legend-critical"></span>Critical</span>
                  </div>
                </div>
              )}

              {/* Graphs Tab */}
              {adminTab === 'graphs' && (
                <div className="graphs-grid">
                  <div className="card graph-card">
                    <div className="graph-title">Composition by Location</div>
                    <div className="graph-placeholder">
                      Stacked bar chart showing waste composition across different campus locations
                    </div>
                  </div>
                </div>
              )}

              {/* Bins Tab */}
              {adminTab === 'bins' && (
                <div className="problem-bins-list">
                  {/* Filter Button */}
                  <div className="filter-row problem-bins-filter-row">                    <button
                    className={`filter-pill ${!filterFullBins ? 'active' : ''}`}
                    onClick={() => setFilterFullBins(false)}
                  >
                    All Bins
                  </button>
                    <button
                      className={`filter-pill ${filterFullBins ? 'active' : ''}`}
                      onClick={() => setFilterFullBins(true)}
                    >
                      Full Bins Only
                    </button>
                  </div>

                  {/* Bin List */}
                  {displayedBins.map(bin => (
                    <div key={bin._id} className="card problem-bin-card">
                      <div className="problem-bin-main">
                        <div className="problem-bin-name">{bin.name}</div>
                        <div className="problem-bin-fullness">
                          Fullness: {bin.fullness}%
                        </div>
                      </div>
                      <button
                        className="secondary-btn small-btn"
                        onClick={() => handleInvestigateBin(bin)}
                      >
                        Investigate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admin Add Bin Screen */}
          {currentScreen === 'adminAddBin' && (
            <div className="screen">
              <div className="screen-heading">
                <div className="screen-title-large">
                  🗑️ Add New Bin
                </div>
                <div className="screen-subtitle">
                  Enter details for the new bin on campus
                </div>
              </div>

              {newBinError && (
                <div className="error-text form-error">
                  {newBinError}
                </div>
              )}

              <form className="card form-card" onSubmit={handleCreateBinSubmit}>
                <div className="form-section-title">Basic info</div>

                <div className="form-field">
                  <label>Bin Name <span className="label-required">*</span></label>
                  <input
                    type="text"
                    value={newBinData.name}
                    onChange={e => setNewBinData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Royce Quad Bin 1"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Facility ID</label>
                  <input
                    type="text"
                    value={newBinData.facilityId}
                    onChange={e => setNewBinData(prev => ({ ...prev, facilityId: e.target.value }))}
                    placeholder="e.g., UCLA-ROYCE-001"
                  />
                </div>

                <div className="form-field">
                  <label>QR Code</label>
                  <input
                    type="text"
                    value={newBinData.qrCode}
                    onChange={e => setNewBinData(prev => ({ ...prev, qrCode: e.target.value }))}
                    placeholder="e.g., QR-ROYCE-001"
                  />
                </div>

                <div className="form-section-title">Location</div>

                <div className="form-field">
                  <label>Location description</label>
                  <input
                    type="text"
                    value={newBinData.location}
                    onChange={e => setNewBinData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Royce Quad - North Path"
                  />
                </div>

                <div className="form-two-col">
                  <div className="form-field">
                    <label>Building</label>
                    <input
                      type="text"
                      value={newBinData.building}
                      onChange={e => setNewBinData(prev => ({ ...prev, building: e.target.value }))}
                      placeholder="e.g., Royce Hall"
                    />
                  </div>
                  <div className="form-field">
                    <label>Floor</label>
                    <input
                      type="text"
                      value={newBinData.floor}
                      onChange={e => setNewBinData(prev => ({ ...prev, floor: e.target.value }))}
                      placeholder="e.g., Ground"
                    />
                  </div>
                </div>

                <div className="form-two-col">
                  <div className="form-field">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={newBinData.latitude ?? ''}
                      onChange={e => setNewBinData(prev => ({ ...prev, latitude: e.target.value }))}
                      placeholder="e.g., 34.0689"
                    />
                  </div>
                  <div className="form-field">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={newBinData.longitude ?? ''}
                      onChange={e => setNewBinData(prev => ({ ...prev, longitude: e.target.value }))}
                      placeholder="e.g., -118.4452"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <button
                    type="button"
                    className="secondary-btn small-btn"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        setNewBinError('Geolocation not supported in this browser.');
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setNewBinData(prev => ({
                            ...prev,
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                          }));
                        },
                        (err) => setNewBinError('Could not get current location: ' + err.message),
                        { timeout: 10000 }
                      );
                    }}
                  >
                    Use my location
                  </button>
                  <div style={{ color: '#666', fontSize: 13 }}>Or enter coordinates manually</div>
                </div>

                <div className="form-section-title">Streams</div>

                <div className="form-field">
                  <label>Bin streams</label>
                  <div className="chip-row">
                    {['compost', 'recycle', 'landfill'].map(stream => (
                      <button
                        key={stream}
                        type="button"
                        className={
                          'filter-pill stream-pill ' +
                          (newBinData.streams.includes(stream) ? 'active' : '')
                        }
                        onClick={() => toggleStream(stream)}
                      >
                        <span className="stream-pill-icon">
                          {stream === 'compost' && '🌱'}
                          {stream === 'recycle' && '♻️'}
                          {stream === 'landfill' && '🗑️'}
                        </span>
                        <span>
                          {stream.charAt(0).toUpperCase() + stream.slice(1)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="field-hint">
                    Choose which waste streams this station supports
                  </div>
                </div>

                <div className="form-section-title">Notes</div>

                <div className="form-field">
                  <label>Description</label>
                  <textarea
                    value={newBinData.description}
                    onChange={e => setNewBinData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional notes about this bin (e.g., near main stairs, high-traffic area)"
                    rows={3}
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setCurrentScreen('adminDashboard')}
                    disabled={newBinLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={newBinLoading}
                  >
                    {newBinLoading ? 'Creating…' : 'Create Bin'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Bin Detail Screen */}
          {currentScreen === 'binDetail' && selectedBin && (
            <div className="screen">
              <button
                className="link-row back-link"
                onClick={() => {
                  setCurrentScreen('adminDashboard');
                  setAdminTab('bins');
                }}
              >
                ← Back to Dashboard
              </button>

              <div className="card">
                <div className="bin-detail-header">
                  <div>
                    <div className="bin-detail-title">{selectedBin.name}</div>
                    <div className="bin-detail-meta">{selectedBin.location}</div>
                  </div>
                  <div className="bin-detail-qr">
                    <div className="bin-detail-qr-box">QR</div>
                    <div className="bin-detail-meta">{selectedBin.qrCode}</div>
                  </div>
                </div>
              </div>

              <div className="card bin-detail-location-card">
                <div className="map-title">Location</div>
                <div style={{ width: '100%', height: 240 }}>
                  <MapView
                    bins={[selectedBin]}
                    selectedBin={selectedBin}
                    height={240}
                    userLocation={userLocation}
                  />
                </div>
              </div>

              <div className="card">
                <div className="map-title">Statistics</div>
                <div className="bin-detail-stats-grid">
                  <div className="bin-detail-stat-card">
                    <div className="stat-label">Fullness</div>
                    <div className="stat-value">{selectedBin.fullness}%</div>
                    <div className="stat-note">Current level</div>
                  </div>
                  <div className="bin-detail-stat-card">
                    <div className="stat-label">Status</div>
                    <div className="stat-value">{selectedBin.level}</div>
                    <div className="stat-note">Bin condition</div>
                  </div>
                  <div className="bin-detail-stat-card">
                    <div className="stat-label">Streams</div>
                    <div className="stat-value">
                      {selectedBin.streams?.map((stream) => (
                        <span key={stream} className="chip">{stream}</span>
                      ))}
                    </div>
                    <div className="stat-note">Supported waste types</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Impact Modal */}
        {showImpactModal && (
          <div className="modal-backdrop" onClick={() => setShowImpactModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Your Impact</div>
                <button
                  className="icon-button"
                  onClick={() => setShowImpactModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="impact-circle"></div>

              <div className="impact-stats-row">
                <div className="impact-stat">
                  <div className="impact-value compost">{studentImpact.compost}</div>
                  <div className="impact-label">Compost</div>
                </div>
                <div className="impact-stat">
                  <div className="impact-value recycle">{studentImpact.recycle}</div>
                  <div className="impact-label">Recycle</div>
                </div>
                <div className="impact-stat">
                  <div className="impact-value landfill">{studentImpact.landfill}</div>
                  <div className="impact-label">Landfill</div>
                </div>
              </div>

              <div className="impact-summary">
                You've diverted {studentImpact.compost + studentImpact.recycle} items from landfill
              </div>

              <button
                className="primary-btn big-btn"
                onClick={() => setShowImpactModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
