import React, { useEffect, useRef, useState } from 'react';

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // toggles front/back for phones
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [facingMode]);

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
      setError('Unable to access camera. Make sure permissions are allowed or try a different browser/device.');
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
    onCapture && onCapture(imgBase64);
    stopCamera();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        borderRadius: 14,
        overflow: 'hidden',
        background: '#000',
        height: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {error ? (
          <div style={{ padding: 16, color: '#fff', textAlign: 'center' }}>{error}</div>
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

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="primary-btn big-btn" onClick={handleCapture} disabled={!!error || loading}>
          Capture
        </button>
        <button className="secondary-btn big-btn" onClick={() => { stopCamera(); onCancel && onCancel(); }}>
          Cancel
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="link-button" onClick={toggleFacing}>
          Flip camera
        </button>
        {loading && <div style={{ color: '#6b7280' }}>Starting camera…</div>}
      </div>
    </div>
  );
}