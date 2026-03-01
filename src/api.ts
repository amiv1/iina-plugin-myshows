/**
 * MyShows API client module.
 *
 * Provides a single `rpcCall()` function for making JSON-RPC 2.0 requests to
 * the MyShows API. Handles bearer token injection and transparent
 * re-authentication when the server returns HTTP 401.
 */

import { authenticate, authToken, clearToken } from "./auth";

const { console, http } = iina;

/** Base URL for all MyShows JSON-RPC 2.0 requests. */
const MYSHOWS_RPC_URL = "https://api.myshows.me/v2/rpc/";

/**
 * Executes a authorized MyShows JSON-RPC 2.0 method call.
 *
 * @param method - The RPC method name (e.g. `"shows.SearchByFile"`).
 * @param params - The method parameters object.
 * @param retryOnUnauth - Whether to retry after a 401 by re-authenticating. Defaults to `true`.
 * @returns The `result` field of the JSON-RPC response, or `null` on failure.
 */
export async function rpcCall(
    method: string,
    params: Record<string, unknown>,
    retryOnUnauth = true
): Promise<unknown> {
    console.log(`rpcCall request: method=${method}, params=${JSON.stringify(params)}`);
    if (!authToken) {
        const ok = await authenticate();
        if (!ok) return null;
    }

    const payload = { jsonrpc: "2.0", method, params, id: 1 };

    const res = await http.post(MYSHOWS_RPC_URL, {
        params: {},
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        data: payload,
    });

    if (res.statusCode === 401 && retryOnUnauth) {
        clearToken();
        return rpcCall(method, params, false);
    }

    if (res.statusCode === 404) return null;

    return res.data?.result ?? null;
}
