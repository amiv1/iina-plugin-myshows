import { describe, it, expect } from "vitest";
import { isVideoFile } from "../src/index";

describe("isVideoFile", () => {
  it.each([
    "episode.mkv",
    "movie.mp4",
    "show.avi",
    "clip.mov",
    "video.wmv",
    "stream.flv",
    "file.m4v",
    "broadcast.ts",
    "bluray.m2ts",
    "web.webm",
    "old.mpg",
    "old.mpeg",
    "chinese.rmvb",
    "mobile.3gp",
  ])("accepts video file: %s", (filename) => {
    expect(isVideoFile(filename)).toBe(true);
  });

  it.each([
    "song.mp3",
    "audio.flac",
    "music.aac",
    "track.wav",
    "podcast.ogg",
    "voice.m4a",
    "lossless.ape",
  ])("rejects audio file: %s", (filename) => {
    expect(isVideoFile(filename)).toBe(false);
  });

  it.each([
    "a.ts",   // 4 chars — below threshold
    ".mkv",   // 4 chars — no name, below threshold
    "ab.",    // 3 chars
  ])("rejects filename that is too short: %s", (filename) => {
    expect(isVideoFile(filename)).toBe(false);
  });

  it("rejects a file with no extension", () => {
    expect(isVideoFile("videofile")).toBe(false);
  });

  it("is case-insensitive for extensions", () => {
    expect(isVideoFile("Movie.MKV")).toBe(true);
    expect(isVideoFile("Movie.MP4")).toBe(true);
  });
});
