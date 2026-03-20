import { initialProjectFocusId } from "renderer/lib/project-focus";

/**
 * Returns the project ID this window is focused on (if any).
 * Project focus windows are opened via "Open in Focus Window" and show
 * only workspaces for a single project, with the sidebar hidden.
 */
export function useProjectFocus(): string | null {
	return initialProjectFocusId;
}
