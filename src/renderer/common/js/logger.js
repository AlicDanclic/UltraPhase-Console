/**
 * @module logger
 * @description Shared renderer logger utility (placeholder).
 */

// TODO: extract common logging from log.js

export function createLogger(prefix) {
  return {
    info: (msg) => console.log(`[${prefix}] ${msg}`),
    error: (msg) => console.error(`[${prefix}] ${msg}`)
  };
}
