/**
 * Authentication module.
 *
 * Manages the MyShows access token lifecycle. Authentication is performed
 * directly against the MyShows session API using credentials stored in
 * plugin preferences (`myshows_username`, `myshows_password`).
 *
 * Call `clearToken()` to force re-authentication on the next API request.
 */

const { console, http, preferences } = iina;

/** MyShows session endpoint. Accepts form-encoded `login` + `password`. */
const AUTH_URL = "https://myshows.me/api/session";

/** Bearer token obtained after successful authentication. `null` when unauthenticated. */
export let authToken: string | null = null;

/** In-flight authentication promise, shared across concurrent callers. */
let pendingAuth: Promise<boolean> | null = null;

/**
 * Authenticates with MyShows using credentials from plugin preferences.
 *
 * If an authentication request is already in progress, returns the existing
 * promise so only one HTTP request is made regardless of how many callers
 * invoke this concurrently.
 *
 * @returns `true` if authentication succeeded and a token was obtained, `false` otherwise.
 */
export function authenticate(): Promise<boolean> {
    if (pendingAuth) return pendingAuth;

    pendingAuth = performAuth().finally(() => {
        pendingAuth = null;
    });

    return pendingAuth;
}

async function performAuth(): Promise<boolean> {
    const username = preferences.get("myshows_username") as string;
    const password = preferences.get("myshows_password") as string;

    if (!username || !password) {
        console.warn("MyShows credentials not configured");
        return false;
    }

    console.log("Authenticating");
    try {
        const res = await http.post(AUTH_URL, {
            params: {},
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data: { login: username, password: password },
        });

        if (res.statusCode === 200 && res.data) {
            authToken = res.data.token ?? null;
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
