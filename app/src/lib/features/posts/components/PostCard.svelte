<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type {
		PostWithInteractions,
		CommentWithInteractions,
		PostAttachment,
		AttachmentTagInfo
	} from '$lib/types/types.posts';
	import type { Tag, AIAgent } from '$lib/types/types';
	import { pocketbaseUrl } from '$lib/stores/pocketbase';
	import { currentUser } from '$lib/pocketbase';
	import PostReplyModal from '$lib/features/posts/components/PostReplyModal.svelte';
	import ShareModal from '$lib/components/modals/ShareModal.svelte';
	import { postStore } from '$lib/stores/postStore';
	import { flip } from 'svelte/animate';
	import { t } from '$lib/stores/translationStore';
	import { formatFileSize } from '$lib/utils/fileHandlers';
	import { slide, fly, fade } from 'svelte/transition';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import Avatar from '$lib/features/users/components/Avatar.svelte';
	import { analytics } from '$lib/stores/analyticsStore';
	import { getAgentAvatarUrl } from '$lib/features/agents/utils/agentAvatarUtils';
	import { getAudioStatesStore, cleanupAudioPlayer } from '$lib/utils/mediaHandlers';
	import AudioPlayer from '$lib/components/media/AudioPlayer.svelte';
	import VideoPlayer from '$lib/components/media/VideoPlayer.svelte';
	import { swipeGesture } from '$lib/utils/swipeGesture';
	import { clientTryCatch, fetchTryCatch, isFailure } from '$lib/utils/errorUtils';
	import { toast } from '$lib/utils/toastUtils';
	import { agentStore } from '$lib/stores/agentStore';
	import LocalAIAnalysisButton from '$lib/features/ai/components/analysis/LocalAIAnalysisButton.svelte';

	import PDFThumbnail from '$lib/features/pdf/components/PDFThumbnail.svelte';
	import PDFReader from '$lib/features/pdf/components/PDFReader.svelte';
	import { marked } from 'marked';

	export let post: PostWithInteractions | CommentWithInteractions;
	export let showActions: boolean = true;
	export let isRepost: boolean = false;
	export let isOwnRepost: boolean = false;
	export let isComment: boolean = false;

	export let hideHeaderOnScroll: boolean = false;
	export let selectedLocalModel: string = 'qwen2.5:0.5b';
	export const isQuote: boolean = false;

	$: htmlContent = marked(post.content);

	let showTooltip = false;
	let showShareModal = false;
	let showQuoteModal = false;
	let showTagsModal = false;
	let showAIAnalysisModal = false;
	let debugCount = 0;
	let showPDFReader = false;
	let currentPDFUrl = '';

	let tagsExpanded = false;
	let tagDetails: Tag[] = [];
	let loadingTags = false;
	let tagsLoaded = false;
	let agentsExpanded = false;
	let showLabels = false;
	let attachmentTags: Array<{
		attachmentId: string;
		tags: string[];
		analysis?: string;
		fileName: string;
	}> = [];
	let loadingAttachmentTags = false;
	let attachmentTagsLoaded = false;
	let agentsLoaded = false;

	$: postAgentIds = post.agents || [];
	$: availableAgents = $agentStore.agents;
	$: console.log('🤖 Store agents:', $agentStore.agents.length);
	$: activeAgents = availableAgents.filter((agent) => agent.status === 'active');

	$: hasPostTags = Array.isArray(post.tags) && post.tags.length > 0;
	$: hasAttachmentTags =
		post.attachments && post.attachments.some((att) => att.tags && att.tags.length > 0);

	$: postTagCount = Array.isArray(post.tags) ? post.tags.length : 0;

	$: attachmentTagCount = post.attachments
		? post.attachments.reduce((sum, att) => sum + (att.tags?.length || 0), 0)
		: 0;
	$: totalTagCount = postTagCount + attachmentTagCount;
	$: hasAnyTags = hasPostTags || hasAttachmentTags;
	$: {
		if (totalTagCount === 0) {
			tagsTitle = 'No tags';
		} else {
			const postTagText =
				post.tagCount > 0 ? `${post.tagCount} post tag${post.tagCount !== 1 ? 's' : ''}` : '';
			const attachmentTagCount = attachmentTags.reduce((sum, att) => sum + att.tags.length, 0);
			const attachmentTagText =
				attachmentTagCount > 0
					? `${attachmentTagCount} attachment tag${attachmentTagCount !== 1 ? 's' : ''}`
					: '';

			if (postTagText && attachmentTagText) {
				tagsTitle = `${postTagText} and ${attachmentTagText}`;
			} else {
				tagsTitle = postTagText || attachmentTagText;
			}
		}
	}

	$: postAssignedAgentIds = post.assignedAgents || [];
	$: postAssignedAgentObjects = postAssignedAgentIds
		.map((agentId) => activeAgents.find((agent) => agent.id === agentId))
		.filter((agent): agent is AIAgent => agent !== undefined);

	$: totalAssignedAgentIds = postAssignedAgentIds.length;
	$: assignedAgentCount = postAssignedAgentObjects.length;
	$: displayedAgents = postAssignedAgentObjects.slice(0, 5);
	$: agentsTitle =
		totalAssignedAgentIds === 0
			? 'No agents assigned'
			: assignedAgentCount === 0
				? `${totalAssignedAgentIds} agents (none active)`
				: assignedAgentCount === totalAssignedAgentIds
					? assignedAgentCount === 1
						? '1 active agent'
						: `${assignedAgentCount} active agents`
					: `${assignedAgentCount} of ${totalAssignedAgentIds} agents active`;
	function handleAgents() {
		if (!$currentUser) {
			toast.warning('Please sign in to view agents');
			return;
		}

		console.log('=== AGENT DEBUG ===');
		console.log('Post assigned agent IDs:', postAssignedAgentIds);
		console.log('Available agents in store:', availableAgents.length);
		console.log('Available agent details:', availableAgents);
		console.log('Active agents in store:', activeAgents.length);
		console.log('Active agent details:', activeAgents);
		console.log('Matched post assigned agents:', postAssignedAgentObjects);
		console.log('Assigned agent count:', assignedAgentCount);
		agentsExpanded = !agentsExpanded;
		console.log('Agents expanded:', agentsExpanded);
	}
	function handleAIAnalysis(event: CustomEvent) {
		console.log('AI Analysis complete:', event.detail);

		toast.success(`Analysis complete using ${event.detail.model}`); 
	}
	function toggleLabels() {
		showLabels = !showLabels;
	}
	$: isAgentReply = post.type === 'agent_reply' || !!post.agent;
	$: if (isAgentReply && post.agent && !agentData) {
		loadAgentData(post.agent);
	}
	function handleImageError(e: Event, agentName: string) {
		const target = e.target as HTMLImageElement;
		if (target) {
			console.warn('Failed to load avatar for', agentName, ':', target.src);
			target.style.display = 'none';
			const fallback = target.nextElementSibling as HTMLElement;
			if (fallback) {
				fallback.style.display = 'flex';
			}
		}
	}
	let agentData: AIAgent | null = null;

	async function loadAgentData(agentId: string) {
		try {
			const storeAgent = $agentStore.agents.find((a) => a.id === agentId);
			if (storeAgent) {
				agentData = storeAgent;
				return;
			}

			const response = await fetch(`/api/agents/${agentId}`, {
				credentials: 'include'
			});

			if (response.ok) {
				agentData = await response.json();
			}
		} catch (error) {
			console.error('Error loading agent data:', error);
		}
	}

	const dispatch = createEventDispatcher<{
		interact: { postId: string; action: 'upvote' | 'repost' | 'read' | 'share' };
		comment: { postId: string };
		quote: { content: string; attachments: File[]; quotedPostId: string };
		tagClick: { tag: Tag; postId: string };
	}>();
	const audioStatesStore = getAudioStatesStore();

	$: tagCount = post.tagCount || 0;
	$: hasTagIds = post.tags && post.tags.length > 0;

	function navigateToPost() {
		const postUrl = `/${post.author_username}/posts/${post.id}`;
		goto(postUrl);
	}

	function openPDFReader(attachmentData: PostAttachment) {
		currentPDFUrl = `${$pocketbaseUrl}/api/files/7xg05m7gr933ygt/${attachmentData.id}/${attachmentData.file_path}`;
		showPDFReader = true;
	}

	function closePDFReader() {
		showPDFReader = false;
		currentPDFUrl = '';

		document.body.style.overflow = '';
	}

	function getPDFUrl(attachmentData: PostAttachment) {
		return `${$pocketbaseUrl}/api/files/7xg05m7gr933ygt/${attachmentData.id}/${attachmentData.file_path}`;
	}
	function handleModelSelect(event: CustomEvent<{ model: string }>) {
		selectedLocalModel = event.detail.model;
		console.log('🔄 Model updated to:', selectedLocalModel);
	}
	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 60) return `${minutes}m`;

		if (hours < 24) return `${hours}h`;

		const day = date.getDate();
		const month = date.getMonth();
		const year = date.getFullYear();
		const currentYear = now.getFullYear();

		const monthKeys = [
			'january',
			'february',
			'march',
			'april',
			'may',
			'june',
			'july',
			'august',
			'september',
			'october',
			'november',
			'december'
		];

		const monthName = $t(`months.${monthKeys[month]}`) as string;

		if (year === currentYear) {
			return `${day} ${monthName}`;
		}

		return `${day}. ${monthName} ${year}`;
	}
	async function loadAgentsOnDemand() {
		if (agentsLoaded || $agentStore.isLoading) {
			console.log('🤖 Agents already loaded or loading, skipping...');
			return;
		}

		try {
			console.log('🤖 Loading agents on demand...');
			agentsLoaded = true;
			await agentStore.loadAgents();
			console.log('🤖 Agents loaded successfully');
		} catch (error) {
			console.error('🤖 Failed to load agents:', error);
			agentsLoaded = false;
		}
	}
	async function toggleAgentAssignment(agentId: string) {
		console.log('🤖 Toggling agent assignment:', agentId);

		try {
			const agent = activeAgents.find((a) => a.id === agentId);
			const isCurrentlyAssigned = postAssignedAgentIds.includes(agentId);

			if (agent) {
				console.log(`🤖 ${isCurrentlyAssigned ? 'Unassigning' : 'Assigning'} agent: ${agent.name}`);
			}

			analytics.trackAgentInteraction(
				isCurrentlyAssigned ? 'unassign' : 'assign',
				agentId,
				post.id
			);

			let newAssignedAgentIds: string[];
			if (isCurrentlyAssigned) {
				newAssignedAgentIds = postAssignedAgentIds.filter((id) => id !== agentId);
			} else {
				newAssignedAgentIds = [...postAssignedAgentIds, agentId];
			}

			const response = await fetch(`/api/posts/${post.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					assignedAgents: newAssignedAgentIds
				})
			});

			if (!response.ok) {
				throw new Error('Failed to update agent assignment');
			}

			post.assignedAgents = newAssignedAgentIds;

			const isAssigned = newAssignedAgentIds.includes(agentId);
			if (isAssigned) {
				toast.success(`${$t('agents.title')} ${agent?.name} ${$t('status.assigned')}`);

				if (!isCurrentlyAssigned) {
					try {
						await triggerAutoReplyForSpecificComment(post.id, agentId);
					} catch (error) {
						console.warn('🤖 Auto-reply failed:', error);
					}
				}
			} else {
				toast.success(`${$t('agents.title')} ${agent?.name} ${$t('status.unassigned')}`);
			}

			post = { ...post, assignedAgents: newAssignedAgentIds };
		} catch (error) {
			console.error('🤖 Error updating agent assignment:', error);
			toast.error('Failed to update agent assignment');
		}
	}

	async function triggerBatchAutoReply() {
		if (postAssignedAgentIds.length === 0) {
			toast.warning(`${$t('generic.no')} ${$t('agents.agents')} ${$t('status.assigned')}`);
			return;
		}

		try {
			console.log('🤖 Triggering batch auto-reply for all assigned agents...');

			analytics.trackEvent('batch_auto_reply_triggered', {
				post_id: post.id,
				agent_count: postAssignedAgentIds.length,
				agent_ids: postAssignedAgentIds
			});

			const result = await postStore.triggerAgentAutoReply(post.id, postAssignedAgentIds);

			if (result.skipped) {
				toast.info('Post already analyzed by agents');
				analytics.trackEvent('auto_reply_skipped', {
					post_id: post.id,
					reason: result.reason || 'unknown'
				});
			} else {
				const successCount = result.responses?.filter((r) => r.success).length || 0;
				const totalCount = result.responses?.length || 0;

				if (successCount === totalCount) {
					toast.success(`All ${successCount} agents replied successfully`);
				} else {
					toast.warning(`${successCount}/${totalCount} agents replied successfully`);
				}

				analytics.trackEvent('auto_reply_completed', {
					post_id: post.id,
					success_count: successCount,
					total_count: totalCount,
					success_rate: successCount / totalCount
				});

				if (successCount > 0 && shouldRedirectToPost()) {
					redirectToPost();
				}
			}
		} catch (error: unknown) {
			console.error('🤖 Error triggering batch auto-reply:', error);
			toast.error('Failed to trigger agent auto-reply');

			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

			analytics.trackEvent('auto_reply_error', {
				post_id: post.id,
				agent_count: postAssignedAgentIds.length,
				error: errorMessage
			});
		}
	}

	async function triggerAutoReplyForSpecificComment(commentId: string, agentId: string) {
		try {
			console.log('🤖 Triggering auto-reply API call:', { commentId, agentId });

			const response = await fetch(`/api/agents/${agentId}/auto-reply`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ postId: commentId })
			});

			console.log('🤖 Auto-reply API response:', {
				status: response.status,
				ok: response.ok
			});

			if (response.ok) {
				const result = await response.json();
				console.log('🤖 Auto-reply result:', result);

				if (result.success && !result.skipped) {
					const agent = activeAgents.find((a) => a.id === agentId);
					const agentName = agent?.name || 'Agent';
					toast.success(`${agentName} replied to comment`);

					if (shouldRedirectToPost()) {
						setTimeout(() => {
							redirectToPost();
						}, 1500);
					} else {
						setTimeout(() => {
							window.location.reload();
						}, 1000);
					}
				} else if (result.skipped) {
					console.log('🤖 Auto-reply skipped:', result.reason);
				}
			} else {
				const errorText = await response.text();
				console.error('🤖 Auto-reply API error:', errorText);
			}
		} catch (error) {
			console.error('Error triggering auto-reply for comment:', error);
		}
	}

	function shouldRedirectToPost(): boolean {
		const currentRoute = $page.route.id;
		const currentPath = $page.url.pathname;

		const isHomePage = currentRoute === '/' || currentPath === '/';
		const isDiscoverPage = currentPath.includes('/discover');
		const isFeedPage = currentPath.includes('/feed');
		const isTagPage = currentPath.includes('/tags/');

		const isAlreadyOnPostPage = currentPath.includes(`/${post.author_username}/posts/${post.id}`);

		console.log('🔍 Redirect check:', {
			currentRoute,
			currentPath,
			isHomePage,
			isDiscoverPage,
			isFeedPage,
			isTagPage,
			isAlreadyOnPostPage,
			shouldRedirect:
				(isHomePage || isDiscoverPage || isFeedPage || isTagPage) && !isAlreadyOnPostPage
		});

		return (isHomePage || isDiscoverPage || isFeedPage || isTagPage) && !isAlreadyOnPostPage;
	}

	function redirectToPost() {
		const postUrl = `/${post.author_username}/posts/${post.id}`;
		console.log('🔗 Redirecting to post:', postUrl);

		goto(postUrl, {
			replaceState: false,
			noScroll: false
		});
	}

	async function checkForNewCommentsAndTriggerReplies() {
		console.log('🤖 Checking for new comments that need auto-replies...');

		try {
			const response = await fetch(`/api/posts/${post.id}/children?latest=true&limit=10`, {
				credentials: 'include'
			});

			if (response.ok) {
				const data = await response.json();
				const newComments = data.children || [];

				const userComments = newComments.filter((comment: any) => {
					const isAgentReply = comment.agent || comment.type === 'agent_reply';
					return !isAgentReply;
				});

				if (userComments.length > 0 && postAssignedAgents.length > 0) {
					console.log(
						'🤖 Triggering auto-replies for comments:',
						userComments.map((c: CommentWithInteractions) => c.id)
					);

					let repliesTriggered = 0;

					for (const comment of userComments) {
						for (const agentId of postAssignedAgents) {
							await triggerAutoReplyForSpecificComment(comment.id, agentId);
							repliesTriggered++;
						}
					}

					if (repliesTriggered > 0 && shouldRedirectToPost()) {
						setTimeout(() => {
							redirectToPost();
						}, 2000);
					}
				}
			}
		} catch (error) {
			console.error('Error checking for new comments:', error);
		}
	}

	function handleInteraction(action: 'upvote' | 'repost' | 'read') {
		dispatch('interact', { postId: post.id, action });
	}

	function handleComment() {
		dispatch('comment', { postId: post.id });
	}

	function handleShare() {
		showShareModal = true;
	}
	async function handleTags() {
		if (totalTagCount === 0) return;

		tagsExpanded = !tagsExpanded;

		if (tagsExpanded && (!tagsLoaded || !attachmentTagsLoaded)) {
			await Promise.all([
				hasAttachmentTags && !attachmentTagsLoaded ? fetchAttachmentTags() : Promise.resolve()
			]);
		}
	}
	async function fetchAttachmentTags() {
		if (!post.attachments || attachmentTagsLoaded || loadingAttachmentTags) return;

		loadingAttachmentTags = true;
		console.log('🏷️ Fetching attachment tags for post:', post.id);

		try {
			const attachmentsWithTags = await Promise.all(
				post.attachments.map(async (attachment): Promise<AttachmentTagInfo | null> => {
					if (!attachment.tags || attachment.tags.length === 0) {
						return null;
					}

					try {
						const response = await fetch(
							`/api/posts/${post.id}/attachment?attachmentId=${attachment.id}`,
							{ credentials: 'include' }
						);

						if (!response.ok) {
							console.warn(
								`Failed to fetch attachment ${attachment.id} tags:`,
								response.statusText
							);
							return {
								attachmentId: attachment.id,
								tags: attachment.tags || [],
								analysis: attachment.analysis,
								fileName: attachment.original_name
							};
						}

						const result = await response.json();

						if (result.success && result.attachment) {
							return {
								attachmentId: attachment.id,
								tags: result.attachment.tags || [],
								analysis: result.attachment.analysis,
								fileName: attachment.original_name
							};
						} else {
							return {
								attachmentId: attachment.id,
								tags: attachment.tags || [],
								analysis: attachment.analysis,
								fileName: attachment.original_name
							};
						}
					} catch (error) {
						console.error(`Error fetching attachment ${attachment.id} tags:`, error);

						return {
							attachmentId: attachment.id,
							tags: attachment.tags || [],
							analysis: attachment.analysis,
							fileName: attachment.original_name
						};
					}
				})
			);

			attachmentTags = attachmentsWithTags.filter(
				(item): item is AttachmentTagInfo => item !== null
			);
			attachmentTagsLoaded = true;
			console.log('🏷️ Loaded attachment tags:', attachmentTags);
		} catch (error) {
			console.error('🏷️ Error fetching attachment tags:', error);
			attachmentTags = [];
		} finally {
			loadingAttachmentTags = false;
		}
	}
	function handleAttachmentTagClick(tag: string, attachmentId: string, event: MouseEvent) {
		event.stopPropagation();
		console.log('🏷️ Clicked attachment tag:', tag, 'from attachment:', attachmentId);
	}
	function handleTagClick(tag: Tag, event: MouseEvent) {
		event.stopPropagation();
		dispatch('tagClick', { tag, postId: post.id });
	}

	function getTagColor(tag: Tag): string {
		if (tag.color) return tag.color;

		const colors = [
			'#3b82f6',
			'#ef4444',
			'#10b981',
			'#f59e0b',
			'#8b5cf6',
			'#06b6d4',
			'#84cc16',
			'#f97316'
		];
		const index = tag.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[index % colors.length];
	}

	async function handleCopyLink() {
		try {
			const result = await postStore.sharePost(post.id, post.author_username);

			if (result.copied) {
				toast.success(result.message || 'Link copied to clipboard!');
			} else {
				console.log('🚀 Normal copy failed, trying aggressive copy...');
				const aggressiveSuccess = await tryAggressiveCopy(result.url);

				if (aggressiveSuccess) {
					if ('shareCount' in result && result.shareCount !== undefined) {
						toast.success('Post shared and link copied to clipboard!');
					} else {
						toast.success('Link copied to clipboard!');
					}
				} else {
					if ('shareCount' in result && result.shareCount !== undefined) {
						toast.success('Post shared successfully!');
						toast.warning('Could not copy link automatically', 3000);
					} else {
						toast.error('Could not copy link to clipboard');
					}
				}
			}
		} catch (error) {
			console.error('Error sharing post:', error);
			toast.error('Sharing failed');
		}

		showShareModal = false;
	}

	async function tryAggressiveCopy(text: string): Promise<boolean> {
		console.log('🚀 Trying aggressive copy methods...');

		try {
			await navigator.clipboard.writeText(text);
			console.log('✅ Clipboard API worked in aggressive context');
			return true;
		} catch (e) {
			console.log('❌ Clipboard API still blocked');
		}

		try {
			const input = document.createElement('input');
			input.type = 'text';
			input.value = text;
			input.style.cssText = 'position: absolute; left: -9999px; top: -9999px; opacity: 0;';

			document.body.appendChild(input);

			await new Promise((resolve) => setTimeout(resolve, 50));

			input.focus();
			input.select();
			input.setSelectionRange(0, text.length);

			await new Promise((resolve) => setTimeout(resolve, 10));

			const success = document.execCommand('copy');
			document.body.removeChild(input);

			if (success) {
				console.log('✅ Aggressive copy method succeeded');
				return true;
			} else {
				console.log('❌ Aggressive copy method failed: execCommand returned false');
			}
		} catch (e) {
			console.log('❌ Aggressive copy method failed with error:', e);
		}

		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.cssText = 'position: fixed; left: -9999px; top: -9999px; opacity: 0;';

			document.body.appendChild(textarea);
			await new Promise((resolve) => setTimeout(resolve, 50));

			textarea.focus();
			textarea.select();

			await new Promise((resolve) => setTimeout(resolve, 10));

			const success = document.execCommand('copy');
			document.body.removeChild(textarea);

			if (success) {
				console.log('✅ Textarea copy method succeeded');
				return true;
			}
		} catch (e) {
			console.log('❌ Textarea copy method failed:', e);
		}

		return false;
	}

	function handleQuote() {
		showQuoteModal = true;
	}

	function handleQuoteSubmit(
		event: CustomEvent<{ content: string; attachments: File[]; quotedPostId: string }>
	) {
		dispatch('quote', event.detail);
		showQuoteModal = false;
	}

	/*
	 * $: {
	 *     debugCount++;
	 *     console.log(`PostCard render #${debugCount} for post ${post.id}:`, {
	 *         upvoteCount: post.upvoteCount,
	 *         calculatedUpvoteCount: upvoteCount,
	 *         upvote: post.upvote,
	 *         fullPost: post
	 *     });
	 * }
	 */

	$: upvoteCount =
		post.upvoteCount !== undefined && post.upvoteCount !== null ? post.upvoteCount : 0;
	$: shareTitle = $t('generic.share') as string;
	$: upvoteTitle = $t('posts.postUpvote') as string;
	$: repostTitle = $t('posts.repost') as string;
	$: tagsTitle = tagsExpanded ? 'Hide tags' : `Show ${tagCount} tags`;

	$: postAuthor = {
		id: post.user,
		avatar: post.author_avatar,
		collectionId: '_pb_users_auth_'
	};

	$: expandedUser = post.expand?.user
		? {
				id: post.expand.user.id,
				avatar: post.expand.user.avatar,
				collectionId: '_pb_users_auth_'
			}
		: null;

	$: {
		console.log('🔍 FULL POST DEBUG:', {
			postId: post.id,
			userId: post.user,
			author_name: post.author_name,
			author_username: post.author_username,
			author_avatar: post.author_avatar,
			expand: post.expand,
			expand_user: post.expand?.user,
			isGuest: !$currentUser,
			fullPost: post
		});
	}

	$: avatarUserData = {
		id: post.user || 'guest',
		avatar: post.author_avatar || post.expand?.user?.avatar || null,
		username: post.author_username || post.expand?.user?.username || 'user',
		name:
			post.author_name ||
			post.expand?.user?.name ||
			post.author_username ||
			post.expand?.user?.username ||
			'User'
	};
	$: if (agentsExpanded && !agentsLoaded && !$agentStore.isLoading) {
		console.log('🤖 Agents expanded for first time, loading...');
		loadAgentsOnDemand();
	}

	$: isUsernameRoute = $page.route.id === '/[username]';

	onDestroy(() => {
		if (post.attachments) {
			post.attachments.forEach((attachment) => {
				if (attachment.file_type === 'audio') {
					cleanupAudioPlayer(attachment.id);
				}
			});
		}
	});
	let lastCommentCount = 0;
	let commentCheckDebounce: ReturnType<typeof setTimeout>;

	$: postAssignedAgents = post.assignedAgents || [];
	$: console.log('🤖 REACTIVE CHECK:', {
		postId: post.id,
		commentCount: post.commentCount,
		hasAssignedAgents: !!post.assignedAgents,
		assignedAgentCount: postAssignedAgents.length,
		assignedAgents: postAssignedAgents,
		shouldTrigger: !!(post.commentCount && postAssignedAgents.length > 0)
	});

	$: if (post.commentCount && postAssignedAgents.length > 0) {
		console.log('🤖 Comment count changed:', {
			current: post.commentCount,
			last: lastCommentCount,
			hasAssignedAgents: postAssignedAgents.length,
			postId: post.id
		});

		if (post.commentCount > lastCommentCount && lastCommentCount > 0) {
			console.log('🤖 New comment detected, scheduling auto-reply check...');
			clearTimeout(commentCheckDebounce);
			commentCheckDebounce = setTimeout(() => {
				checkForNewCommentsAndTriggerReplies();
			}, 2000);
		}
		lastCommentCount = post.commentCount;
	}
</script>

<article class="post-card" class:comment={isComment}>
	{#if isRepost}
		<div class="repost-indicator">
			<Icon name="Repeat" size={14} />
			<span>{$t('posts.repostedBy')} {post.author_name || post.author_username}</span>
		</div>
	{:else if isOwnRepost}
		<div class="repost-indicator own-repost">
			<Icon name="Repeat" size={14} />
			<span>{$t('posts.youReposted')}</span>
		</div>
	{/if}
	{#if !isUsernameRoute}
		<div class="post-header" class:scrolled={hideHeaderOnScroll} class:agent-reply={isAgentReply}>
			{#if isAgentReply && agentData}
				<!-- Agent Reply Header -->

				<div class="post-avatar">
					{#if agentData.avatar}
						<img src={getAgentAvatarUrl(agentData)} alt="Agent avatar" class="avatar" />
					{:else}
						<div class="post-avatar-placeholder">
							<Icon name="Bot" size={20} />
						</div>
					{/if}
				</div>

				<div class="agent-info">
					<div class="post-author">{agentData.name || 'AI Agent'}</div>
					<div class="post-role">{agentData.role || 'assistant'}</div>
				</div>
			{:else}
				<!-- Regular User Post Header -->
				<a href="/{post.author_username}" class="avatar-link" class:hidden={hideHeaderOnScroll}>
					<Avatar
						user={{
							id: post.user || 'guest',
							name: post.author_name || post.expand?.user?.name,
							username:
								post.author_username ||
								post.expand?.user?.username ||
								`user_${(post.user || 'guest').slice(-4)}`,
							avatar: post.author_avatar || post.expand?.user?.avatar
						}}
						size={40}
						className="post-avatar"
					/>
				</a>
				<a
					href="/{post.author_username || post.expand?.user?.username}"
					class="author-link"
					class:hidden={hideHeaderOnScroll}
				>
					<div class="post-author">
						{post.author_name ||
							post.author_username ||
							post.expand?.user?.name ||
							post.expand?.user?.username ||
							'Unknown User'}
					</div>
				</a>
			{/if}

			<div class="post-meta">
				{#if isAgentReply}
					<div class="auto-reply-badge">
						<Icon name="PlugZap" size={16} />
						{$t('agents.autoReply')}
					</div>
				{/if}
				<div class="post-timestamp">{formatTimestamp(post.created)}</div>
			</div>
		</div>
	{:else}
		<!-- Username route - simplified header -->
		<div class="post-header" class:scrolled={hideHeaderOnScroll} class:agent-reply={isAgentReply}>
			{#if isAgentReply}
				<div class="agent-reply-indicator">
					<Icon name="Bot" size={14} />
					<span>Agent Reply</span>
				</div>
			{/if}

			<div class="post-meta">
				{#if isAgentReply}
					<div class="auto-reply-badge">
						<Icon name="Zap" size={12} />
						{$t('agents.autoReply')}
					</div>
				{/if}
				<div class="post-timestamp">{formatTimestamp(post.created)}</div>
			</div>
		</div>
	{/if}

	<!-- {#if showActions}
		<button class="post-options">
			<Icon name="MoreHorizontal" size={16} />
		</button>
	{/if} -->

	{#if !isComment}
		<div class="post-content">
			<a
				href="/{post.author_username}/posts/{post.id}"
				class="post-content-link"
				use:swipeGesture={{
					threshold: 100,
					enableVisualFeedback: true,
					onSwipeLeft: () => {
						console.log('🟢 Post content swiped right - navigating to post');
						navigateToPost();
					},
					onSwipeDown: () => {
						console.log('🟢 Post content swiped down - opening comment');
						handleComment();
					},
					onSwipeUp: () => {
						console.log('🟢 Post content swiped up - opening share');
						handleShare();
					}
				}}
			>
				{#if post.content}
					{#await post.content}
						<div class="spinner-container">
							<div class="spinner"></div>
						</div>
					{:then content}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html marked(content)}
					{:catch}
						<div>Error loading content</div>
					{/await}
				{:else}
					<div>No content</div>
				{/if}
			</a>

			{#if post.attachments && post.attachments.length > 0}
				<div class="post-attachments">
					{#each post.attachments as attachment}
						<div class="attachment">
							{#if attachment.file_type === 'image'}
								<a href="/{post.author_username}/posts/{post.id}" class="attachment-link">
									<img
										src="{$pocketbaseUrl}/api/files/7xg05m7gr933ygt/{attachment.id}/{attachment.file_path}"
										alt={attachment.original_name}
										class="attachment-image"
										title={attachment.analysis}
										transition:fade
									/>
								</a>
							{:else if attachment.file_type === 'video'}
								<div
									class="attachment-video"
									role="button"
									tabindex="0"
									on:click|stopPropagation
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
										}
									}}
								>
									<VideoPlayer
										src="{$pocketbaseUrl}/api/files/7xg05m7gr933ygt/{attachment.id}/{attachment.file_path}"
										mimeType={attachment.mime_type}
										autoplay={!isComment}
										showControls={true}
										loop={true}
										muted={true}
										threshold={0.8}
										className="post-video-player"
										enableMLDetection={true}
										showMLControls={true}
										showPerformanceMonitor={true}
										autoTagging={true}
										attachmentId={attachment.id}
										postId={post.id}
										minTaggingConfidence={0.7}
										onTagsUpdated={(tags) => {
											console.log('Video tags updated for attachment:', attachment.id, tags);
										}}
									/>
								</div>
							{:else if attachment.file_type === 'audio'}
								<div
									class="attachment-audio"
									role="button"
									tabindex="0"
									on:click|stopPropagation
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
										}
									}}
								>
									<AudioPlayer
										attachmentId={attachment.id}
										audioSrc="{$pocketbaseUrl}/api/files/7xg05m7gr933ygt/{attachment.id}/{attachment.file_path}"
										mimeType={attachment.mime_type}
										fileName={attachment.original_name}
									/>
								</div>
							{:else if attachment.file_type === 'document'}
								<a href="/{post.author_username}/posts/{post.id}" class="attachment-link">
									<div class="attachment-file">
										{#if attachment.mime_type === 'application/pdf'}
											<div class="pdf-attachment">
												<PDFThumbnail
													pdfUrl={getPDFUrl(attachment)}
													onClick={() => openPDFReader(attachment)}
												/>
												<div class="pdf-info">
													<span class="pdf-name">{attachment.original_name}</span>
													{#if attachment.file_size}
														<span class="filesize">({formatFileSize(attachment.file_size)})</span>
													{/if}
												</div>
											</div>
										{:else}
											<a href="/{post.author_username}/posts/{post.id}" class="attachment-link">
												<div class="attachment-file">
													<Icon name="Paperclip" size={16} />
													<span>{attachment.original_name}</span>
													{#if attachment.file_size}
														<span class="filesize">({formatFileSize(attachment.file_size)})</span>
													{/if}
												</div>
											</a>
										{/if}
									</div>
								</a>
							{:else}
								<a href="/{post.author_username}/posts/{post.id}" class="attachment-link">
									<div class="attachment-file">
										<Icon name="Paperclip" size={16} />
										<span>{attachment.original_name}</span>
										{#if attachment.file_size}
											<span class="filesize">({formatFileSize(attachment.file_size)})</span>
										{/if}
									</div>
								</a>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Comments section stays the same -->
		<div class="post-content">
			{#if post.content}
				{#await post.content}
					<div class="spinner-container">
						<div class="spinner"></div>
					</div>
				{:then content}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html marked(content)}
				{:catch}
					<div>Error loading content</div>
				{/await}
			{:else}
				<div>No content</div>
			{/if}
			{#if post.attachments && post.attachments.length > 0}
				<div class="post-attachments">
					{#each post.attachments as attachment}
						<div class="attachment">
							{#if attachment.file_type === 'image'}
								<a href="/{post.author_username}/posts/{post.id}" class="attachment-link">
									<img
										src="{$pocketbaseUrl}/api/files/7xg05m7gr933ygt/{attachment.id}/{attachment.file_path}"
										alt={attachment.original_name}
										class="attachment-image"
									/>
								</a>
							{:else if attachment.file_type === 'video'}
								<div
									class="attachment-video"
									role="button"
									tabindex="0"
									on:click|stopPropagation
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
										}
									}}
								>
									<VideoPlayer
										src="{$pocketbaseUrl}/api/files/7xg05m7gr933ygt/{attachment.id}/{attachment.file_path}"
										mimeType={attachment.mime_type}
										autoplay={!isComment}
										showControls={true}
										loop={true}
										muted={true}
										threshold={0.8}
										className="post-video-player"
									/>
								</div>
							{:else if attachment.file_type === 'audio'}
								<div
									class="attachment-audio"
									role="button"
									tabindex="0"
									on:click|stopPropagation
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
										}
									}}
								>
									<AudioPlayer
										attachmentId={attachment.id}
										audioSrc="{$pocketbaseUrl}/api/files/7xg05m7gr933ygt/{attachment.id}/{attachment.file_path}"
										mimeType={attachment.mime_type}
										fileName={attachment.original_name}
									/>
								</div>
							{:else}
								<a href="/{post.author_username}/posts/{post.id}" class="attachment-link">
									<div class="attachment-file">
										<Icon name="Paperclip" size={16} />
										<span>{attachment.original_name}</span>
										{#if attachment.file_size}
											<span class="filesize">({formatFileSize(attachment.file_size)})</span>
										{/if}
									</div>
								</a>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Expanded tags section -->
	{#if tagsExpanded && totalTagCount > 0}
		<div class="tags-expansion" transition:slide={{ duration: 200 }}>
			<!-- Post Tags Section -->
			{#if hasPostTags}
				<div class="tags-section post-tags">
					<!-- <div class="tags-section-header">
					<Icon name="FileText" size={14} />
					<span class="section-title">Post Tags ({post.tagCount})</span>
				</div> -->

					{#if loadingTags}
						<div class="loading-tags">
							<div class="loading-spinner"></div>
							<span>Loading post tags...</span>
						</div>
					{:else if tagDetails.length > 0}
						<div class="tags-list">
							{#each tagDetails as tag (tag.id)}
								<button
									class="tag-chip post-tag"
									style="--tag-color: {getTagColor(tag)}"
									on:click={(e) => handleTagClick(tag, e)}
									title="Click to filter posts by '{tag.name}'"
								>
									<span class="tag-name">#{tag.name}</span>
								</button>
							{/each}
						</div>
					{:else}
						<div class="tags-list">
							{#each post.tags as tagId (tagId)}
								<span class="tag-chip post-tag fallback">
									<span class="tag-name">#{tagId}</span>
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Attachment Tags Section -->
			{#if hasAttachmentTags}
				<div class="tags-section attachment-tags">
					{#if loadingAttachmentTags}
						<div class="loading-tags">
							<div class="loading-spinner"></div>
							<span>Loading attachment tags...</span>
						</div>
					{:else if attachmentTags.length > 0}
						<div class="attachment-tags-list">
							{#each attachmentTags as attachment (attachment.attachmentId)}
								{#if attachment.tags.length > 0}
									<div class="attachment-tag-group">
										<div class="tags-list">
											{#each attachment.tags as tag (tag)}
												<button
													class="tag-chip attachment-tag"
													on:click={(e) =>
														handleAttachmentTagClick(tag, attachment.attachmentId, e)}
													title="Attachment tag: {tag}"
												>
													<!-- <span class="tag-indicator"></span> -->
													<span class="tag-name">
														<span class="indicator"> * </span>
														{tag}
													</span>
												</button>
											{/each}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<!-- Fallback: show tags directly from post.attachments if async loading failed -->
						<div class="attachment-tags-list">
							{#each post.attachments || [] as attachment (attachment.id)}
								{#if attachment.tags && attachment.tags.length > 0}
									<div class="attachment-tag-group">
										<div class="attachment-info">
											<Icon name="File" size={12} />
											<span class="attachment-name">{attachment.original_name}</span>
											<span class="tag-count-badge">{attachment.tags.length}</span>
										</div>

										<div class="tags-list">
											{#each attachment.tags as tag (tag)}
												<button
													class="tag-chip attachment-tag"
													on:click={(e) => handleAttachmentTagClick(tag, attachment.id, e)}
													title="Attachment tag: {tag}"
												>
													<span class="tag-indicator"></span>
													<span class="tag-name">{tag}</span>
												</button>
											{/each}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if !hasPostTags && !hasAttachmentTags}
				<div class="no-tags-message">
					<span>No tags available</span>
				</div>
			{/if}
		</div>
	{/if}
	<div class="actions-container">
		{#if agentsExpanded}
			<div class="agents-container">
				<div class="agents-block">
					<div
						class="agents-row"
						class:analyzed={showAIAnalysisModal}
						transition:slide={{ duration: 200 }}
					>
						{#if activeAgents.length === 0}
							<div class="no-agents-message">
								<p>No active agents available</p>
								<p><small>Total agents in store: {availableAgents.length}</small></p>
							</div>
						{:else}
							{#each activeAgents.slice(0, 5) as agent (agent.id)}
								<div
									class="agent-avatar clickable"
									class:assigned={postAssignedAgentIds.includes(agent.id)}
									class:analyzing={agent.status === 'analyzing'}
									title="{agent.name} - Click to {postAssignedAgentIds.includes(agent.id)
										? 'unassign'
										: 'assign'}"
									on:click={() => toggleAgentAssignment(agent.id)}
									on:keydown={(e) => e.key === 'Enter' && toggleAgentAssignment(agent.id)}
									role="button"
									tabindex="0"
									animate:flip={{ duration: 200 }}
								>
									{#if agent.avatar}
										<img
											src={getAvatarUrl(agent)}
											alt={agent.name}
											class="avatar-image"
											on:error={(e) => handleImageError(e, agent.name)}
										/>
										<!-- Fallback shown when image fails to load -->
										<div class="avatar-fallback" style="display: none;">
											{agent.name.charAt(0).toUpperCase()}
										</div>
									{:else}
										<div class="avatar-fallback">
											{agent.name.charAt(0).toUpperCase()}
										</div>
									{/if}
									<span class="agent-name">{agent.name}</span>
									{#if postAssignedAgentIds.includes(agent.id)}
										<div class="assigned-indicator">
											{#if agent.status === 'analyzing'}
												<Icon name="Loader2" size={12} />
											{:else}
												✓
											{/if}
										</div>
									{/if}
								</div>
							{/each}

							{#if activeAgents.length > 5}
								<div
									class="agent-overflow"
									title={`+${activeAgents.length - 5} more agents available`}
								>
									<span class="overflow-count">+{activeAgents.length - 5}</span>
								</div>
							{/if}
						{/if}
					</div>

					<div class="agents-info">
						{#if postAssignedAgentIds.length > 0}
							<div class="agents-summary">
								<span>{postAssignedAgentIds.length} {$t('status.assigned')}</span>
								<!-- Auto-reply control buttons -->
								<button
									class="auto-reply-btn"
									on:click={triggerBatchAutoReply}
									title="Trigger auto-reply for all assigned agents"
								>
									<Icon name="MessageSquare" size={14} />
									{$t('agents.autoReply')}
								</button>
							</div>
						{/if}
						<!-- <div class="agents-header">
			<span class="agents-title">{$t('agents.agents')}</span> 
			<span class="active">{$t('status.active')}: {activeAgents.length}</span>
			<span class="inactive">{$t('status.total')}: {availableAgents.length}</span>

		</div> -->
					</div>
				</div>
			</div>
		{/if}
		<LocalAIAnalysisButton
			bind:isOpen={showAIAnalysisModal}
			on:close={() => (showAIAnalysisModal = false)}
			{post}
			selectedModel={selectedLocalModel}
			on:analyzed={handleAIAnalysis}
		/>
	</div>
	{#if showActions}
		<div class="post-actions">
			<button class="action-button comment" title="Comment" on:click={handleComment}>
				<Icon name="MessageSquare" size={16} />
				<span>{post.commentCount || 0}</span>
			</button>

			<button
				class="action-button upvote"
				class:active={post.upvote}
				on:click={() => handleInteraction('upvote')}
				title={upvoteTitle}
			>
				<Icon name="Heart" size={16} />
				<span>{upvoteCount}</span>
			</button>

			<div class="action-wrapper">
				<button
					class="action-button tags"
					class:expanded={tagsExpanded}
					class:has-tags={totalTagCount > 0}
					class:no-tags={totalTagCount === 0}
					title={tagsTitle}
					on:click={handleTags}
					disabled={totalTagCount === 0}
				>
					<Icon name="TagsIcon" size={16} />
					<span class="tag-count">{totalTagCount}</span>

					{#if totalTagCount > 0}
						<span class="expand-icon">
							{#if tagsExpanded}
								<Icon name="ChevronDown" size={12} />
							{:else}
								<Icon name="ChevronRight" size={12} />
							{/if}
						</span>
					{/if}
				</button>
				<button
					class="action-button agents"
					class:expanded={agentsExpanded}
					class:has-agents={assignedAgentCount > 0}
					class:no-agents={assignedAgentCount === 0}
					title={agentsTitle}
					on:click={handleAgents}
				>
					<Icon name="Bot" size={16} />
					<!-- <span>Agents</span> -->
					{#if agentsExpanded}
						{$t('agents.agents')}
						<span class="agent-count">({activeAgents.length})</span>
					{:else}
						<span class="agent-count">{activeAgents.length}</span>
					{/if}

					<span class="expand-icon">
						{#if agentsExpanded}
							<Icon name="ChevronDown" size={12} />
						{:else}
							<Icon name="ChevronRight" size={12} />
						{/if}
					</span>
				</button>
				<button
					class="action-button ai"
					class:active={showAIAnalysisModal}
					on:click={() => (showAIAnalysisModal = !showAIAnalysisModal)}
					title="Analyze with Local AI"
					disabled={!post.content?.trim()}
				>
					<Icon name="Brain" size={12} />
					{#if showAIAnalysisModal}
						{$t('agents.analysis')}
					{:else}
						<span>AI tools</span>
					{/if}
				</button>
			</div>
			<div class="action-wrapper">
				<button
					class="action-button repost"
					class:active={post.repost}
					on:click={() => handleInteraction('repost')}
					title={repostTitle}
				>
					<Icon name="Repeat" size={16} />
					<span>{post.repostCount || 0}</span>
				</button>
				<button
					class="action-button share"
					class:shared={post.share}
					title={shareTitle}
					on:click={handleShare}
				>
					<Icon name="Share" size={16} />
					<span>{(post.shareCount || 0) + (post.quoteCount || 0)}</span>
					{#if showTooltip}
						<span class="tooltip">{$t('generic.copiedLink')} </span>
					{/if}
				</button>
				<!-- Read indicator -->
				<div class="action-button read" title="{post.readCount || 0} readers">
					<Icon name="EyeIcon" size={14} />
					<span class="read-count">{post.readCount || 0}</span>
				</div>
			</div>
		</div>
	{/if}
</article>
{#if showPDFReader}
	<PDFReader pdfUrl={currentPDFUrl} onClose={closePDFReader} enableAI={true} />
{/if}

<ShareModal
	bind:isOpen={showShareModal}
	{post}
	on:close={() => (showShareModal = false)}
	on:copyLink={handleCopyLink}
	on:quote={handleQuote}
/>

<!-- Quote Modal -->
<PostReplyModal
	bind:isOpen={showQuoteModal}
	{post}
	on:close={() => (showQuoteModal = false)}
	on:quote={handleQuoteSubmit}
/>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;

	* {
		font-family: var(--font-family);
	}
	.tags-list {
		display: flex;
		flex-wrap: wrap;
		flex-direction: row;
		align-items: flex-end;
		justify-content: flex-end;
		height: auto;
		gap: 0.25rem;
	}
	.tag-chip.attachment-tag {
		width: auto;
		& .tag-name {
			& .indicator {
				color: var(--tertiary-color);
				font-weight: 800;
				font-size: auto;
			}
		}
		&:hover {
			max-width: 400px;
			& .tag-name {
				color: var(--tertiary-color);
			}
		}
	}
	.actions-container {
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
	}
	.auto-reply-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: var(--primary-color);
		color: var(--text-color);
		border-radius: 1rem;
		font-size: 0.8rem;
	}
	.tag-chip {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.25rem 0.5rem;
		border-radius: 3rem;
		background: transparent;
		border: 1px solid transparent;
		font-style: italic;
		color: var(--placeholder-color);
		white-space: nowrap;
		max-width: 100px;
		transition: all 0.2s ease;

		&:hover {
			width: auto;
			max-width: auto;
			overflow: visible;
			padding: 0.25rem 2rem;
			background: var(--primary-color);

			& span.tag-name {
				font-style: italic;
				font-size: 0.8rem;
				text-overflow: unset;
				white-space: nowrap;
				overflow: visible;
				width: auto;
				color: var(--placeholder-color);
			}
		}
		& span.tag-name {
			font-style: italic;
			font-size: 0.8rem;
			text-overflow: ellipsis;
			white-space: nowrap;
			overflow: hidden;

			color: var(--placeholder-color);
		}
	}
	button.auto-reply-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: var(--primary-color);
		color: var(--text-color);
		border: 1px solid var(--line-color);
		border-radius: 1rem;
		cursor: pointer;
		opacity: 0.5;
		transition: all 0.2s ease;
		&:hover {
			opacity: 1;
		}
	}
	.post-card {
		border-radius: 1rem 1rem 0 0;

		box-shadow: rgba(255, 255, 255, 0.05) 0 -100px 200px 20px;

		padding: 0;
		padding-top: 1rem;
		transition: all 0.2s ease;
		&:last-child {
			border-bottom: none;
		}
	}

	.post-header {
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		margin: 0;
		height: auto;
		gap: 0.75rem;
		user-select: none;
	}
	.post-header.scrolled {
		padding: 0;
		& .avatar-link {
			display: none;
		}
	}

	/* Avatar link styles */
	.avatar-link {
		text-decoration: none;
		border-radius: 50%;
		overflow: hidden;
		transition: transform 0.2s ease;
	}

	.avatar-link:hover {
		transform: scale(1.05);
	}
	.avatar-link.hidden,
	.author-link.hidden {
		opacity: 0;
		transform: translateY(-10px);
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
		pointer-events: none;
	}
	.post-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		& img {
			width: 40px;
			height: 40px;
			border-radius: 50%;
			object-fit: cover;
		}
	}

	.post-avatar-placeholder {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background-color: var(--bg-color);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Author link styles */
	.author-link {
		text-decoration: none;
		color: inherit;
		display: inline-block;
		transition: color 0.2s ease;
	}

	.author-link:hover {
		color: var(--primary-color);
	}
	.agent-info {
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 0;
		gap: 0.5rem;
	}
	.post-author {
		font-weight: 600;
		color: var(--text-color);
		font-size: 0.95rem;
	}

	.post-role {
		font-weight: 200;
		font-size: 0.7rem;
		background-color: var(--secondary-color);
		padding: 0.25rem 0.5rem;
		border-radius: 2rem;
		letter-spacing: 0.1rem;
		text-transform: capitalize;

		color: var(--placeholder-color);
	}

	.author-link:hover .post-author {
		color: var(--tertiary-color);
	}
	.post-meta {
		display: flex;
		flex-direction: row;
		align-items: center;

		justify-content: flex-end;
		gap: 1rem;
		flex: 1;
	}

	.post-timestamp {
		color: var(--placeholder-color);
		font-size: 0.85rem;
		display: flex;
		justify-content: flex-end;
		margin-right: 0.5rem;
		width: auto;
	}

	.post-options {
		background: none;
		border: none;
		color: var(--placeholder-color);
		padding: 4px;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.post-options:hover {
		background: var(--line-color);
		color: var(--text-color);
	}

	/* Post content link styles */
	.post-content-link {
		text-decoration: none;
		color: inherit;
		display: block;
		transition: all 0.2s ease;
		border-radius: 8px;
		padding: 0 1rem;

		&:hover {
			color: var(--tertiary-color);
		}
	}

	.post-content-link:hover {
		background: rgba(var(--primary-color-rgb), 0.05);
	}

	.post-content {
		color: var(--text-color);
		line-height: 1.5;
		margin-bottom: 0;
		padding: 0.5rem;
		text-align: left;
	}

	.post-attachments {
		margin-top: 1rem;
		display: flex;
		justify-content: flex-start;
		flex-wrap: wrap;
		gap: 8px;
	}

	.attachment-image {
		margin-left: 1rem;
		max-width: 100%;
		height: 100%;
		max-height: 400px;
		border-radius: 8px;
	}

	.attachment-file {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		color: var(--text-color);

		font-size: 0.9rem;
	}

	.post-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		margin-left: 1rem;
		margin-right: 0.5rem;
		margin-bottom: 0.5rem;
		user-select: none;
	}
	.action-wrapper {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;

		transition: all 0.3s ease;
		&:hover {
			padding: 0 0.5rem;
			gap: 0.25rem;
			& .action-button {
				padding: 0.5rem;
				margin-left: 0;
				gap: 0.5rem;
				background: var(--secondary-color);
				& span {
					display: flex;
				}
			}
		}

		& .action-button {
			padding: 0.5rem;
			margin-left: -1.75rem;
			border: 1px solid var(--line-color);
			position: relative;
			z-index: 1;
			backdrop-filter: blur(20px);
			&:first-child {
				margin-left: 0;
			}

			&:hover {
				z-index: 2;
				color: var(--tertiary-color);
				border: 1px solid var(--tertiary-color);
			}

			& span {
				display: none;
			}
		}
	}
	.action-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: transparent;
		border: none;
		color: var(--placeholder-color);
		font-size: 0.9rem;
		padding: 0.5rem;
		border-radius: 0.75rem;
		height: 2rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-button:hover {
		background: var(--line-color);
		color: var(--text-color);
	}

	.action-button.upvote.active {
		background: none;
	}

	.action-button.active,
	.action-button.expanded {
		color: var(--text-color);
		background-color: var(--primary-color);
		z-index: 1000;
		& span {
			display: flex;
		}
	}
	.action-button.ai {
		& span {
			display: none;
		}
		&:hover {
			color: var(--tertiary-color);
			background: var(--primary-color);
			& span {
				display: flex;
			}
		}
	}
	.action-button.ai.active {
		color: var(--tertiary-color);
		background: var(--primary-color);

		border: none;
		border-left: 1px solid var(--line-color);

		& span {
			display: flex;
		}
	}
	.action-button.active:hover {
		color: var(--primary-color);
		background: var(--line-color);
	}

	.action-button.upvote.active {
		color: #e91e63;
	}

	.action-button.repost.active {
		color: #00c853;
	}

	.read-count {
		opacity: 0.7;
	}
	.tooltip {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		background: var(--primary-color);
		color: var(--tertiary-color);
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		white-space: nowrap;
		margin-bottom: 4px;
		z-index: 10;
	}

	.tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: var(--text-color);
	}
	.action-button.share.shared {
		color: var(--placeholder-color);
	}

	.action-button.share {
		position: relative;
	}

	/* Keep the hover effect for all states */
	.action-button.share:hover {
		background: var(--line-color);
		color: var(--text-color);
	}
	.repost-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--secondary-color);
		font-size: 0.85rem;
		margin-bottom: 12px;
		padding: 6px 12px;
		background: rgba(var(--secondary-color-rgb), 0.1);
		border-radius: 8px;
		border-left: 3px solid var(--secondary-color);
	}

	.repost-indicator.own-repost {
		color: var(--primary-color);
		background: rgba(var(--primary-color-rgb), 0.1);
		border-left-color: var(--primary-color);
	}

	.action-button:hover {
		background-color: var(--hover-bg, #f3f4f6);
		color: var(--text-primary, #111827);
	}

	.action-button:disabled {
		opacity: 1;
		cursor: not-allowed;
	}

	.action-button.active {
		color: var(--tertiary-color);
	}

	.action-button.agents.no-agents {
		opacity: 1;
	}

	.expand-icon {
		margin-left: 0.125rem;
		display: flex;
		align-items: center;
	}

	.agents-container {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		width: 100%;
		height: auto;
		background: var(--bg-gradient-left);
		border-radius: 0 1rem 1rem 0;
	}

	/* Agents row styles */
	.agents-row {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		border-radius: 1rem 1rem 0 0;
		width: auto;
		margin-top: 1rem;

		color: var(--text-color);
		transition: all 0.2s ease;
		&:hover {
			& .agent-name {
				color: var(--text-color);
			}
		}
	}
	.agents-row.analyzed {
		flex-direction: column;
		margin-top: 0.5rem;
		& .agent-avatar {
			flex-direction: row;
			gap: 0.5rem;
			border-radius: 2rem;
			justify-content: flex-start;

			width: calc(100% - 2rem);
		}
		& .agent-avatar.assigned {
			box-shadow: var(--tertiary-color) 0 0 10px 2px;
			background-color: var(--primary-color) !important;
		}
		& .agent-name {
			font-size: 0.8rem;
			color: var(--placeholder-color);
			text-align: center;
			max-width: 100%;
			overflow: visible;
			text-overflow: visible;
			white-space: nowrap;
		}
	}
	.agent-avatar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;
		transition: transform 0.2s ease;
	}

	.agent-avatar:hover {
		transform: scale(1.05);
	}

	.avatar-image,
	.avatar-fallback {
		width: 32px;
		height: 32px;
		border-radius: 50%;
	}

	.avatar-image {
		object-fit: cover;
	}

	.avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--secondary-color);
		color: white;
		font-weight: 600;
		font-size: 0.75rem;
	}

	.agent-name {
		font-size: 0.625rem;
		color: var(--placeholder-color);
		text-align: center;
		max-width: 48px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.agent-overflow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: var(--surface-tertiary, #f3f4f6);
		border: 2px solid var(--border-color, #e5e7eb);
		color: var(--text-muted, #6b7280);
		font-size: 0.625rem;
		font-weight: 600;
	}

	/* Read indicator specific styles */
	.action-button.read {
		cursor: default;
		pointer-events: none;
		display: flex;
		height: 1rem !important;
	}
	.agent-avatar.clickable {
		cursor: pointer;
		position: relative;
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 4px;
		transition: all 0.2s ease;
	}

	.agent-avatar.clickable:hover {
		transform: translateY(-2px);
		background-color: var(--secondary-color);
	}

	.agent-avatar.assigned {
		box-shadow: var(--tertiary-color) 0 0 10px 2px;
		background-color: var(--primary-color);
	}

	.assigned-indicator {
		position: absolute;
		top: -2px;
		right: -2px;
		background-color: var(--success-color, #10b981);
		color: white;
		border-radius: 50%;
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: bold;
	}
	.agents-info {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: 100%;
	}
	// .agents-header {
	// 	width: calc(100% - 1rem);
	// 	display: flex;
	// 	position: relative;
	// 	align-items: center;
	// 	justify-content: flex-end;
	// 	gap: 1rem;
	// }

	// .agents-title {
	// 	padding: 0.5rem;
	// 	font-size: 0.8rem;
	// 	color: var(--placeholder-color);
	// }
	// span.inactive {
	// 	color: var(--placeholder-color);
	// 	font-size: 0.8rem;
	// }
	// span.active {
	// 	color: var(--tertiary-color);
	// 	font-size: 0.8rem;
	// }
	.agents-summary {
		display: flex;
		position: relative;
		justify-content: flex-end;
		align-items: center;
		width: calc(100% - 1rem);
		padding: 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.1rem;
		gap: 1rem;
		text-align: center;
		color: var(--tertiary-color);
	}
	.pdf-attachment {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 8px;
	}

	.pdf-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.pdf-name {
		font-weight: 500;
		color: var(--placeholder-color);
		font-size: 14px;
	}

	.filesize {
		color: var(--placeholder-color);
		font-size: 12px;
	}
	/* Mobile responsive */
	@media (max-width: 768px) {
		.post-card {
			padding: 12px;
		}

		.post-actions {
			gap: 12px;
		}

		.action-button {
			padding: 4px 6px;
		}
	}
</style>
