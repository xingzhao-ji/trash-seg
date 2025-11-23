const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function handleResponse(response) {
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      if (data && data.message) {
        message = data.message;
      }
    } catch (e) {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return response.json();
}

export async function fetchCurrentStation() {
  const res = await fetch(`${API_BASE_URL}/api/station/current`);
  return handleResponse(res);
}

export async function fetchNearbyBins() {
  const res = await fetch(`${API_BASE_URL}/api/bins/nearby`);
  return handleResponse(res);
}

export async function fetchOverviewStats() {
  const res = await fetch(`${API_BASE_URL}/api/admin/overview`);
  return handleResponse(res);
}

export async function fetchProblemBins() {
  const res = await fetch(`${API_BASE_URL}/api/admin/problem-bins`);
  return handleResponse(res);
}

export async function fetchStudentImpact() {
  const res = await fetch(`${API_BASE_URL}/api/student/impact`);
  return handleResponse(res);
}

export async function runSegmentationOnImage(_file) {
  const res = await fetch(`${API_BASE_URL}/api/segment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  return handleResponse(res);
}

export async function reportBinFullness(stationId, level) {
  const res = await fetch(`${API_BASE_URL}/api/bins/report-fullness`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ stationId, level })
  });
  return handleResponse(res);
}

const api = {
  fetchCurrentStation,
  fetchNearbyBins,
  fetchOverviewStats,
  fetchProblemBins,
  fetchStudentImpact,
  runSegmentationOnImage,
  reportBinFullness
};

export default api;
