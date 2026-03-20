/**
 * Captures the projectFocus query parameter from the initial URL hash
 * before TanStack Router strips it. Must be imported before the router is created.
 */
let initialProjectFocusId: string | null = null;

try {
	const hash = window.location.hash; // e.g. "#/?projectFocus=abc123"
	if (hash) {
		const hashPath = hash.slice(1); // remove leading #
		const queryIndex = hashPath.indexOf("?");
		if (queryIndex !== -1) {
			const params = new URLSearchParams(hashPath.slice(queryIndex));
			initialProjectFocusId = params.get("projectFocus");
		}
	}
} catch {
	// Silently ignore parse errors
}

export { initialProjectFocusId };
