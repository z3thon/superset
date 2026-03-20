import { electronTrpc } from "renderer/lib/electron-trpc";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import { setSkipNextTabsPersist } from "renderer/lib/trpc-storage";
import { useTabsStore } from "./store";
import type { TabsState } from "./types";

/**
 * Subscribes to tab state changes from other windows (via the main process)
 * and replaces structural state (tabs, panes) in the local store.
 *
 * activeTabIds and focusedPaneIds are NOT synced so each window can
 * independently navigate tabs.
 */
export function useTabsSync() {
	electronTrpc.uiState.tabs.subscribe.useSubscription(undefined, {
		onData: () => {
			electronTrpcClient.uiState.tabs.get
				.query()
				.then((remote) => {
					if (!remote) return;

					const local = useTabsStore.getState();

					// Only sync structural state — tabs, panes, tabHistoryStacks
					// Skip activeTabIds and focusedPaneIds so each window views independently
					const localStructural = JSON.stringify({
						tabs: local.tabs,
						panes: local.panes,
						tabHistoryStacks: local.tabHistoryStacks,
					});
					const remoteStructural = JSON.stringify({
						tabs: (remote as TabsState).tabs,
						panes: (remote as TabsState).panes,
						tabHistoryStacks: (remote as TabsState).tabHistoryStacks,
					});

					if (localStructural === remoteStructural) return;

					// Skip persistence to avoid echo writes back to storage
					setSkipNextTabsPersist(true);
					useTabsStore.setState({
						tabs: (remote as TabsState).tabs,
						panes: (remote as TabsState).panes,
						tabHistoryStacks: (remote as TabsState).tabHistoryStacks,
					});
				})
				.catch((error: unknown) => {
					console.error("[tabs-sync] Failed to sync tabs:", error);
				});
		},
	});
}
