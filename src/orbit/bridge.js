// The postMessage half of docs/orbit/bridge.md, frame side.

const SOURCE = "orbit-erd";
export const BRIDGE_VERSION = 2;
export const THEMES = new Set(["light", "dark"]);

/** Sends a frame-to-host message: ready, change, applied or error. */
export function postToHost(type, fields = {}) {
  window.parent.postMessage(
    { source: SOURCE, type, ...fields },
    window.location.origin,
  );
}

/** The host's message, or null for anything not from the Orbit page above us. */
export function readHostMessage(event) {
  if (event.origin !== window.location.origin) return null;
  if (event.source !== window.parent) return null;
  const message = event.data;
  if (!message || typeof message !== "object") return null;
  if (message.source !== SOURCE || typeof message.type !== "string") {
    return null;
  }
  return message;
}

/** `?mode=view` is the read-only share view; anything else edits. */
export function embedMode() {
  return new URLSearchParams(window.location.search).get("mode") === "view"
    ? "view"
    : "edit";
}
