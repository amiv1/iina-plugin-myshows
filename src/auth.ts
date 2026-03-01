/**
 * Authentication module.
 *
 * Manages the MyShows access token lifecycle. Authentication is performed
 * against a configurable proxy URL (preference: `myshows_auth_proxy_url`)
 * that accepts `{ login, password }` and returns a bearer token.
 *
 * Call `clearToken()` to force re-authentication on the next API request.
 */

const { console, http, preferences, global: globalAPI } = iina;

/** Bearer token obtained after successful authentication. `null` when unauthenticated. */
export let authToken: string | null = null;

/**
 * Authenticates with MyShows using credentials from plugin preferences.
 *
 * @returns `true` if authentication succeeded and a token was obtained, `false` otherwise.
 */
export async function authenticate(): Promise<boolean> {
    const proxyUrl = preferences.get("myshows_auth_proxy_url") as string;
    const username = preferences.get("myshows_username") as string;
    const password = preferences.get("myshows_password") as string;

    if (!proxyUrl || !username || !password) {
        console.warn("MyShows credentials not configured");
        return false;
    }

    console.log("Authenticating");
    try {
        const res = await http.post(proxyUrl, {
            params: {},
            headers: { "Content-Type": "application/json" },
            data: { login: username, password: password },
        });

        if (res.statusCode === 200 && res.data) {
            authToken = res.data.token ?? res.data.access_token ?? null;
            if (authToken) {
                console.log("Authenticated");
                return true;
            }
        }
        const msg = `Authentication failed: status=${res.statusCode}`;
        console.warn(msg);
    } catch (e) {
        const msg = `Authentication error: ${e instanceof Error ? e.message : JSON.stringify(e)}`;
        console.error(msg);
    }
    return false;
}

/**
 * Clears the stored bearer token, forcing re-authentication on the next API call.
 */
export function clearToken(): void {
    authToken = null;
}
