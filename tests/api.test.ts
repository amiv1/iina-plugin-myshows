import { describe, it, expect, vi, beforeEach } from "vitest";
import { rpcCall } from "../src/api";
import { clearToken } from "../src/auth";

const iinaMock = (globalThis as Record<string, unknown>).iina as {
    http: { post: ReturnType<typeof vi.fn> };
    preferences: { get: ReturnType<typeof vi.fn> };
};

/** Mocks a successful authentication followed by the given RPC response. */
function mockAuthThenRpc(rpcResponse: object): void {
    iinaMock.http.post
        .mockResolvedValueOnce({ statusCode: 200, data: { token: "test-token" } }) // auth
        .mockResolvedValueOnce(rpcResponse); // rpc
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

describe("rpcCall", () => {
    it("authenticates first when no token is present, then returns result", async () => {
        mockAuthThenRpc({ statusCode: 200, data: { result: [42] } });
        const result = await rpcCall("shows.SearchByFile", { file: "test.mkv" });
        expect(result).toEqual([42]);
        expect(iinaMock.http.post).toHaveBeenCalledTimes(2);
    });

    it("returns null when authentication fails", async () => {
        iinaMock.http.post.mockResolvedValue({ statusCode: 401, data: null });
        const result = await rpcCall("shows.SearchByFile", { file: "test.mkv" });
        expect(result).toBeNull();
    });

    it("retries once on 401 by re-authenticating, then returns result", async () => {
        iinaMock.http.post
            .mockResolvedValueOnce({ statusCode: 200, data: { token: "token-1" } }) // initial auth
            .mockResolvedValueOnce({ statusCode: 401, data: null })                 // rpc → 401
            .mockResolvedValueOnce({ statusCode: 200, data: { token: "token-2" } }) // re-auth
            .mockResolvedValueOnce({ statusCode: 200, data: { result: "ok" } });    // retry rpc
        const result = await rpcCall("shows.SearchByFile", { file: "test.mkv" });
        expect(result).toBe("ok");
        expect(iinaMock.http.post).toHaveBeenCalledTimes(4);
    });

    it("does not retry on second 401 (retryOnUnauth=false)", async () => {
        iinaMock.http.post
            .mockResolvedValueOnce({ statusCode: 200, data: { token: "token" } }) // auth
            .mockResolvedValueOnce({ statusCode: 401, data: null })               // rpc → 401
            .mockResolvedValueOnce({ statusCode: 200, data: { token: "token2" } }) // re-auth
            .mockResolvedValueOnce({ statusCode: 401, data: null });              // retry → 401 again
        const result = await rpcCall("shows.SearchByFile", { file: "test.mkv" });
        expect(result).toBeNull();
    });

    it("returns null on 404", async () => {
        mockAuthThenRpc({ statusCode: 404, data: null });
        const result = await rpcCall("shows.SearchByFile", { file: "test.mkv" });
        expect(result).toBeNull();
    });

    it("returns null when result field is absent", async () => {
        mockAuthThenRpc({ statusCode: 200, data: {} });
        const result = await rpcCall("shows.SearchByFile", { file: "test.mkv" });
        expect(result).toBeNull();
    });
});
