import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Circle } from 'react-leaflet';

function MapFollower({ center, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat != null && center.lng != null) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
    }
  }, [center, map, zoom]);
  return null;
}

function FitBounds({ coords, userLocation }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length === 0) return;
    
    // Include user location in bounds if available
    const allCoords = userLocation 
      ? [...coords, { lat: userLocation.lat, lng: userLocation.lng }]
      : coords;
    
    if (allCoords.length === 1) {
      map.setView([allCoords[0].lat, allCoords[0].lng], 15, { animate: true });
      return;
    }
    const latLngs = allCoords.map(c => [c.lat, c.lng]);
    try {
      map.fitBounds(latLngs, { padding: [40, 40], maxZoom: 17 });
    } catch (e) {
      // Silently handle error
    }
  }, [coords, userLocation, map]);
  return null;
}

function colorForFullness(fullness = 0) {
  if (fullness >= 80) return '#e11d48';
  if (fullness >= 50) return '#f59e0b';
  return '#10b981';
}

function coordsFrom(bin) {
  if (!bin) return null;
  if (bin.latitude != null && bin.longitude != null) return { lat: bin.latitude, lng: bin.longitude };
  if (bin.lat != null && bin.lng != null) return { lat: bin.lat, lng: bin.lng };
  if (bin.location && bin.location.lat != null && bin.location.lng != null) return { lat: bin.location.lat, lng: bin.location.lng };
  return null;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function MapView({ bins = [], selectedBin = null, onSelectBin = () => {}, userLocation = null, height = 420 }) {
  const validCoords = bins.map(coordsFrom).filter(Boolean);

  const fallback = { lat: 34.0689, lng: -118.4452 };

  // Choose center: user location, selected bin, first valid coord, or fallback
  const defaultCenter = userLocation || (selectedBin ? coordsFrom(selectedBin) : null) || validCoords[0] || fallback;

  return (
    <div style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
      <MapContainer center={[defaultCenter.lat, defaultCenter.lng]} zoom={15} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />

        {/* Fit bounds when we have coords */}
        {validCoords.length > 0 && <FitBounds coords={validCoords} userLocation={userLocation} />}

        <MapFollower center={selectedBin ? coordsFrom(selectedBin) || defaultCenter : (userLocation || defaultCenter)} />

        {/* User location marker */}
        {userLocation && (
          <>
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={8}
              color="#2563eb"
              fillColor="#3b82f6"
              fillOpacity={1}
              weight={3}
            >
              <Popup>
                <div style={{ minWidth: 120 }}>
                  <strong>Your Location</strong>
                </div>
              </Popup>
            </CircleMarker>
            {/* Accuracy circle */}
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={userLocation.accuracy || 50}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 1
              }}
            />
          </>
        )}

        {/* Render bin markers */}
        {validCoords.length > 0
          ? bins.map(bin => {
              const c = coordsFrom(bin);
              if (!c) return null;
              const color = colorForFullness(bin.fullness);
              const key = bin._id || bin.id || `${c.lat}-${c.lng}`;

              return (
                <CircleMarker
                  key={key}
                  center={[c.lat, c.lng]}
                  radius={10}
                  color={color}
                  fillColor={color}
                  fillOpacity={0.85}
                  eventHandlers={{
                    click: (e) => {
                      e.originalEvent && e.originalEvent.stopPropagation();
                      onSelectBin(bin);
                    }
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <strong>{bin.name || 'Unknown bin'}</strong>
                      {bin.distance != null && (
                        <div style={{ fontSize: 12, marginTop: 4, color: '#6b7280' }}>
                          📍 {formatDistance(bin.distance)} away
                        </div>
                      )}
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        Fullness: {bin.fullness != null ? `${bin.fullness}%` : 'Unknown'}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        Streams: {Array.isArray(bin.streams) ? bin.streams.join(', ') : '—'}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button className="primary-btn small-btn" onClick={() => onSelectBin(bin)}>Inspect</button>
                        <button className="secondary-btn small-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Scan here</button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })
          : null}
      </MapContainer>
      
      {/* Location status indicator */}
      {userLocation && (
        <div style={{
          position: 'absolute',
          left: 12,
          top: 12,
          padding: '6px 10px',
          background: 'rgba(37, 99, 235, 0.95)',
          borderRadius: 6,
          color: 'white',
          fontSize: 12,
          fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span style={{ fontSize: 14 }}>📍</span>
          Location enabled
        </div>
      )}
      
      {/* Informational overlay when there are no bins */}
      {validCoords.length === 0 && (
        <div style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 8,
          color: '#333',
          fontSize: 13,
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
        }}>
          Showing campus map — no bin locations available
        </div>
      )}
    </div>
  );
}