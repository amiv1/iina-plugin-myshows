/**
 * Episode search and watch-marking module.
 *
 * Provides two strategies for resolving a video filename to a MyShows episode ID:
 *
 * 1. **Primary** — `shows.SearchByFile`: sends the raw filename to the MyShows API.
 * 2. **Fallback** — `shows.Search` + `shows.GetById`: parses the filename for a
 *    show name and S/E numbers, searches for the show, then looks up the episode
 *    within the full episode list.
 *
 * Results are delivered by posting messages to the requesting player instance:
 * `MSG_EPISODE_FOUND` with `{ episodeId }` on success, or `MSG_EPISODE_NOT_FOUND` otherwise.
 */

import { rpcCall } from "./api";
import { MSG_EPISODE_FOUND, MSG_EPISODE_NOT_FOUND, MSG_MARK_RESULT } from "./messages";

const { console, global: globalAPI } = iina;

/** Structured representation of a parsed video filename. */
interface ParsedFilename {
    showName: string;
    season: number;
    episode: number;
}

/**
 * Extracts show name, season, and episode numbers from a video filename.
 *
 * Supports two common naming conventions:
 * - `Show.Name.S01E02.mkv` (SxxExx)
 * - `Show.Name.1x02.mkv` (NxNN)
 *
 * @param filename - The video filename including extension.
 * @returns A `ParsedFilename` object, or `null` if no recognisable pattern is found.
 */
export function parseFilename(filename: string): ParsedFilename | null {
    const name = filename.replace(/\.[^.]+$/, "");

    const match =
        name.match(/^(.*?)[. _\-]+[Ss](\d{1,2})[Ee](\d{1,2})/i) ??
        name.match(/^(.*?)[. _\-]+(\d{1,2})[xX](\d{2})/);

    if (!match) return null;

    const showName = match[1]
        .replace(/[._]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!showName) return null;

    return {
        showName,
        season: parseInt(match[2], 10),
        episode: parseInt(match[3], 10),
    };
}

/**
 * Fallback search strategy: parses the filename, searches MyShows for the show
 * by name, then finds the matching episode by season and episode numbers.
 *
 * Posts `MSG_EPISODE_FOUND` or `MSG_EPISODE_NOT_FOUND` to the given player.
 *
 * @param filename - The video filename to parse and search for.
 * @param player - The player instance ID to post the result to.
 */
async function searchByParsedFilename(filename: string, player: string): Promise<void> {
    const parsed = parseFilename(filename);
    if (!parsed) {
        globalAPI.postMessage(player, MSG_EPISODE_NOT_FOUND, {});
        return;
    }

    const { showName, season, episode } = parsed;
    console.log(`Fallback search: show="${showName}", S${season}E${episode}`);

    const searchResult = await rpcCall("shows.Search", { query: showName });
    if (!searchResult || !Array.isArray(searchResult) || searchResult.length === 0) {
        console.warn(`Fallback search: no shows found for "${showName}"`);
        globalAPI.postMessage(player, MSG_EPISODE_NOT_FOUND, {});
        return;
    }

    const showId = (searchResult[0] as Record<string, unknown>).id as number;
    const showData = await rpcCall("shows.GetById", { showId, withEpisodes: true });

    if (!showData) {
        globalAPI.postMessage(player, MSG_EPISODE_NOT_FOUND, {});
        return;
    }

    type EpisodeSummary = { id: number; seasonNumber: number; episodeNumber: number };
    const episodes = ((showData as Record<string, unknown>).episodes as EpisodeSummary[]) ?? [];
    const ep = episodes.find((e) => e.seasonNumber === season && e.episodeNumber === episode);

    if (!ep) {
        console.warn(`Fallback search: S${season}E${episode} not found in show id=${showId}`);
        globalAPI.postMessage(player, MSG_EPISODE_NOT_FOUND, {});
        return;
    }

    console.log(`Episode found: id=${ep.id}`);
    globalAPI.postMessage(player, MSG_EPISODE_FOUND, { episodeId: ep.id });
}

/**
 * Primary search strategy: sends the raw filename to `shows.SearchByFile`.
 * Falls back to `searchByParsedFilename` if the API returns no results.
 *
 * Posts `MSG_EPISODE_FOUND` or `MSG_EPISODE_NOT_FOUND` to the given player.
 *
 * @param filename - The video filename to search for.
 * @param player - The player instance ID to post the result to.
 */
export async function searchByFile(filename: string, player: string): Promise<void> {
    console.log(`searchByFile: file="${filename}"`);
    try {
        const result = await rpcCall("shows.SearchByFile", { file: filename });
        if (result && Array.isArray(result) && result.length > 0) {
            const episodeId = parseInt(result[0] as string, 10);
            if (!isNaN(episodeId)) {
                console.log(`searchByFile found: id=${episodeId}`);
                globalAPI.postMessage(player, MSG_EPISODE_FOUND, { episodeId });
                return;
            }
        }
        console.warn(`searchByFile not found`);
        await searchByParsedFilename(filename, player);
    } catch (e) {
        console.error(`searchByFile error: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
        globalAPI.postMessage(player, MSG_EPISODE_NOT_FOUND, {});
    }
}

/**
 * Marks a MyShows episode as watched via `manage.CheckEpisode`.
 *
 * Posts `MSG_MARK_RESULT` with `{ success: true }` on success, or
 * `{ success: false }` if the API call fails.
 *
 * @param episodeId - The MyShows episode ID to mark as watched.
 * @param player - The player instance ID to post the result to.
 */
export async function markWatched(episodeId: number, player: string): Promise<void> {
    console.log(`markWatched: id=${episodeId}`);
    try {
        await rpcCall("manage.CheckEpisode", { id: episodeId });
        console.log(`Episode marked as watched: id=${episodeId}`);
        globalAPI.postMessage(player, MSG_MARK_RESULT, { success: true });
    } catch (e) {
        console.error(`markWatched error: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
        globalAPI.postMessage(player, MSG_MARK_RESULT, { success: false });
    }
}
