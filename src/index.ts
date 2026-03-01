/**
 * Player entry point (runs once per player instance).
 *
 * Handles per-player concerns: detecting when a video file is loaded,
 * filtering out non-video files, monitoring watch progress, and displaying
 * OSD feedback to the user.
 *
 * On file load, the filename is sent to the global script via `MSG_SEARCH_FILE`.
 * If an episode is identified, a polling interval checks playback position
 * every 5 seconds and sends `MSG_MARK_WATCHED` once the configured threshold
 * (preference: `myshows_watched_threshold`, default 70%) is reached.
 *
 * Message protocol (received from global script):
 * - `MSG_EPISODE_FOUND` `{ episodeId }` — start progress monitoring
 * - `MSG_EPISODE_NOT_FOUND` `{}` — no episode identified, do nothing
 * - `MSG_MARK_RESULT` `{ success }` — show OSD confirmation or log error
 */
export { };

import {
  MSG_SEARCH_FILE,
  MSG_MARK_WATCHED,
  MSG_EPISODE_FOUND,
  MSG_EPISODE_NOT_FOUND,
  MSG_MARK_RESULT,
} from "./messages";
import { t } from "./i18n";

const { console, event, core, preferences, global: globalAPI } = iina;

/** File extensions treated as video files. Audio and other formats are skipped. */
const VIDEO_EXTENSIONS = new Set([
  "mkv", "mp4", "avi", "mov", "wmv", "flv", "m4v",
  "ts", "m2ts", "webm", "mpg", "mpeg", "rmvb", "3gp",
]);

/**
 * Returns `true` if the filename should be processed for episode identification.
 * Rejects files with no meaningful name (< 5 chars) and non-video extensions.
 *
 * @param filename - The bare filename (no path) to check.
 */
export function isVideoFile(filename: string): boolean {
  if (filename.length < 5) return false;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.has(ext);
}

/** MyShows episode ID for the currently playing file, or `null` if not identified. */
let currentEpisodeId: number | null = null;

/** Whether the current episode has already been marked as watched this session. */
let watchedMarked = false;

/** Handle for the active progress polling interval, or `null` when not running. */
let progressInterval: ReturnType<typeof setInterval> | null = null;

/** Stops the progress polling interval if one is running. */
function clearProgressInterval(): void {
  if (progressInterval !== null) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

/** Resets all per-file state. Called when a new file is loaded or the window closes. */
function resetState(): void {
  clearProgressInterval();
  currentEpisodeId = null;
  watchedMarked = false;
}

/**
 * Starts polling playback position.
 * Once progress reaches the configured threshold and the episode has not yet
 * been marked, sends `MSG_MARK_WATCHED` to the global script and stops polling.
 */
function startProgressMonitor(): void {
  clearProgressInterval();
  progressInterval = setInterval(() => {

    const position = core.status.position;
    const duration = core.status.duration;
    if (!duration || duration <= 0 || !position || position <= 0) return;

    if (core.status.paused) {
      console.log("Playback paused");
      return;
    }

    const progress = (position / duration) * 100;
    const threshold = (preferences.get("myshows_watched_threshold") as number) ?? 70;

    console.log(`Watch progress: ${Math.round(progress)}%, threshold: ${threshold}%`);

    if (progress >= threshold && !watchedMarked && currentEpisodeId !== null) {
      watchedMarked = true;
      clearProgressInterval();
      globalAPI.postMessage(MSG_MARK_WATCHED, { episodeId: currentEpisodeId });
    }
  }, 5000);
}

// When a new file is loaded, reset state and send the filename to the global
// script for episode identification. Non-video files and very short names are skipped.
event.on("iina.file-loaded", () => {
  resetState();

  const url = core.status.url ?? "";
  const filename = url.split("/").pop() ?? url;

  if (!isVideoFile(filename)) return;

  console.log(`searchByFile: file="${filename}"`);
  globalAPI.postMessage(MSG_SEARCH_FILE, { filename });
});

// Clean up when the player window is closed to prevent stale intervals.
event.on("iina.window-did-close", () => {
  resetState();
});

// Received when the global script successfully identifies an episode.
globalAPI.onMessage(MSG_EPISODE_FOUND, (data) => {
  currentEpisodeId = data.episodeId as number;
  console.log(`Episode found: id=${currentEpisodeId}`);
  startProgressMonitor();
});

globalAPI.onMessage(MSG_EPISODE_NOT_FOUND, () => {
  // No episode found for this file — silently do nothing.
});

// Received after a mark-watched attempt; show OSD confirmation on success if enabled.
globalAPI.onMessage(MSG_MARK_RESULT, (data) => {
  if (data.success) {
    const showOsd = (preferences.get("myshows_show_watched_osd") as boolean) ?? true;
    if (showOsd) core.osd(t("markedAsWatched"));
    console.log("Episode marked as watched");
  } else {
    core.osd(t("failedToMark"));
    console.error("Failed to mark episode as watched");
  }
});
