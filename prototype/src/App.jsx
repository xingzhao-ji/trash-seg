import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchCurrentStation,
  fetchNearbyBins,
  fetchOverviewStats,
  fetchProblemBins,
  fetchStudentImpact,
  runSegmentationOnImage,
  reportBinFullness
} from './api';

const STUDENT_HOME = 'home';
const STUDENT_CAMERA = 'camera';
const STUDENT_RESULTS = 'results';
const STUDENT_SUCCESS = 'success';
const STUDENT_REPORT = 'report';
const STUDENT_NEARBY = 'nearby';

const ADMIN_TAB_OVERVIEW = 'overview';
const ADMIN_TAB_MAP = 'map';
const ADMIN_TAB_GRAPHS = 'graphs';
const ADMIN_TAB_PROBLEMS = 'problems';
const ADMIN_TAB_BIN_DETAIL = 'binDetail';

function getFullnessStatus(fullness) {
  if (fullness >= 90) {
    return { label: 'Critical', className: 'status-critical' };
  }
  if (fullness >= 70) {
    return { label: 'Warning', className: 'status-warning' };
  }
  return { label: 'Good', className: 'status-good' };
}

function groupItemsByStream(items) {
  const groups = {
    compost: [],
    recycle: [],
    landfill: []
  };
  items.forEach((item) => {
    if (groups[item.stream]) {
      groups[item.stream].push(item);
    }
  });
  return groups;
}

function App() {
  const [currentView, setCurrentView] = useState('student');
  const [studentScreen, setStudentScreen] = useState(STUDENT_HOME);
  const [adminTab, setAdminTab] = useState(ADMIN_TAB_OVERVIEW);

  const [station, setStation] = useState(null);
  const [nearbyBins, setNearbyBins] = useState([]);
  const [overviewStats, setOverviewStats] = useState([]);
  const [problemBins, setProblemBins] = useState([]);
  const [studentImpact, setStudentImpact] = useState(null);

  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  const [segmentationItems, setSegmentationItems] = useState([]);
  const [segmentationLoading, setSegmentationLoading] = useState(false);
  const [segmentationError, setSegmentationError] = useState(null);

  const [selectedFullnessLevel, setSelectedFullnessLevel] = useState(null);
  const [fullnessSubmitting, setFullnessSubmitting] = useState(false);
  const [fullnessSuccess, setFullnessSuccess] = useState(false);

  const [showImpactModal, setShowImpactModal] = useState(false);

  const [hideVeryFullBins, setHideVeryFullBins] = useState(false);
  const [binFilterStream, setBinFilterStream] = useState('all');

  const [selectedProblemBin, setSelectedProblemBin] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setGlobalError(null);
    try {
      const results = await Promise.allSettled([
        fetchCurrentStation(),
        fetchNearbyBins(),
        fetchOverviewStats(),
        fetchProblemBins(),
        fetchStudentImpact()
      ]);

      if (results[0].status === 'fulfilled') {
        setStation(results[0].value);
      }
      if (results[1].status === 'fulfilled') {
        setNearbyBins(results[1].value);
      }
      if (results[2].status === 'fulfilled') {
        setOverviewStats(results[2].value);
      }
      if (results[3].status === 'fulfilled') {
        setProblemBins(results[3].value);
      }
      if (results[4].status === 'fulfilled') {
        setStudentImpact(results[4].value);
      }

      if (results.some((r) => r.status === 'rejected')) {
        setGlobalError('Failed to load prototype data.');
        console.error('Some initial data failed to load', results);
      }
    } catch (err) {
      console.error('Unexpected error loading initial data', err);
      setGlobalError('Failed to load prototype data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (fullnessSuccess) {
      const t = setTimeout(() => setFullnessSuccess(false), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [fullnessSuccess]);

  async function handleUseExampleResults() {
    setSegmentationLoading(true);
    setSegmentationError(null);
    try {
      const items = await runSegmentationOnImage(null);
      setSegmentationItems(items);
      setStudentScreen(STUDENT_RESULTS);
    } catch (err) {
      console.error('Segmentation failed', err);
      setSegmentationError('Failed to get example results.');
    } finally {
      setSegmentationLoading(false);
    }
  }

  async function handleSubmitFullness() {
    if (!selectedFullnessLevel || !station) {
      return;
    }
    setFullnessSubmitting(true);
    try {
      await reportBinFullness(station._id, selectedFullnessLevel);
      setFullnessSubmitting(false);
      setFullnessSuccess(true);
      setSelectedFullnessLevel(null);
      setStudentScreen(STUDENT_HOME);
    } catch (err) {
      console.error('Failed to submit bin fullness', err);
      setGlobalError('Failed to submit bin fullness.');
      setFullnessSubmitting(false);
    }
  }

  const streamGroups = useMemo(
    () => groupItemsByStream(segmentationItems),
    [segmentationItems]
  );
  const totalSegmentationCount = segmentationItems.length;

  const filteredBins = useMemo(
    () =>
      nearbyBins.filter((bin) => {
        if (binFilterStream !== 'all') {
          if (!bin.streams || !bin.streams.includes(binFilterStream)) {
            return false;
          }
        }
        if (hideVeryFullBins && typeof bin.fullness === 'number') {
          if (bin.fullness >= 90) {
            return false;
          }
        }
        return true;
      }),
    [nearbyBins, binFilterStream, hideVeryFullBins]
  );

  function handleInvestigateBin(bin) {
    setSelectedProblemBin(bin);
    setAdminTab(ADMIN_TAB_BIN_DETAIL);
  }

  function headerTitle() {
    if (currentView === 'admin') {
      return 'Admin Dashboard';
    }
    if (!station) {
      return 'Current Station';
    }
    return station.shortName || station.name;
  }

  return (
    <div className="app-root">
      <div className="app-container">
        <header className="app-header">
          <div className="app-header-left">
            {studentScreen !== STUDENT_HOME && currentView === 'student' ? (
              <button
                className="back-button"
                onClick={() => {
                  if (studentScreen === STUDENT_CAMERA || studentScreen === STUDENT_REPORT || studentScreen === STUDENT_NEARBY) {
                    setStudentScreen(STUDENT_HOME);
                  } else if (studentScreen === STUDENT_RESULTS) {
                    setStudentScreen(STUDENT_CAMERA);
                  } else if (studentScreen === STUDENT_SUCCESS) {
                    setStudentScreen(STUDENT_HOME);
                  }
                }}
              >
                ←
              </button>
            ) : null}
            <div className="app-title">{headerTitle()}</div>
          </div>
          <div className="view-toggle">
            <button
              className={`toggle-pill ${currentView === 'student' ? 'active' : ''}`}
              onClick={() => setCurrentView('student')}
            >
              Student View
            </button>
            <button
              className={`toggle-pill ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentView('admin')}
            >
              Admin View
            </button>
          </div>
        </header>

        {globalError && (
          <div className="error-banner">
            <span>{globalError}</span>
            <button className="link-button" onClick={loadInitialData}>
              Retry
            </button>
          </div>
        )}

        <main className="app-main">
          {loading && !station && (
            <div className="loading-state">Loading prototype data…</div>
          )}

          {!loading && currentView === 'student' && (
            <>
              {studentScreen === STUDENT_HOME && (
                <StudentHome
                  station={station}
                  onSortItems={() => setStudentScreen(STUDENT_CAMERA)}
                  onReportFullness={() => setStudentScreen(STUDENT_REPORT)}
                  onNearbyBins={() => setStudentScreen(STUDENT_NEARBY)}
                  fullnessSuccess={fullnessSuccess}
                />
              )}

              {studentScreen === STUDENT_CAMERA && (
                <StudentCamera
                  station={station}
                  onCancel={() => setStudentScreen(STUDENT_HOME)}
                  onUseExampleResults={handleUseExampleResults}
                  loading={segmentationLoading}
                  error={segmentationError}
                />
              )}

              {studentScreen === STUDENT_RESULTS && (
                <StudentResults
                  station={station}
                  groups={streamGroups}
                  totalItems={totalSegmentationCount}
                  onDoneSorting={() => setStudentScreen(STUDENT_SUCCESS)}
                  onNotSure={() => {
                    alert(
                      'In the full app, this would show extra guidance for tricky items.'
                    );
                  }}
                />
              )}

              {studentScreen === STUDENT_SUCCESS && (
                <StudentSuccess
                  totalItems={totalSegmentationCount}
                  onDone={() => setStudentScreen(STUDENT_HOME)}
                  onSeeImpact={() => setShowImpactModal(true)}
                />
              )}

              {studentScreen === STUDENT_REPORT && (
                <StudentReportFullness
                  station={station}
                  selectedLevel={selectedFullnessLevel}
                  onSelectLevel={setSelectedFullnessLevel}
                  onSubmit={handleSubmitFullness}
                  submitting={fullnessSubmitting}
                />
              )}

              {studentScreen === STUDENT_NEARBY && (
                <StudentNearbyBins
                  bins={filteredBins}
                  rawBins={nearbyBins}
                  binFilterStream={binFilterStream}
                  onSetFilterStream={setBinFilterStream}
                  hideVeryFullBins={hideVeryFullBins}
                  onToggleHideVeryFullBins={() =>
                    setHideVeryFullBins((v) => !v)
                  }
                />
              )}
            </>
          )}

          {!loading && currentView === 'admin' && (
            <AdminDashboard
              overviewStats={overviewStats}
              problemBins={problemBins}
              activeTab={adminTab}
              onChangeTab={setAdminTab}
              selectedBin={selectedProblemBin}
              onInvestigateBin={handleInvestigateBin}
            />
          )}
        </main>

        {showImpactModal && (
          <ImpactModal
            impact={studentImpact}
            onClose={() => setShowImpactModal(false)}
          />
        )}
      </div>
    </div>
  );
}

function StudentHome({
  station,
  onSortItems,
  onReportFullness,
  onNearbyBins,
  fullnessSuccess
}) {
  return (
    <div className="screen">
      <section className="card station-card">
        <div className="station-icons">
          <span role="img" aria-label="compost">
            🌿
          </span>
          <span role="img" aria-label="recycle">
            🔄
          </span>
          <span role="img" aria-label="landfill">
            🗑️
          </span>
        </div>
        <div className="station-text">
          <div className="station-name">
            {station ? station.name : 'Loading station…'}
          </div>
          <div className="station-description">
            {station
              ? station.description ||
                'Compost / Recycle / Landfill station.'
              : 'Compost / Recycle / Landfill station.'}
          </div>
          {station && (
            <div className="station-qr">QR Code: {station.qrCode}</div>
          )}
        </div>
      </section>

      {fullnessSuccess && (
        <div className="toast success-toast">
          Thanks for reporting bin fullness!
        </div>
      )}

      <section className="actions-section">
        <button className="primary-btn big-btn" onClick={onSortItems}>
          <span className="btn-icon" role="img" aria-label="camera">
            📷
          </span>
          <span>Sort my items</span>
        </button>

        <button className="secondary-btn big-btn" onClick={onReportFullness}>
          <span className="btn-icon" role="img" aria-label="report">
            ⚠️
          </span>
          <span>Report bin fullness</span>
        </button>

        <button className="link-row" onClick={onNearbyBins}>
          <span>See nearby bins</span>
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <div className="footer-note">
        Help your campus reach zero waste by 2030.
      </div>
    </div>
  );
}

function StudentCamera({
  station,
  onCancel,
  onUseExampleResults,
  loading,
  error
}) {
  return (
    <div className="screen">
      <section className="card camera-card">
        <div className="camera-placeholder">
          <div className="camera-title">Camera preview placeholder</div>
          <p className="camera-subtitle">
            In the full app, you&apos;d point your phone at your tray and see
            items highlighted here.
          </p>
        </div>
      </section>

      {error && <div className="error-text">{error}</div>}

      <section className="actions-section">
        <button
          className="primary-btn big-btn"
          onClick={onUseExampleResults}
          disabled={loading}
        >
          {loading ? 'Loading example results…' : 'Use example results'}
        </button>
        <button className="secondary-btn big-btn" onClick={onCancel}>
          Cancel
        </button>
      </section>

      <div className="footer-note">
        Point your camera at your items to start sorting.
      </div>
    </div>
  );
}

function StudentResults({
  groups,
  totalItems,
  onDoneSorting,
  onNotSure
}) {
  function renderGroup(streamKey, title, description, icon) {
    const items = groups[streamKey] || [];
    if (items.length === 0) {
      return null;
    }

    return (
      <div className="stream-group" key={streamKey}>
        <div className="stream-header">
          <span className="stream-icon" aria-hidden="true">
            {icon}
          </span>
          <div>
            <div className="stream-title">{title}</div>
            <div className="stream-description">{description}</div>
          </div>
        </div>
        <div className="chip-row">
          {items.map((item) => (
            <div className="chip" key={item.id}>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <section className="card results-card">
        {totalItems === 0 ? (
          <p>No items detected yet. Try running example results again.</p>
        ) : (
          <>
            {renderGroup(
              'compost',
              'Compost',
              'Food scraps, napkins, plant material.',
              '🌿'
            )}
            {renderGroup(
              'recycle',
              'Recycle',
              'Bottles, cans, paper, cardboard.',
              '🔄'
            )}
            {renderGroup(
              'landfill',
              'Landfill',
              'Plastics, wrappers, mixed materials.',
              '🗑️'
            )}
          </>
        )}
      </section>

      <section className="actions-section">
        <button
          className="primary-btn big-btn"
          onClick={onDoneSorting}
          disabled={totalItems === 0}
        >
          Done sorting ({totalItems} item{totalItems === 1 ? '' : 's'})
        </button>
        <button className="link-row" onClick={onNotSure}>
          <span>Not sure about an item?</span>
        </button>
      </section>
    </div>
  );
}

function StudentSuccess({ totalItems, onDone, onSeeImpact }) {
  return (
    <div className="screen centered-screen">
      <section className="card success-card">
        <div className="bin-row">
          <div className="bin-icon bin-compost">
            <span>✓</span>
          </div>
          <div className="bin-icon bin-recycle">
            <span>✓</span>
          </div>
          <div className="bin-icon bin-landfill">
            <span>✓</span>
          </div>
        </div>
        <p className="success-message">
          Nice! You sorted {totalItems} item{totalItems === 1 ? '' : 's'} correctly.
        </p>
      </section>

      <section className="actions-section">
        <button className="primary-btn big-btn" onClick={onDone}>
          Done
        </button>
        <button className="secondary-btn big-btn" onClick={onSeeImpact}>
          See my impact
        </button>
      </section>
    </div>
  );
}

function StudentReportFullness({
  station,
  selectedLevel,
  onSelectLevel,
  onSubmit,
  submitting
}) {
  const levels = [
    'Empty',
    '1/4 Full',
    'Half Full',
    '3/4 Full',
    'Full',
    'Overflowing'
  ];

  return (
    <div className="screen">
      <div className="screen-heading">
        <div className="screen-title-large">
          Report Bin — {station ? station.shortName || station.name : 'Station'}
        </div>
        <div className="screen-subtitle">
          Select the current fullness level:
        </div>
      </div>

      <section className="fullness-grid">
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            className={`fullness-card ${
              selectedLevel === level ? 'selected' : ''
            }`}
            onClick={() => onSelectLevel(level)}
          >
            <div className="fullness-bin-visual" />
            <div className="fullness-label">{level}</div>
          </button>
        ))}
      </section>

      <section className="actions-section">
        <button
          className="primary-btn big-btn"
          disabled={!selectedLevel || submitting}
          onClick={onSubmit}
        >
          {submitting ? 'Submitting…' : 'Submit status'}
        </button>
      </section>
    </div>
  );
}

function StudentNearbyBins({
  bins,
  rawBins,
  binFilterStream,
  onSetFilterStream,
  hideVeryFullBins,
  onToggleHideVeryFullBins
}) {
  const hasAnyBins = rawBins && rawBins.length > 0;
  const activeBins = hasAnyBins ? bins : [];

  return (
    <div className="screen">
      <div className="screen-heading">
        <div className="screen-title-large">Nearby bins</div>
      </div>

      <div className="filter-row">
        <div className="filter-pills">
          <button
            className={`filter-pill ${binFilterStream === 'all' ? 'active' : ''}`}
            onClick={() => onSetFilterStream('all')}
          >
            All
          </button>
          <button
            className={`filter-pill ${
              binFilterStream === 'compost' ? 'active' : ''
            }`}
            onClick={() => onSetFilterStream('compost')}
          >
            🌿 Compost
          </button>
          <button
            className={`filter-pill ${
              binFilterStream === 'recycle' ? 'active' : ''
            }`}
            onClick={() => onSetFilterStream('recycle')}
          >
            🔄 Recycle
          </button>
          <button
            className={`filter-pill ${
              binFilterStream === 'landfill' ? 'active' : ''
            }`}
            onClick={() => onSetFilterStream('landfill')}
          >
            🗑️ Landfill
          </button>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={hideVeryFullBins}
            onChange={onToggleHideVeryFullBins}
          />
          <span>Hide very full bins</span>
        </label>
      </div>

      <section className="card map-card">
        <div className="map-title">Campus map (placeholder)</div>
        <p className="map-description">
          In the full app, this would show a live campus map with pins sized or
          colored by bin fullness and contamination.
        </p>
        <div className="map-legend">
          <span className="legend-dot legend-good" /> Good
          <span className="legend-dot legend-warning" /> Warning
          <span className="legend-dot legend-critical" /> Critical
        </div>
      </section>

      <section className="bin-list">
        {!hasAnyBins && (
          <div className="empty-state">
            No nearby bins available yet in the prototype data.
          </div>
        )}
        {hasAnyBins && activeBins.length === 0 && (
          <div className="empty-state">
            No bins match the current filters.
          </div>
        )}
        {activeBins.map((bin) => {
          const status = getFullnessStatus(bin.fullness || 0);
          return (
            <div className="card bin-card" key={bin._id}>
              <div className="bin-card-main">
                <div className="bin-fullness-visual">
                  <div className="fullness-bar">
                    <div
                      className="fullness-fill"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, bin.fullness || 0)
                        )}%`
                      }}
                    />
                  </div>
                  <div className={`status-badge ${status.className}`}>
                    {status.label}
                  </div>
                </div>
                <div className="bin-text">
                  <div className="bin-name">{bin.name}</div>
                  <div className="bin-streams">
                    {bin.streams?.includes('compost') && (
                      <span className="stream-chip">🌿</span>
                    )}
                    {bin.streams?.includes('recycle') && (
                      <span className="stream-chip">🔄</span>
                    )}
                    {bin.streams?.includes('landfill') && (
                      <span className="stream-chip">🗑️</span>
                    )}
                  </div>
                  <div className="bin-distance">
                    {typeof bin.distance === 'number'
                      ? `${bin.distance} m away`
                      : bin.distance}
                  </div>
                </div>
              </div>
              <div className="bin-nav">
                <span className="bin-nav-icon" aria-hidden="true">
                  ➤
                </span>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function AdminDashboard({
  overviewStats,
  problemBins,
  activeTab,
  onChangeTab,
  selectedBin,
  onInvestigateBin
}) {
  if (activeTab === ADMIN_TAB_BIN_DETAIL && selectedBin) {
    return (
      <AdminBinDetail
        bin={selectedBin}
        onBack={() => onChangeTab(ADMIN_TAB_PROBLEMS)}
      />
    );
  }

  return (
    <div className="screen">
      <div className="admin-tabs">
        <button
          className={`tab-button ${
            activeTab === ADMIN_TAB_OVERVIEW ? 'active' : ''
          }`}
          onClick={() => onChangeTab(ADMIN_TAB_OVERVIEW)}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === ADMIN_TAB_MAP ? 'active' : ''}`}
          onClick={() => onChangeTab(ADMIN_TAB_MAP)}
        >
          Map
        </button>
        <button
          className={`tab-button ${
            activeTab === ADMIN_TAB_GRAPHS ? 'active' : ''
          }`}
          onClick={() => onChangeTab(ADMIN_TAB_GRAPHS)}
        >
          Graphs/Stats
        </button>
        <button
          className={`tab-button ${
            activeTab === ADMIN_TAB_PROBLEMS ? 'active' : ''
          }`}
          onClick={() => onChangeTab(ADMIN_TAB_PROBLEMS)}
        >
          Problem Bins
        </button>
      </div>

      {activeTab === ADMIN_TAB_OVERVIEW && (
        <AdminOverviewTab stats={overviewStats} />
      )}
      {activeTab === ADMIN_TAB_MAP && <AdminMapTab />}
      {activeTab === ADMIN_TAB_GRAPHS && <AdminGraphsTab />}
      {activeTab === ADMIN_TAB_PROBLEMS && (
        <AdminProblemBinsTab
          problemBins={problemBins}
          onInvestigateBin={onInvestigateBin}
        />
      )}
    </div>
  );
}

function AdminOverviewTab({ stats }) {
  if (!stats || stats.length === 0) {
    return (
      <div className="empty-state">
        No overview stats available in the prototype data.
      </div>
    );
  }

  return (
    <section className="overview-grid">
      {stats.map((stat) => (
        <div className="card overview-card" key={stat.statId}>
          <div className="overview-label">{stat.label}</div>
          <div className="overview-value">{stat.value}</div>
          {stat.delta && <div className="overview-delta">{stat.delta}</div>}
        </div>
      ))}
    </section>
  );
}

function AdminMapTab() {
  const [range, setRange] = useState('7');
  const [colorBy, setColorBy] = useState('fill');

  return (
    <section className="card admin-map-card">
      <div className="admin-map-controls">
        <label>
          Time range:{' '}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </label>
        <label>
          Color by:{' '}
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value)}
          >
            <option value="fill">Fill</option>
            <option value="contamination">Contamination</option>
          </select>
        </label>
      </div>
      <div className="admin-map-placeholder">
        Campus map placeholder. Pins would be colored by {colorBy} over the last{' '}
        {range} day{range === '1' ? '' : 's'}.
      </div>
      <div className="map-legend admin-map-legend">
        <span className="legend-dot legend-good" /> Good
        <span className="legend-dot legend-warning" /> Warning
        <span className="legend-dot legend-critical" /> Critical
      </div>
    </section>
  );
}

function AdminGraphsTab() {
  return (
    <div className="graphs-grid">
      <section className="card graph-card">
        <div className="graph-title">Composition by Location</div>
        <div className="graph-placeholder">
          Placeholder stacked bar chart comparing compost, recycle, and landfill
          streams by location.
        </div>
      </section>
      <section className="card graph-card">
        <div className="graph-title">Contamination Trend</div>
        <div className="graph-placeholder">
          Placeholder line chart showing contamination percentage over time.
        </div>
      </section>
    </div>
  );
}

function AdminProblemBinsTab({ problemBins, onInvestigateBin }) {
  if (!problemBins || problemBins.length === 0) {
    return (
      <div className="empty-state">
        No problem bins available in the prototype data.
      </div>
    );
  }

  return (
    <section className="problem-bins-list">
      {problemBins.map((bin) => (
        <div className="card problem-bin-card" key={bin._id}>
          <div className="problem-bin-main">
            <div className="problem-bin-name">{bin.name}</div>
            <div className="problem-bin-contam">
              {bin.contamination.toFixed(1)}% contamination
            </div>
          </div>
          <button
            className="secondary-btn small-btn"
            onClick={() => onInvestigateBin(bin)}
          >
            Investigate
          </button>
        </div>
      ))}
    </section>
  );
}

function AdminBinDetail({ bin, onBack }) {
  return (
    <div className="screen">
      <button className="link-row back-link" onClick={onBack}>
        <span aria-hidden="true">←</span>
        <span>Back to Dashboard</span>
      </button>

      <section className="card bin-detail-header">
        <div className="bin-detail-title">{bin.name}</div>
        <div className="bin-detail-meta">
          <div className="bin-detail-location">📍 {bin.location}</div>
          <div className="bin-detail-qr">QR ID: {bin.qrCode}</div>
        </div>
        <div className="bin-detail-qr-box">
          <span>QR</span>
        </div>
      </section>

      <section className="card bin-detail-location-card">
        <div className="graph-title">Location</div>
        <div className="location-placeholder">
          Mini map / thumbnail placeholder with this bin highlighted.
        </div>
      </section>

      <section className="bin-detail-stats-grid">
        <div className="card bin-detail-stat-card">
          <div className="stat-label">Total scans</div>
          <div className="stat-value">{bin.totalScansToday}</div>
          <div className="stat-note">Today</div>
        </div>
        <div className="card bin-detail-stat-card">
          <div className="stat-label">Avg fill at scan</div>
          <div className="stat-value">{bin.avgFillLast7Days}%</div>
          <div className="stat-note">Last 7 days</div>
        </div>
        <div className="card bin-detail-stat-card">
          <div className="stat-label">Overflows</div>
          <div className="stat-value">{bin.overflowsThisMonth}</div>
          <div className="stat-note">This month</div>
        </div>
      </section>
    </div>
  );
}

function ImpactModal({ impact, onClose }) {
  const compost = impact?.compost ?? 0;
  const recycle = impact?.recycle ?? 0;
  const landfill = impact?.landfill ?? 0;
  const divertedFromLandfill = compost + recycle;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title">Your impact</div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="impact-circle" />
        <div className="impact-stats-row">
          <div className="impact-stat">
            <div className="impact-value compost">{compost}</div>
            <div className="impact-label">Compost</div>
          </div>
          <div className="impact-stat">
            <div className="impact-value recycle">{recycle}</div>
            <div className="impact-label">Recycle</div>
          </div>
          <div className="impact-stat">
            <div className="impact-value landfill">{landfill}</div>
            <div className="impact-label">Landfill</div>
          </div>
        </div>
        <p className="impact-summary">
          You&apos;ve diverted {divertedFromLandfill} items from landfill so far.
        </p>
        <button className="primary-btn big-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default App;
