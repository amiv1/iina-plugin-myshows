/**
 * Global entry point (runs once, shared across all player instances).
 *
 * Bootstraps authentication on startup and routes inter-process messages
 * from player instances to the appropriate search and mark-watched handlers.
 *
 * Message protocol (received from player instances via `globalAPI.postMessage`):
 * - `MSG_SEARCH_FILE` `{ filename }` — find episode by filename
 * - `MSG_MARK_WATCHED` `{ episodeId }` — mark episode as watched
 *
 * Message protocol (sent to player instances):
 * - `MSG_EPISODE_FOUND` `{ episodeId }` — episode successfully identified
 * - `MSG_EPISODE_NOT_FOUND` `{}` — episode could not be identified
 * - `MSG_MARK_RESULT` `{ success }` — result of the mark-watched call
 */
export { };

import { searchByFile, markWatched } from "./search";
import { MSG_SEARCH_FILE, MSG_MARK_WATCHED } from "./messages";

const { global: globalAPI } = iina;

globalAPI.onMessage(MSG_SEARCH_FILE, (data, player) => {
    if (player) searchByFile(data.filename as string, player);
});

globalAPI.onMessage(MSG_MARK_WATCHED, (data, player) => {
    if (player) markWatched(data.episodeId as number, player);
});

