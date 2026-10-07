// localStorage persistence with graceful fallback when storage is unavailable
// (private browsing, blocked storage, etc.). Falls back to in-memory only.

import { CONFIG } from "../data/config.js";
import { S, createDefaultState, assignState, events } from "./gameState.js";
import { deepMerge } from "../utils/utils.js";

let storageOk = true;
try {
  const probe = "__tideline_probe__";
  localStorage.setItem(probe, "1");
  localStorage.removeItem(probe);
} catch {
  storageOk = false;
}

export function hasSave() {
  if (!storageOk) return false;
  try {
    return localStorage.getItem(CONFIG.saveKey) !== null;
  } catch {
    return false;
  }
}

export function saveGame() {
  if (!storageOk) return false;
  try {
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(S));
    events.emit("save:done");
    return true;
  } catch {
    return false;
  }
}

/** Loads the save (if any) into S, merged over defaults. Returns true if loaded. */
export function loadGame() {
  if (!storageOk) return false;
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    assignState(deepMerge(createDefaultState(), parsed));
    return true;
  } catch {
    return false;
  }
}

const EXPORT_TAG = "tideline-save";

/** Serializes the current state into a downloadable save-file string. */
export function exportSave() {
  return JSON.stringify(
    { game: EXPORT_TAG, exportedAt: new Date().toISOString(), data: S },
    null,
    2
  );
}

/**
 * Replaces the current state with a save file's contents (merged over
 * defaults). Accepts the wrapped export format or a bare state object.
 * Returns { ok: true } or { ok: false, error }.
 */
export function importSave(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const data = parsed && parsed.game === EXPORT_TAG ? parsed.data : parsed;
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (!isObj(data) || !isObj(data.profile) || !isObj(data.gear) || !isObj(data.world)) {
    return { ok: false, error: "That doesn't look like a Tideline save file." };
  }
  const { money, xp, level } = data.profile;
  if (![money, xp, level].every((n) => Number.isFinite(n) && n >= 0)) {
    return { ok: false, error: "Save file has invalid profile values." };
  }
  assignState(deepMerge(createDefaultState(), data));
  saveGame();
  return { ok: true };
}

export function resetSave() {
  if (storageOk) {
    try {
      localStorage.removeItem(CONFIG.saveKey);
    } catch {
      /* storage may be blocked; in-memory reset still proceeds */
    }
  }
  assignState(createDefaultState());
}
