import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseFilename, searchByFile, markWatched } from "../src/search";
import { clearToken } from "../src/auth";

const iinaMock = (globalThis as Record<string, unknown>).iina as {
  http: { post: ReturnType<typeof vi.fn> };
  preferences: { get: ReturnType<typeof vi.fn> };
  global: { postMessage: ReturnType<typeof vi.fn> };
};

/** Sets up auth + one RPC response. */
function mockRpc(result: unknown): void {
  iinaMock.http.post
    .mockResolvedValueOnce({ statusCode: 200, data: { token: "tok" } })
    .mockResolvedValueOnce({ statusCode: 200, data: { result } });
}

/** Sets up auth + multiple sequential RPC responses. */
function mockRpcSequence(...results: unknown[]): void {
  iinaMock.http.post.mockResolvedValueOnce({ statusCode: 200, data: { token: "tok" } });
  for (const result of results) {
    iinaMock.http.post.mockResolvedValueOnce({ statusCode: 200, data: { result } });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  clearToken();
  iinaMock.preferences.get.mockImplementation((key: string) => {
    const prefs: Record<string, unknown> = {
      myshows_auth_proxy_url: "https://proxy.example.com/auth",
      myshows_username: "user",
      myshows_password: "pass",
    };
    return prefs[key];
  });
});

// ---------------------------------------------------------------------------
// parseFilename
// ---------------------------------------------------------------------------

describe("parseFilename", () => {
  it("parses SxxExx format", () => {
    expect(parseFilename("Breaking.Bad.S01E03.mkv")).toEqual({
      showName: "Breaking Bad",
      season: 1,
      episode: 3,
    });
  });

  it("parses SxxExx format case-insensitively", () => {
    expect(parseFilename("Show.Name.s02e11.mp4")).toEqual({
      showName: "Show Name",
      season: 2,
      episode: 11,
    });
  });

  it("parses NxNN format", () => {
    expect(parseFilename("Show.Name.2x05.mkv")).toEqual({
      showName: "Show Name",
      season: 2,
      episode: 5,
    });
  });

  it("handles underscores and hyphens as separators", () => {
    expect(parseFilename("The_Office_S03E07.mkv")).toEqual({
      showName: "The Office",
      season: 3,
      episode: 7,
    });
  });

  it("returns null for a filename with no S/E pattern", () => {
    expect(parseFilename("some.random.file.mkv")).toBeNull();
  });

  it("returns null for a filename with no show name before the pattern", () => {
    expect(parseFilename("S01E01.mkv")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// searchByFile — primary path
// ---------------------------------------------------------------------------

describe("searchByFile — primary (SearchByFile)", () => {
  it("posts episode-found when SearchByFile returns an episode ID", async () => {
    mockRpc(["12345"]);
    await searchByFile("Breaking.Bad.S01E03.mkv", "player-1");
    expect(iinaMock.global.postMessage).toHaveBeenCalledWith(
      "player-1",
      "myshows.episode-found",
      { episodeId: 12345 }
    );
  });

  it("posts episode-not-found when SearchByFile returns an empty array", async () => {
    // Empty primary result triggers fallback; fallback search returns nothing
    mockRpcSequence([], []);
    await searchByFile("no.match.S01E01.mkv", "player-1");
    expect(iinaMock.global.postMessage).toHaveBeenCalledWith(
      "player-1",
      "myshows.episode-not-found",
      {}
    );
  });
});

// ---------------------------------------------------------------------------
// searchByFile — fallback path
// ---------------------------------------------------------------------------

describe("searchByFile — fallback (Search + GetById)", () => {
  it("finds episode via fallback when SearchByFile returns null", async () => {
    const episodes = [
      { id: 999, seasonNumber: 1, episodeNumber: 3 },
      { id: 888, seasonNumber: 1, episodeNumber: 4 },
    ];
    mockRpcSequence(
      null,                                        // SearchByFile → no result
      [{ id: 7 }],                                 // shows.Search
      { id: 7, episodes }                          // shows.GetById
    );
    await searchByFile("Breaking.Bad.S01E03.mkv", "player-1");
    expect(iinaMock.global.postMessage).toHaveBeenCalledWith(
      "player-1",
      "myshows.episode-found",
      { episodeId: 999 }
    );
  });

  it("posts episode-not-found when show search returns no results", async () => {
    mockRpcSequence(
      null,  // SearchByFile
      []     // shows.Search → empty
    );
    await searchByFile("Breaking.Bad.S01E03.mkv", "player-1");
    expect(iinaMock.global.postMessage).toHaveBeenCalledWith(
      "player-1",
      "myshows.episode-not-found",
      {}
    );
  });

  it("posts episode-not-found when episode is not in show's episode list", async () => {
    const episodes = [{ id: 1, seasonNumber: 2, episodeNumber: 1 }];
    mockRpcSequence(
      null,
      [{ id: 7 }],
      { id: 7, episodes }
    );
    await searchByFile("Breaking.Bad.S01E03.mkv", "player-1");
    expect(iinaMock.global.postMessage).toHaveBeenCalledWith(
      "player-1",
      "myshows.episode-not-found",
      {}
    );
  });

  it("posts episode-not-found when filename cannot be parsed", async () => {
    mockRpc(null); // SearchByFile returns null, no fallback possible
    await searchByFile("unparseable.mkv", "player-1");
    expect(iinaMock.global.postMessage).toHaveBeenCalledWith(
      "player-1",
      "myshows.episode-not-found",
      {}
    );
  });
});

// ---------------------------------------------------------------------------
// markWatched
// ---------------------------------------------------------------------------

describe("markWatched", () => {
  it("posts mark-result success when CheckEpisode succeeds", async () => {
    mockRpc(null); // CheckEpisode returns no meaningful result
    await markWatched(42, "player-1");
    expect(iinaMock.global.postMessage).toHaveBeenCalledWith(
      "player-1",
      "myshows.mark-result",
      { success: true }
    );
  });

  it("posts mark-result failure when RPC throws", async () => {
    iinaMock.http.post
      .mockResolvedValueOnce({ statusCode: 200, data: { token: "tok" } })
      .mockRejectedValueOnce(new Error("Server error"));
    await markWatched(42, "player-1");
    expect(iinaMock.global.postMessage).toHaveBeenCalledWith(
      "player-1",
      "myshows.mark-result",
      { success: false }
    );
  });
});
