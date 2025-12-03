import React, { useEffect, useRef, useState } from 'react';

export default function CameraCapture({
  onCapture,
  onCancel,
  onRetake,
  previewImage,
  statusMessage,
  roiPoints = [],
  onAddRoiPoint,
  onClearRoiPoints,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [loading, setLoading] = useState(true);

  const displayImage = previewImage || null;

  useEffect(() => {
    if (!displayImage) {
      startCamera();
      return stopCamera;
    }
  }, [facingMode, displayImage]);

  async function startCamera() {
    setError(null);
    setLoading(true);
    try {
      const constraints = { video: { facingMode } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera start error:', err);
      setError(
        'Unable to access camera. Make sure permissions are allowed or try a different browser/device.'
      );
    } finally {
      setLoading(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  function toggleFacing() {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  }

  function handleCapture() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgBase64 = canvas.toDataURL('image/jpeg', 0.9);
    onCapture && onCapture(imgBase64, { width: canvas.width, height: canvas.height });
    stopCamera();
  }

  function handleImageClick(event) {
    if (!displayImage || !onAddRoiPoint || loading) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onAddRoiPoint({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          background: '#000',
          height: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {error ? (
          <div style={{ padding: 16, color: '#fff', textAlign: 'center' }}>{error}</div>
        ) : displayImage ? (
          <div
            ref={wrapperRef}
            onClick={handleImageClick}
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              cursor: onAddRoiPoint ? 'crosshair' : 'default',
            }}
          >
            <img
              src={displayImage}
              alt="Captured preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none' }}
              draggable={false}
            />
            {roiPoints.map((pt, idx) => (
              <div
                key={`roi-${idx}`}
                style={{
                  position: 'absolute',
                  left: `${pt.x * 100}%`,
                  top: `${pt.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#3b82f6',
                  border: '2px solid #fff',
                  color: '#fff',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {idx + 1}
              </div>
            ))}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </>
        )}
      </div>

      {statusMessage && (
        <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>{statusMessage}</div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {displayImage ? (
          <>
            <button className="primary-btn big-btn" onClick={onRetake}>
              Retake
            </button>
            <button className="secondary-btn big-btn" onClick={onCancel}>
              Cancel
            </button>
            {onClearRoiPoints && roiPoints.length > 0 && (
              <button className="link-button" onClick={onClearRoiPoints}>
                Clear selections
              </button>
            )}
          </>
        ) : (
          <>
            <button
              className="primary-btn big-btn"
              onClick={handleCapture}
              disabled={!!error || loading}
            >
              Capture
            </button>
            <button className="secondary-btn big-btn" onClick={onCancel}>
              Cancel
            </button>
          </>
        )}
      </div>

      {!displayImage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="link-button" onClick={toggleFacing}>
            Flip camera
          </button>
          {loading && <div style={{ color: '#6b7280' }}>Starting camera…</div>}
        </div>
      )}
    </div>
  );
}