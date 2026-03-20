import { Button } from "@superset/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	LuExpand,
	LuFile,
	LuGitCompareArrows,
	LuShrink,
	LuX,
} from "react-icons/lu";
import { HotkeyTooltipContent } from "renderer/components/HotkeyTooltipContent";
import { useProjectFocus } from "renderer/hooks/useProjectFocus";
import { electronTrpc } from "renderer/lib/electron-trpc";
import {
	RightSidebarTab,
	SidebarMode,
	useSidebarStore,
} from "renderer/stores/sidebar-state";
import { useTabsStore } from "renderer/stores/tabs/store";
import { toAbsoluteWorkspacePath } from "shared/absolute-paths";
import type { ChangeCategory, ChangedFile } from "shared/changes-types";
import { ProjectSection } from "../../WorkspaceSidebar/ProjectSection";
import { useScrollContext } from "../ChangesContent";
import { ChangesView } from "./ChangesView";
import { FilesView } from "./FilesView";

function TabButton({
	isActive,
	onClick,
	icon,
	label,
	compact,
}: {
	isActive: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
	compact?: boolean;
}) {
	if (compact) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={onClick}
						className={cn(
							"flex items-center justify-center shrink-0 h-full w-10 transition-all",
							isActive
								? "text-foreground bg-border/30"
								: "text-muted-foreground/70 hover:text-muted-foreground hover:bg-tertiary/20",
						)}
					>
						{icon}
					</button>
				</TooltipTrigger>
				<TooltipContent side="bottom" showArrow={false}>
					{label}
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex items-center gap-2 shrink-0 px-3 h-full transition-all text-sm",
				isActive
					? "text-foreground bg-border/30"
					: "text-muted-foreground/70 hover:text-muted-foreground hover:bg-tertiary/20",
			)}
		>
			{icon}
			{label}
		</button>
	);
}

export function RightSidebar() {
	const { workspaceId } = useParams({ strict: false });
	const { data: workspace } = electronTrpc.workspaces.get.useQuery(
		{ id: workspaceId ?? "" },
		{ enabled: !!workspaceId },
	);
	const worktreePath = workspace?.worktreePath;
	const currentMode = useSidebarStore((s) => s.currentMode);
	const rightSidebarTab = useSidebarStore((s) => s.rightSidebarTab);
	const setRightSidebarTab = useSidebarStore((s) => s.setRightSidebarTab);
	const toggleSidebar = useSidebarStore((s) => s.toggleSidebar);
	const setMode = useSidebarStore((s) => s.setMode);
	const sidebarWidth = useSidebarStore((s) => s.sidebarWidth);
	const isExpanded = currentMode === SidebarMode.Changes;
	const compactTabs = sidebarWidth < 250;
	const showChangesTab = !!worktreePath;

	const projectFocusId = useProjectFocus();
	const { data: allGroups = [] } =
		electronTrpc.workspaces.getAllGrouped.useQuery();
	const focusGroup = useMemo(
		() =>
			projectFocusId
				? allGroups.find((g) => g.project.id === projectFocusId)
				: undefined,
		[allGroups, projectFocusId],
	);
	const showProjectFocus = !!projectFocusId && !!focusGroup;

	// Vertical resize for project focus section
	const [focusHeight, setFocusHeight] = useState(0); // 0 = auto/content height
	const focusContentRef = useRef<HTMLDivElement>(null);
	const focusResizeRef = useRef<{
		startY: number;
		startHeight: number;
	} | null>(null);
	const [isFocusResizing, setIsFocusResizing] = useState(false);

	const handleFocusResizeMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const currentHeight =
				focusHeight > 0
					? focusHeight
					: (focusContentRef.current?.scrollHeight ?? 0);
			focusResizeRef.current = {
				startY: e.clientY,
				startHeight: currentHeight,
			};
			setIsFocusResizing(true);
		},
		[focusHeight],
	);

	useEffect(() => {
		if (!isFocusResizing) return;
		const MIN_FOCUS_HEIGHT = 40;
		const handleMouseMove = (e: MouseEvent) => {
			if (!focusResizeRef.current) return;
			const delta = e.clientY - focusResizeRef.current.startY;
			setFocusHeight(
				Math.max(MIN_FOCUS_HEIGHT, focusResizeRef.current.startHeight + delta),
			);
		};
		const handleMouseUp = () => {
			focusResizeRef.current = null;
			setIsFocusResizing(false);
		};
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
		document.body.style.userSelect = "none";
		document.body.style.cursor = "row-resize";
		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			document.body.style.userSelect = "";
			document.body.style.cursor = "";
		};
	}, [isFocusResizing]);

	const handleExpandToggle = () => {
		setMode(isExpanded ? SidebarMode.Tabs : SidebarMode.Changes);
	};

	const addFileViewerPane = useTabsStore((s) => s.addFileViewerPane);
	const trpcUtils = electronTrpc.useUtils();
	const { scrollToFile } = useScrollContext();

	const invalidateFileContent = useCallback(
		(absolutePath: string) => {
			const invalidations: Promise<unknown>[] = [];
			if (workspaceId) {
				invalidations.push(
					trpcUtils.filesystem.readFile.invalidate({
						workspaceId,
						absolutePath,
					}),
				);
			}
			if (worktreePath) {
				invalidations.push(
					trpcUtils.changes.getGitFileContents.invalidate({
						worktreePath,
						absolutePath,
					}),
				);
			}
			Promise.all(invalidations).catch((error) => {
				console.error(
					"[RightSidebar/invalidateFileContent] Failed to invalidate file content queries:",
					{ absolutePath, error },
				);
			});
		},
		[workspaceId, worktreePath, trpcUtils],
	);

	const handleFileOpenPane = useCallback(
		(file: ChangedFile, category: ChangeCategory, commitHash?: string) => {
			if (!workspaceId || !worktreePath) return;
			const absolutePath = toAbsoluteWorkspacePath(worktreePath, file.path);
			addFileViewerPane(workspaceId, {
				filePath: absolutePath,
				diffCategory: category,
				fileStatus: file.status,
				commitHash,
				oldPath: file.oldPath
					? toAbsoluteWorkspacePath(worktreePath, file.oldPath)
					: undefined,
			});
			invalidateFileContent(absolutePath);
		},
		[workspaceId, worktreePath, addFileViewerPane, invalidateFileContent],
	);

	const handleFileScrollTo = useCallback(
		(file: ChangedFile, category: ChangeCategory, commitHash?: string) => {
			scrollToFile(file, category, commitHash, worktreePath);
		},
		[scrollToFile, worktreePath],
	);

	const handleFileOpen =
		workspaceId && worktreePath
			? isExpanded
				? handleFileScrollTo
				: handleFileOpenPane
			: undefined;

	return (
		<aside className="h-full flex flex-col overflow-hidden">
			{showProjectFocus && focusGroup && (
				<div className="relative shrink-0">
					<div
						ref={focusContentRef}
						className="overflow-y-auto"
						style={focusHeight > 0 ? { height: focusHeight } : undefined}
					>
						<ProjectSection
							projectId={focusGroup.project.id}
							projectName={focusGroup.project.name}
							projectColor={focusGroup.project.color}
							githubOwner={focusGroup.project.githubOwner}
							mainRepoPath={focusGroup.project.mainRepoPath}
							hideImage={focusGroup.project.hideImage}
							iconUrl={focusGroup.project.iconUrl}
							workspaces={focusGroup.workspaces}
							sections={focusGroup.sections ?? []}
							topLevelItems={focusGroup.topLevelItems}
							shortcutBaseIndex={0}
							index={0}
							hideOpenInFocusWindow
						/>
					</div>
					{/* biome-ignore lint/a11y/useSemanticElements: interactive resize handle */}
					<div
						role="separator"
						aria-orientation="horizontal"
						aria-valuenow={focusHeight}
						tabIndex={0}
						onMouseDown={handleFocusResizeMouseDown}
						onDoubleClick={() => setFocusHeight(0)}
						className={cn(
							"absolute bottom-0 left-0 right-0 h-3 cursor-row-resize z-10 -mb-1.5",
							"after:absolute after:bottom-1 after:left-0 after:right-0 after:h-px after:transition-colors",
							"hover:after:bg-border focus:outline-none focus:after:bg-border",
							isFocusResizing && "after:bg-border",
						)}
					/>
				</div>
			)}
			<div className="flex items-center bg-background shrink-0 h-10 border-b">
				<div className="flex items-center h-full">
					{showChangesTab && (
						<TabButton
							isActive={rightSidebarTab === RightSidebarTab.Changes}
							onClick={() => setRightSidebarTab(RightSidebarTab.Changes)}
							icon={<LuGitCompareArrows className="size-3.5" />}
							label="Changes"
							compact={compactTabs}
						/>
					)}
					<TabButton
						isActive={rightSidebarTab === RightSidebarTab.Files}
						onClick={() => setRightSidebarTab(RightSidebarTab.Files)}
						icon={<LuFile className="size-3.5" />}
						label="Files"
						compact={compactTabs}
					/>
				</div>
				<div className="flex-1" />
				<div className="flex items-center h-10 pr-2 gap-0.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleExpandToggle}
								className="size-6 p-0"
							>
								{isExpanded ? (
									<LuShrink className="size-3.5" />
								) : (
									<LuExpand className="size-3.5" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom" showArrow={false}>
							<HotkeyTooltipContent
								label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
								hotkeyId="TOGGLE_EXPAND_SIDEBAR"
							/>
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={toggleSidebar}
								className="size-6 p-0"
							>
								<LuX className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom" showArrow={false}>
							<HotkeyTooltipContent
								label="Close sidebar"
								hotkeyId="TOGGLE_SIDEBAR"
							/>
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
			{showChangesTab && (
				<div
					className={
						rightSidebarTab === RightSidebarTab.Changes
							? "flex-1 min-h-0 flex flex-col overflow-hidden"
							: "hidden"
					}
				>
					<ChangesView
						onFileOpen={handleFileOpen}
						isExpandedView={isExpanded}
						isActive={rightSidebarTab === RightSidebarTab.Changes}
					/>
				</div>
			)}
			<div
				className={
					rightSidebarTab === RightSidebarTab.Changes && showChangesTab
						? "hidden"
						: "flex-1 min-h-0 flex flex-col overflow-hidden"
				}
			>
				<FilesView />
			</div>
		</aside>
	);
}
