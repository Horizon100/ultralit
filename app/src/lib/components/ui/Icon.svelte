<script lang="ts">
	import type { ComponentType } from 'svelte';

	export let name: string;
	export let size: number = 24;
	export let color: string = 'currentColor';
	export let strokeWidth: number = 2;
	export let className: string = '';

	// Icon map for all your used Lucide icons
	const iconMap: Record<string, () => Promise<{ default: string }>> = {
		User2: () => import('../../assets/icons/lucide/user2.svg?raw'),
		UserCheckIcon: () => import('../../assets/icons/lucide/user-check-icon.svg?raw'),
		Users: () => import('../../assets/icons/lucide/users.svg?raw'),
		ArrowLeft: () => import('../../assets/icons/lucide/arrow-left.svg?raw'),
		Key: () => import('../../assets/icons/lucide/key.svg?raw'),
		CheckCircle2: () => import('../../assets/icons/lucide/check-circle2.svg?raw'),
		XCircle: () => import('../../assets/icons/lucide/xcircle.svg?raw'),
		Check: () => import('../../assets/icons/lucide/check.svg?raw'),
		Search: () => import('../../assets/icons/lucide/search.svg?raw'),
		Trash2: () => import('../../assets/icons/lucide/trash2.svg?raw'),
		Plus: () => import('../../assets/icons/lucide/plus.svg?raw'),
		ChevronLeft: () => import('../../assets/icons/lucide/chevron-left.svg?raw'),
		PackageOpen: () => import('../../assets/icons/lucide/package-open.svg?raw'),
		Package: () => import('../../assets/icons/lucide/package.svg?raw'),
		Mic: () => import('../../assets/icons/lucide/mic.svg?raw'),
		Square: () => import('../../assets/icons/lucide/square.svg?raw'),
		Play: () => import('../../assets/icons/lucide/play.svg?raw'),
		Pause: () => import('../../assets/icons/lucide/pause.svg?raw'),
		X: () => import('../../assets/icons/lucide/x.svg?raw'),
		VolumeX: () => import('../../assets/icons/lucide/volume-x.svg?raw'),
		Volume1: () => import('../../assets/icons/lucide/volume1.svg?raw'),
		Volume2: () => import('../../assets/icons/lucide/volume2.svg?raw'),
		Tag: () => import('../../assets/icons/lucide/tag.svg?raw'),
		ChevronDown: () => import('../../assets/icons/lucide/chevron-down.svg?raw'),
		Filter: () => import('../../assets/icons/lucide/filter.svg?raw'),
		Timer: () => import('../../assets/icons/lucide/timer.svg?raw'),
		TimerOff: () => import('../../assets/icons/lucide/timer-off.svg?raw'),
		Box: () => import('../../assets/icons/lucide/box.svg?raw'),
		MessageCircleMore: () => import('../../assets/icons/lucide/message-circle-more.svg?raw'),
		PackagePlus: () => import('../../assets/icons/lucide/package-plus.svg?raw'),
		Pen: () => import('../../assets/icons/lucide/pen.svg?raw'),
		InfoIcon: () => import('../../assets/icons/lucide/info-icon.svg?raw'),
		ChartBarBig: () => import('../../assets/icons/lucide/chart-bar-big.svg?raw'),
		Logs: () => import('../../assets/icons/lucide/logs.svg?raw'),
		BrainCircuit: () => import('../../assets/icons/lucide/brain-circuit.svg?raw'),
		CalendarClock: () => import('../../assets/icons/lucide/calendar-clock.svg?raw'),
		ChevronRight: () => import('../../assets/icons/lucide/chevron-right.svg?raw'),
		FolderGit: () => import('../../assets/icons/lucide/folder-git.svg?raw'),
		Info: () => import('../../assets/icons/lucide/info.svg?raw'),
		Save: () => import('../../assets/icons/lucide/save.svg?raw'),
		Send: () => import('../../assets/icons/lucide/send.svg?raw'),
		Paperclip: () => import('../../assets/icons/lucide/paperclip.svg?raw'),
		PlugZap: () => import('../../assets/icons/lucide/plug-zap.svg?raw'),
		ZapOff: () => import('../../assets/icons/lucide/zap-off.svg?raw'),
		Bookmark: () => import('../../assets/icons/lucide/bookmark.svg?raw'),
		BookmarkCheckIcon: () => import('../../assets/icons/lucide/bookmark-check-icon.svg?raw'),
		Braces: () => import('../../assets/icons/lucide/braces.svg?raw'),
		Command: () => import('../../assets/icons/lucide/command.svg?raw'),
		Brain: () => import('../../assets/icons/lucide/brain.svg?raw'),
		TrashIcon: () => import('../../assets/icons/lucide/trash-icon.svg?raw'),
		MessageCirclePlus: () => import('../../assets/icons/lucide/message-circle-plus.svg?raw'),
		Star: () => import('../../assets/icons/lucide/star.svg?raw'),
		RefreshCcw: () => import('../../assets/icons/lucide/refresh-ccw.svg?raw'),
		AlertCircle: () => import('../../assets/icons/lucide/alert-circle.svg?raw'),
		CheckCircle: () => import('../../assets/icons/lucide/check-circle.svg?raw'),
		Bot: () => import('../../assets/icons/lucide/bot.svg?raw'),
		File: () => import('../../assets/icons/lucide/file.svg?raw'),
		LogIn: () => import('../../assets/icons/lucide/log-in.svg?raw'),
		MailPlus: () => import('../../assets/icons/lucide/mail-plus.svg?raw'),
		Loader2: () => import('../../assets/icons/lucide/loader2.svg?raw'),
		Settings: () => import('../../assets/icons/lucide/settings.svg?raw'),
		Link: () => import('../../assets/icons/lucide/link.svg?raw'),
		Quote: () => import('../../assets/icons/lucide/quote.svg?raw'),
		ArrowRight: () => import('../../assets/icons/lucide/arrow-right.svg?raw'),
		Book: () => import('../../assets/icons/lucide/book.svg?raw'),
		MessageCircle: () => import('../../assets/icons/lucide/message-circle.svg?raw'),
		CheckSquare: () => import('../../assets/icons/lucide/check-square.svg?raw'),
		Layers: () => import('../../assets/icons/lucide/layers.svg?raw'),
		MessagesSquare: () => import('../../assets/icons/lucide/messages-square.svg?raw'),
		Edit2: () => import('../../assets/icons/lucide/edit2.svg?raw'),
		CopyPlus: () => import('../../assets/icons/lucide/copy-plus.svg?raw'),
		ArrowUpDown: () => import('../../assets/icons/lucide/arrow-up-down.svg?raw'),
		Upload: () => import('../../assets/icons/lucide/upload.svg?raw'),
		Activity: () => import('../../assets/icons/lucide/activity.svg?raw'),
		Compass: () => import('../../assets/icons/lucide/compass.svg?raw'),
		ServerCog: () => import('../../assets/icons/lucide/server-cog.svg?raw'),
		OctagonPause: () => import('../../assets/icons/lucide/octagon-pause.svg?raw'),
		Cpu: () => import('../../assets/icons/lucide/cpu.svg?raw'),
		HeadphonesIcon: () => import('../../assets/icons/lucide/headphones-icon.svg?raw'),
		ShieldCheck: () => import('../../assets/icons/lucide/shield-check.svg?raw'),
		CircleOff: () => import('../../assets/icons/lucide/circle-off.svg?raw'),
		Wrench: () => import('../../assets/icons/lucide/wrench.svg?raw'),
		Target: () => import('../../assets/icons/lucide/target.svg?raw'),
		Settings2: () => import('../../assets/icons/lucide/settings2.svg?raw'),
		SquareMenu: () => import('../../assets/icons/lucide/square-menu.svg?raw'),
		FilePenLine: () => import('../../assets/icons/lucide/file-pen-line.svg?raw'),
		ChevronUp: () => import('../../assets/icons/lucide/chevron-up.svg?raw'),
		Trash: () => import('../../assets/icons/lucide/trash.svg?raw'),
		Calendar: () => import('../../assets/icons/lucide/calendar.svg?raw'),
		ListTree: () => import('../../assets/icons/lucide/list-tree.svg?raw'),
		MessageSquareText: () => import('../../assets/icons/lucide/message-square-text.svg?raw'),
		BookmarkMinus: () => import('../../assets/icons/lucide/bookmark-minus.svg?raw'),
		BookmarkX: () => import('../../assets/icons/lucide/bookmark-x.svg?raw'),
		SquarePlay: () => import('../../assets/icons/lucide/square-play.svg?raw'),
		Unlink: () => import('../../assets/icons/lucide/unlink.svg?raw'),
		MessageSquare: () => import('../../assets/icons/lucide/message-square.svg?raw'),
		PlusCircle: () => import('../../assets/icons/lucide/plus-circle.svg?raw'),
		BotIcon: () => import('../../assets/icons/lucide/bot-icon.svg?raw'),
		Copy: () => import('../../assets/icons/lucide/copy.svg?raw'),
		ListTodo: () => import('../../assets/icons/lucide/list-todo.svg?raw'),
		Eye: () => import('../../assets/icons/lucide/eye.svg?raw'),
		EyeOff: () => import('../../assets/icons/lucide/eye-off.svg?raw'),
		Calculator: () => import('../../assets/icons/lucide/calculator.svg?raw'),
		CalendarCheck: () => import('../../assets/icons/lucide/calendar-check.svg?raw'),
		GitCompare: () => import('../../assets/icons/lucide/git-compare.svg?raw'),
		SplitSquareVertical: () => import('../../assets/icons/lucide/split-square-vertical.svg?raw'),
		Minimize: () => import('../../assets/icons/lucide/minimize.svg?raw'),
		HelpCircle: () => import('../../assets/icons/lucide/help-circle.svg?raw'),
		Camera: () => import('../../assets/icons/lucide/camera.svg?raw'),
		UserPlus: () => import('../../assets/icons/lucide/user-plus.svg?raw'),
		LogOut: () => import('../../assets/icons/lucide/log-out.svg?raw'),
		SignalHigh: () => import('../../assets/icons/lucide/signal-high.svg?raw'),
		Circle: () => import('../../assets/icons/lucide/circle.svg?raw'),
		Triangle: () => import('../../assets/icons/lucide/triangle.svg?raw'),
		Hexagon: () => import('../../assets/icons/lucide/hexagon.svg?raw'),
		Pencil: () => import('../../assets/icons/lucide/pencil.svg?raw'),
		Database: () => import('../../assets/icons/lucide/database.svg?raw'),
		FileText: () => import('../../assets/icons/lucide/file-text.svg?raw'),
		Image: () => import('../../assets/icons/lucide/image.svg?raw'),
		FileSpreadsheet: () => import('../../assets/icons/lucide/file-spreadsheet.svg?raw'),
		Headphones: () => import('../../assets/icons/lucide/headphones.svg?raw'),
		Video: () => import('../../assets/icons/lucide/video.svg?raw'),
		Maximize2: () => import('../../assets/icons/lucide/maximize2.svg?raw'),
		Minimize2: () => import('../../assets/icons/lucide/minimize2.svg?raw'),
		Code: () => import('../../assets/icons/lucide/code.svg?raw'),
		Presentation: () => import('../../assets/icons/lucide/presentation.svg?raw'),
		MoreVertical: () => import('../../assets/icons/lucide/more-vertical.svg?raw'),
		FileIcon: () => import('../../assets/icons/lucide/file-icon.svg?raw'),
		Folder: () => import('../../assets/icons/lucide/folder.svg?raw'),
		FolderPlus: () => import('../../assets/icons/lucide/folder-plus.svg?raw'),
		ListFilter: () => import('../../assets/icons/lucide/list-filter.svg?raw'),
		Heart: () => import('../../assets/icons/lucide/heart.svg?raw'),
		Repeat: () => import('../../assets/icons/lucide/repeat.svg?raw'),
		Share: () => import('../../assets/icons/lucide/share.svg?raw'),
		MoreHorizontal: () => import('../../assets/icons/lucide/more-horizontal.svg?raw'),
		EyeIcon: () => import('../../assets/icons/lucide/eye-icon.svg?raw'),
		TagsIcon: () => import('../../assets/icons/lucide/tags-icon.svg?raw'),
		Sparkles: () => import('../../assets/icons/lucide/sparkles.svg?raw'),
		TrendingUp: () => import('../../assets/icons/lucide/trending-up.svg?raw'),
		Share2: () => import('../../assets/icons/lucide/share2.svg?raw'),
		PlusSquareIcon: () => import('../../assets/icons/lucide/plus-square-icon.svg?raw'),
		Clock: () => import('../../assets/icons/lucide/clock.svg?raw'),
		Flag: () => import('../../assets/icons/lucide/flag.svg?raw'),
		User: () => import('../../assets/icons/lucide/user.svg?raw'),
		ArrowDown: () => import('../../assets/icons/lucide/arrow-down.svg?raw'),
		ClipboardList: () => import('../../assets/icons/lucide/clipboard-list.svg?raw'),
		TagIcon: () => import('../../assets/icons/lucide/tag-icon.svg?raw'),
		CirclePlay: () => import('../../assets/icons/lucide/circle-play.svg?raw'),
		GitFork: () => import('../../assets/icons/lucide/git-fork.svg?raw'),
		LayoutList: () => import('../../assets/icons/lucide/layout-list.svg?raw'),
		ListCollapse: () => import('../../assets/icons/lucide/list-collapse.svg?raw'),
		PlayCircleIcon: () => import('../../assets/icons/lucide/play-circle-icon.svg?raw'),
		Tags: () => import('../../assets/icons/lucide/tags.svg?raw'),
		Group: () => import('../../assets/icons/lucide/group.svg?raw'),
		LogOutIcon: () => import('../../assets/icons/lucide/log-out-icon.svg?raw'),
		Languages: () => import('../../assets/icons/lucide/languages.svg?raw'),
		Palette: () => import('../../assets/icons/lucide/palette.svg?raw'),
		Bone: () => import('../../assets/icons/lucide/bone.svg?raw'),
		TextCursorIcon: () => import('../../assets/icons/lucide/text-cursor-icon.svg?raw'),
		UserCircle: () => import('../../assets/icons/lucide/user-circle.svg?raw'),
		MailCheck: () => import('../../assets/icons/lucide/mail-check.svg?raw'),
		Mail: () => import('../../assets/icons/lucide/mail.svg?raw'),
		KeyIcon: () => import('../../assets/icons/lucide/key-icon.svg?raw'),
		Cake: () => import('../../assets/icons/lucide/cake.svg?raw'),
		History: () => import('../../assets/icons/lucide/history.svg?raw'),
		Shield: () => import('../../assets/icons/lucide/shield.svg?raw'),
		SettingsIcon: () => import('../../assets/icons/lucide/settings-icon.svg?raw'),
		WallpaperIcon: () => import('../../assets/icons/lucide/wallpaper-icon.svg?raw'),
		Moon: () => import('../../assets/icons/lucide/moon.svg?raw'),
		Sun: () => import('../../assets/icons/lucide/sun.svg?raw'),
		Sunset: () => import('../../assets/icons/lucide/sunset.svg?raw'),
		Sunrise: () => import('../../assets/icons/lucide/sunrise.svg?raw'),
		Focus: () => import('../../assets/icons/lucide/focus.svg?raw'),
		Bold: () => import('../../assets/icons/lucide/bold.svg?raw'),
		Gauge: () => import('../../assets/icons/lucide/gauge.svg?raw'),
		CalendarDays: () => import('../../assets/icons/lucide/calendar-days.svg?raw'),
		SortAsc: () => import('../../assets/icons/lucide/sort-asc.svg?raw'),
		SortDesc: () => import('../../assets/icons/lucide/sort-desc.svg?raw'),
		PanelLeftClose: () => import('../../assets/icons/lucide/panel-left-close.svg?raw'),
		PanelLeftOpen: () => import('../../assets/icons/lucide/panel-left-open.svg?raw'),
		Component: () => import('../../assets/icons/lucide/component.svg?raw'),
		SquareKanban: () => import('../../assets/icons/lucide/square-kanban.svg?raw'),
		Combine: () => import('../../assets/icons/lucide/combine.svg?raw'),
		KanbanSquare: () => import('../../assets/icons/lucide/kanban-square.svg?raw'),
		Github: () => import('../../assets/icons/lucide/github.svg?raw'),
		Gamepad: () => import('../../assets/icons/lucide/gamepad.svg?raw'),
		Gamepad2: () => import('../../assets/icons/lucide/gamepad2.svg?raw'),
		HomeIcon: () => import('../../assets/icons/lucide/home-icon.svg?raw'),
		LucideHome: () => import('../../assets/icons/lucide/lucide-home.svg?raw'),
		FilterIcon: () => import('../../assets/icons/lucide/filter-icon.svg?raw'),
		ScanFace: () => import('../../assets/icons/lucide/scan-face.svg?raw'),
		ListX: () => import('../../assets/icons/lucide/list-x.svg?raw'),
		MessageCircleOff: () => import('../../assets/icons/lucide/message-circle-off.svg?raw'),
		ListCollapseIcon: () => import('../../assets/icons/lucide/list-collapse-icon.svg?raw'),
		CalendarOff: () => import('../../assets/icons/lucide/calendar-off.svg?raw'),
		Notebook: () => import('../../assets/icons/lucide/notebook.svg?raw'),
		NotebookPen: () => import('../../assets/icons/lucide/notebook-pen.svg?raw'),
		MapPin: () => import('../../assets/icons/lucide/map-pin.svg?raw'),
		UserIcon: () => import('../../assets/icons/lucide/user-icon.svg?raw'),
		BrainCog: () => import('../../assets/icons/lucide/brain-cog.svg?raw'),
		Maximize: () => import('../../assets/icons/lucide/maximize.svg?raw'),
		Workflow: () => import('../../assets/icons/lucide/workflow.svg?raw'),
		PanelLeft: () => import('../../assets/icons/lucide/panel-left.svg?raw'),
		GitBranchPlus: () => import('../../assets/icons/lucide/git-branch-plus.svg?raw'),
		FilePlus: () => import('../../assets/icons/lucide/file-plus.svg?raw'),
		ChartAreaIcon: () => import('../../assets/icons/lucide/chart-area-icon.svg?raw'),
		ChartNoAxesGantt: () => import('../../assets/icons/lucide/chart-no-axes-gantt.svg?raw'),
		KanbanSquareIcon: () => import('../../assets/icons/lucide/kanban-square-icon.svg?raw')
	};

	let svgContent = '';

	$: if (name && iconMap[name]) {
		loadIcon(name);
	}

	async function loadIcon(iconName: string) {
		try {
			const module = await iconMap[iconName]();
			svgContent = module.default
				.replace(/width="24"/, `width="${size}"`)
				.replace(/height="24"/, `height="${size}"`)
				.replace(/stroke="currentColor"/, `stroke="${color}"`)
				.replace(/stroke-width="2"/, `stroke-width="${strokeWidth}"`);
		} catch (error) {
			console.error(`Failed to load icon: ${iconName}`, error);
		}
	}
</script>

{#if svgContent}
	<div class="icon-container" role="img" aria-label={name}>
		<!-- Safe: SVG content from controlled icon imports -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html svgContent}
	</div>
{:else}
	<!-- Fallback or loading state -->
	<div class="icon-container icon-loading" style="width: {size}px; height: {size}px;">
		<div class="loading-placeholder"></div>
	</div>
{/if}

<style lang="scss">
	.icon-container {
		display: inline-flex;
		align-items: center;
		justify-content: center;

		:global(svg) {
			display: block;
			width: 100%;
			height: 100%;
			stroke: currentColor;
			fill: none;
			stroke-width: 2;
		}
	}

	.icon-loading {
		.loading-placeholder {
			width: 100%;
			height: 100%;
			color: red !important;
			background-color: var(--color-text-muted, #9ca3af);
			border-radius: 2px;
			animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
