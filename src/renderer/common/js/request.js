/**
 * @module request
 * @description Shared HTTP request utility (placeholder).
 */

// TODO: extract HTTP request logic from bridge.js

export async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}
