const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:5001' : '');

async function handleResponse(response) {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.message) {
        message = data.message;
      }
    } catch (e) {
      // If JSON parsing fails, try to get text
      try {
        const text = await response.text();
        if (text) {
          message = text.substring(0, 100); // Limit error message length
        }
      } catch (textError) {
        // Use default message
      }
    }
    throw new Error(message);
  }
  return response.json();
}

// Add timeout to requests
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server may be down');
    }
    throw error;
  }
}

export async function fetchCurrentStation() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/station/current`);
  return handleResponse(res);
}

export async function fetchNearbyBins(latitude = null, longitude = null, radius = 5000) {
  let url = `${API_BASE_URL}/api/bins/nearby`;

  if (latitude !== null && longitude !== null) {
    url += `?latitude=${latitude}&longitude=${longitude}&radius=${radius}`;
  }

  const res = await fetchWithTimeout(url);
  return handleResponse(res);
}

export async function fetchOverviewStats() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/admin/overview`);
  return handleResponse(res);
}

export async function fetchProblemBins() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/admin/problem-bins`);
  return handleResponse(res);
}

export async function fetchStudentImpact() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/student/impact`);
  return handleResponse(res);
}

export async function runSegmentationOnImage(fileOrBase64) {
  const body = fileOrBase64 ? { image: fileOrBase64 } : {};
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/segment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return handleResponse(res);
}

// Bin
export async function reportBinFullness(binId, level) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/bins/report-fullness`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ binId, level })
  });
  return handleResponse(res);
}

export async function createBin(binData) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/bin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(binData)
  });
  return handleResponse(res);
}


export async function updateStudentImpact(items) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/student/impact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ items })
  });
  return handleResponse(res);
}

// Test connection function
export async function testConnection() {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/health`, {}, 5000);
    return await res.json();
  } catch (error) {
    console.error('API connection test failed:', error);
    return { status: 'error', message: error.message };
  }
}

const api = {
  fetchCurrentStation,
  fetchNearbyBins,
  fetchOverviewStats,
  fetchProblemBins,
  fetchStudentImpact,
  runSegmentationOnImage,
  reportBinFullness,
  updateStudentImpact,
  testConnection,
  createBin
};

export default api;
