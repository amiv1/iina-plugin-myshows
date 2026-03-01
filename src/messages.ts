/**
 * Shared message name constants for global ↔ player inter-process communication.
 */

/** Sent by a player to the global script to look up an episode by filename. Payload: `{ filename }` */
export const MSG_SEARCH_FILE = "myshows.search-file";

/** Sent by a player to the global script to mark an episode as watched. Payload: `{ episodeId }` */
export const MSG_MARK_WATCHED = "myshows.mark-watched";

/** Sent by the global script to a player when an episode is identified. Payload: `{ episodeId }` */
export const MSG_EPISODE_FOUND = "myshows.episode-found";

/** Sent by the global script to a player when no episode could be identified. Payload: `{}` */
export const MSG_EPISODE_NOT_FOUND = "myshows.episode-not-found";

/** Sent by the global script to a player with the result of a mark-watched call. Payload: `{ success }` */
export const MSG_MARK_RESULT = "myshows.mark-result";
