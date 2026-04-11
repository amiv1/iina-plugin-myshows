import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate, clearToken, authToken } from "../src/auth";

const iinaMock = (globalThis as Record<string, unknown>).iina as {
  console: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  http: { post: ReturnType<typeof vi.fn> };
  preferences: { get: ReturnType<typeof vi.fn> };
  global: { postMessage: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  clearToken();
  iinaMock.preferences.get.mockImplementation((key: string) => {
    const prefs: Record<string, unknown> = {
      myshows_username: "user",
      myshows_password: "pass",
    };
    return prefs[key];
  });
});

describe("authenticate", () => {
  it("returns false and warns when credentials are missing", async () => {
    iinaMock.preferences.get.mockReturnValue(undefined);
    const result = await authenticate();
    expect(result).toBe(false);
    expect(iinaMock.console.warn).toHaveBeenCalledWith("MyShows credentials not configured");
  });

  it("returns true and stores token on success", async () => {
    iinaMock.http.post.mockResolvedValue({ statusCode: 200, data: { token: "abc123", refreshToken: "ref456" } });
    const result = await authenticate();
    expect(result).toBe(true);
    expect(authToken).toBe("abc123");
  });

  it("sends form-encoded body to MyShows session endpoint", async () => {
    iinaMock.http.post.mockResolvedValue({ statusCode: 200, data: { token: "abc123" } });
    await authenticate();
    expect(iinaMock.http.post).toHaveBeenCalledWith(
      "https://myshows.me/api/session",
      expect.objectContaining({
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: { login: "user", password: "pass" },
      })
    );
  });

  it("returns false and warns on non-200 status", async () => {
    iinaMock.http.post.mockResolvedValue({ statusCode: 401, data: null });
    const result = await authenticate();
    expect(result).toBe(false);
    expect(iinaMock.console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Authentication failed: status=401")
    );
  });

  it("returns false on network error and calls console.error", async () => {
    iinaMock.http.post.mockRejectedValue(new Error("Network timeout"));
    const result = await authenticate();
    expect(result).toBe(false);
    expect(iinaMock.console.error).toHaveBeenCalledWith(
      expect.stringContaining("Network timeout")
    );
  });
});

describe("authenticate — concurrent calls", () => {
  it("sends only one HTTP request when called concurrently", async () => {
    iinaMock.http.post.mockResolvedValue({ statusCode: 200, data: { token: "tok" } });
    const [r1, r2, r3] = await Promise.all([authenticate(), authenticate(), authenticate()]);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
    expect(iinaMock.http.post).toHaveBeenCalledTimes(1);
  });
});

describe("clearToken", () => {
  it("sets authToken to null", async () => {
    iinaMock.http.post.mockResolvedValue({ statusCode: 200, data: { token: "tok" } });
    await authenticate();
    expect(authToken).toBe("tok");
    clearToken();
    expect(authToken).toBeNull();
  });
});
