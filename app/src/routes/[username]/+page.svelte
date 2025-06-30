<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';
	import {
		pocketbaseUrl,
		currentUser,
		getPublicUserData,
		getPublicUserByUsername,
		updateUserStatus,
		getPublicUsersBatch,
		uploadProfileWallpaper,
		updateUserDescription
	} from '$lib/pocketbase';
	import { createEventDispatcher } from 'svelte';
	import PostCard from '$lib/features/posts/components/PostCard.svelte';
	import RepostCard from '$lib/features/posts/components/RepostCard.svelte';
	import PostQuoteCard from '$lib/features/posts/components/PostQuoteCard.svelte';
	import { postStore } from '$lib/stores/postStore';
	import PostSidenav from '$lib/features/posts/components/PostSidenav.svelte';
	import PostTrends from '$lib/features/posts/components/PostTrends.svelte';
	import {
		sidenavStore,
		showSidenav,
		showRightSidenav,
		showInput,
		showSettings,
		showDebug,
		showOverlay
	} from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';
	import { userStatusStore } from '$lib/stores/userStatusStore';
	import { browser } from '$app/environment';
	import BackButton from '$lib/components/buttons/BackButton.svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { clientTryCatch, validationTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';
	import { toast } from '$lib/utils/toastUtils';
	import { DateUtils } from '$lib/utils/dateUtils';
	import type { AIModel, User, PublicUserProfile } from '$lib/types/types';
	import type { PostWithInteractions, PostUpdateData } from '$lib/types/types.posts';
	import { InfiniteScrollManager } from '$lib/utils/infiniteScroll';
	import DMModule from '$lib/features/dm/components/DMModule.svelte';
	import Debugger from '$lib/components/modals/Debugger.svelte';
	import UsersList from '$lib/features/users/components/UsersList.svelte';

	export let data;

	let dmModule: DMModule;
	let selectedUserId: string | null = null;
	let loading = true;
	let error = '';
	let user: User | null = null;
	let profile: PublicUserProfile | null = null;
	let userStatus: 'online' | 'offline' = 'offline';
	let statusFetchAttempts = 0;
	let lastStatusFetch: string | null = null;
	let isCurrentUser = false;
	let showWallpaperUpload = false;
	let showDescriptionEdit = false;
	let editingDescription = false;
	let descriptionValue = '';
	let fileInput: HTMLInputElement;
	let uploading = false;
	let userPosts: PostWithInteractions[] = [];
	let totalPosts = 0;
	let innerWidth = 0;
	let userProfilesMap: Map<string, Partial<User> | null> = new Map();
	let profileLoadingMore = false;
	let profileHasMore = true;
	let profileCurrentOffset = 0;
	let infiniteScrollManager: InfiniteScrollManager | null = null;
	let scrollY = 0;
	let isScrolled = false;
	let activeOverlay: 'followers' | 'following' = 'followers';
	let followerCount = 0;
	let followingCount = 0;

	const PROFILE_POSTS_PER_PAGE = 10;
	const SCROLL_THRESHOLD = 100;
	const dispatch = createEventDispatcher();

	async function fetchUserProfiles(userIds: string[]): Promise<void> {
		const result = await clientTryCatch(
			(async () => {
				const profiles = await getPublicUsersBatch(userIds);
				profiles.forEach((profile) => {
					if (profile && profile.id) {
						userProfilesMap.set(profile.id, profile);
					}
				});
				userIds.forEach((id) => {
					if (!userProfilesMap.has(id)) {
						userProfilesMap.set(id, null);
					}
				});
				userProfilesMap = new Map(userProfilesMap);
				return profiles;
			})(),
			`Fetching user profiles for ${userIds.length} users`
		);

		if (isFailure(result)) {
			console.error('Error fetching user profiles:', result.error);
		}
	}

	async function fetchUserData(offset = 0, append = false) {
		if (!username || !browser) return;

		if (!append) {
			loading = true;
			profileCurrentOffset = 0;
			profileHasMore = true;
			userPosts = [];
		} else {
			profileLoadingMore = true;
		}
		error = '';

		try {
			console.log(`🔍 Fetching user data with offset: ${offset}, append: ${append}`);

			const response = await fetch(
				`/api/users/username/${username}?offset=${offset}&limit=${PROFILE_POSTS_PER_PAGE}`
			);
			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Failed to load user data';
				return;
			}

			const actualData = data.data || data;

			if (!append) {
				user = actualData.user;
				userPosts = actualData.posts || [];
				followerCount = user?.followers?.length || 0;
				followingCount = user?.following?.length || 0;
				console.log('👤 Initial user data loaded:', {
					id: user?.id,
					status: user?.status,
					last_login: user?.last_login,
					followers: followerCount,
					following: followingCount,
					location: user?.location,
					website: user?.website
				});
			} else {
				const newPosts = actualData.posts || [];
				const existingIds = new Set(userPosts.map((p: PostWithInteractions) => p.id));
				const uniqueNewPosts = newPosts.filter((p: PostWithInteractions) => !existingIds.has(p.id));
				userPosts = [...userPosts, ...uniqueNewPosts];
				console.log(`📊 Added ${uniqueNewPosts.length} new unique posts`);
			}

			const newPostsCount = (actualData.posts || []).length;

			if (actualData.hasMore !== undefined) {
				profileHasMore = actualData.hasMore;
			} else {
				profileHasMore = newPostsCount === PROFILE_POSTS_PER_PAGE;
			}

			profileCurrentOffset = append ? profileCurrentOffset + newPostsCount : newPostsCount;

			totalPosts = actualData.totalPosts || userPosts.length;

			console.log('📊 Profile data updated:', {
				postsCount: userPosts.length,
				newPostsCount,
				hasMore: profileHasMore,
				currentOffset: profileCurrentOffset,
				totalPosts: totalPosts
			});

			const userIds = [
				...new Set(
					userPosts.flatMap((post) => {
						const ids = [post.user];
						if (post.repostedBy && Array.isArray(post.repostedBy)) {
							ids.push(...post.repostedBy);
						}
						return ids;
					})
				)
			];

			// Add the profile user to the batch request to get updated status
			if (user?.id && !userIds.includes(user.id)) {
				userIds.push(user.id);
			}

			if (userIds.length > 0) {
				await fetchUserProfiles(userIds);
			}

			// Update user posts with profile data
			userPosts = userPosts.map((post) => {
				const authorProfile = userProfilesMap.get(post.user);
				if (authorProfile) {
					return {
						...post,
						authorProfile,
						author_name: authorProfile.name || post.author_name,
						author_username: authorProfile.username || post.author_username,
						author_avatar: authorProfile.avatar || post.author_avatar
					};
				}
				return post;
			});

			// Update the main user object with fresh status data from batch request
			if (user && user.id && userProfilesMap.has(user.id)) {
				const userProfile = userProfilesMap.get(user.id);
				if (userProfile) {
					const updatedUser = {
						...user,
						status: userProfile.status || user.status || 'offline',
						last_login: userProfile.last_login || user.last_login
					};

					// Only update if status actually changed
					if (updatedUser.status !== user.status || updatedUser.last_login !== user.last_login) {
						user = updatedUser;
						console.log('📊 Updated user status from batch:', {
							status: user.status,
							last_login: user.last_login
						});
					}
				}
			}
		} catch (err) {
			console.error('Error fetching user data:', err);
			error = 'Failed to load user data';
		} finally {
			loading = false;
			profileLoadingMore = false;
		}
	}

	async function loadMoreProfilePosts() {
		if (profileLoadingMore || !profileHasMore) {
			console.log('⛔ Load more skipped:', { profileLoadingMore, profileHasMore });
			return;
		}

		console.log('🚀 Loading more profile posts from offset:', profileCurrentOffset);
		await fetchUserData(profileCurrentOffset, true);
	}

	function setupInfiniteScroll() {
		if (infiniteScrollManager) {
			infiniteScrollManager.destroy();
		}

		infiniteScrollManager = new InfiniteScrollManager({
			loadMore: async () => {
				try {
					await loadMoreProfilePosts();
				} catch (error) {
					console.error('Error loading more profile posts:', error);
				}
			},
			hasMore: () => profileHasMore,
			isLoading: () => profileLoadingMore,
			triggerId: 'profile-loading-trigger',
			debug: true
		});

		infiniteScrollManager.setup();
		return infiniteScrollManager;
	}

	function formatJoinDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long'
		});
	}

	async function handlePostInteraction(
		event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
	) {
		const { postId, action } = event.detail;

		if (!$currentUser && action !== 'share') {
			toast.warning('Please sign in to interact with posts');
			return;
		}

		const realPostId = extractRealPostId(postId);

		console.log('Username page interaction:', {
			receivedPostId: postId,
			realPostId,
			action,
			isCompositeKey: postId !== realPostId
		});

		try {
			let optimisticUpdate = null;
			if (action === 'upvote') {
				optimisticUpdate = applyOptimisticUpvote(realPostId);
			} else if (action === 'repost') {
				optimisticUpdate = applyOptimisticRepost(realPostId);
			}

			try {
				switch (action) {
					case 'upvote': {
						const upvoteResult = await postStore.toggleUpvote(realPostId);
						updateLocalPostState(realPostId, 'upvote', upvoteResult);
						break;
					}
					case 'repost': {
						const repostResult = await postStore.toggleRepost(realPostId);
						updateLocalPostState(realPostId, 'repost', repostResult);
						if (repostResult.reposted) {
							toast.success('Post reposted!');
						} else {
							toast.info('Repost removed');
						}
						break;
					}
					case 'read': {
						await postStore.markAsRead(realPostId);
						updateLocalPostState(realPostId, 'read', { hasRead: true });
						break;
					}
					case 'share': {
						const targetPost = userPosts.find(
							(p) => p.id === realPostId || (p.isRepost && p.originalPostId === realPostId)
						);

						const shareResult = await postStore.sharePost(realPostId, targetPost?.author_username);

						if (shareResult.copied) {
							if (shareResult.copyMethod === 'execCommand') {
								toast.success('Link copied to clipboard!');
							} else {
								toast.success(shareResult.message || 'Link copied to clipboard!');
							}
						} else {
							// Check if shareCount exists (user is logged in)
							if ('shareCount' in shareResult && shareResult.shareCount !== undefined) {
								toast.success('Post shared successfully!');
								toast.warning('Automatic copy failed - please copy manually', 4000);
								setTimeout(() => {
									toast.info(`Copy: ${shareResult.url}`, 10000);
								}, 1000);
							} else {
								toast.warning('Could not copy automatically');
								setTimeout(() => {
									toast.info(`Copy: ${shareResult.url}`, 10000);
								}, 500);
							}
						}
						break;
					}
				}

				console.log(`${action} successful for post ${realPostId}`);
			} catch (error) {
				if (optimisticUpdate) {
					revertOptimisticUpdate(optimisticUpdate);
				}
				throw error;
			}
		} catch (err) {
			console.error(`Error ${action}ing post:`, err);

			switch (action) {
				case 'upvote': {
					toast.error('Failed to upvote post');
					break;
				}
				case 'repost': {
					toast.error('Failed to repost');
					break;
				}
				case 'read': {
					toast.error('Failed to mark as read');
					break;
				}
				case 'share': {
					toast.error('Failed to share post');
					const postUrl = `${window.location.origin}/posts/${realPostId}`;
					setTimeout(() => {
						toast.info(`Manual copy: ${postUrl}`, 10000);
					}, 500);
					break;
				}
				default:
					toast.error(`Failed to ${action} post`);
			}
		}
	}

	function extractRealPostId(postId: string): string {
		if (postId.startsWith('repost_')) {
			const parts = postId.split('_');
			if (parts.length >= 2) {
				return parts[1];
			}
		}
		return postId;
	}

	function applyOptimisticUpvote(postId: string) {
		const originalPosts = [...userPosts];

		userPosts = userPosts.map((post) => {
			const shouldUpdate = post.id === postId || (post.isRepost && post.originalPostId === postId);

			if (shouldUpdate) {
				return {
					...post,
					upvote: !post.upvote,
					upvoteCount: post.upvote ? (post.upvoteCount || 1) - 1 : (post.upvoteCount || 0) + 1,
					downvote: false
				};
			}
			return post;
		});

		return originalPosts;
	}

	function applyOptimisticRepost(postId: string) {
		const originalPosts = [...userPosts];

		userPosts = userPosts.map((post) => {
			const shouldUpdate = post.id === postId || (post.isRepost && post.originalPostId === postId);

			if (shouldUpdate) {
				return {
					...post,
					repost: !post.repost,
					repostCount: post.repost ? (post.repostCount || 1) - 1 : (post.repostCount || 0) + 1
				};
			}
			return post;
		});

		return originalPosts;
	}

	function revertOptimisticUpdate(originalPosts: PostWithInteractions[]) {
		userPosts = originalPosts;
	}

	function updateLocalPostState(postId: string, action: string, data: PostUpdateData | null) {
		// Add null check
		if (!data) return;

		userPosts = userPosts.map((post) => {
			const shouldUpdate = post.id === postId || (post.isRepost && post.originalPostId === postId);

			if (!shouldUpdate) return post;

			switch (action) {
				case 'upvote': {
					// Type guard to ensure we have upvote data
					if ('upvoted' in data && 'upvoteCount' in data) {
						return {
							...post,
							upvote: data.upvoted,
							upvoteCount: data.upvoteCount,
							downvote: data.upvoted ? false : post.downvote,
							downvoteCount: data.downvoteCount || post.downvoteCount
						};
					}
					return post;
				}
				case 'repost': {
					if ('reposted' in data && 'repostCount' in data) {
						return {
							...post,
							repost: data.reposted,
							repostCount: data.repostCount
						};
					}
					return post;
				}
				case 'read': {
					if ('hasRead' in data) {
						return {
							...post,
							hasRead: data.hasRead
						};
					}
					return post;
				}
				default:
					return post;
			}
		});
	}
	function isUsernameRoute(path: string): boolean {
		return /^\/[^/]+(?:\/posts(?:\/[^/]+)?)?$/.test(path);
	}

	$: enhancedUserPosts = userPosts.map((post) => {
		const authorProfile = userProfilesMap.get(post.user);

		const enhancedPost = {
			...post,

			id: post.isRepost && post.originalPostId ? post.originalPostId : post.id,
			_isRepost: post.isRepost,
			_originalId: post.id,
			_displayKey: post.isRepost
				? `repost_${post.originalPostId}_${post.repostedBy_id}_${post.created}`
				: post.id
		};

		if (authorProfile) {
			return {
				...enhancedPost,
				authorProfile,
				author_name: authorProfile.name || post.author_name,
				author_username: authorProfile.username || post.author_username,
				author_avatar: authorProfile.avatar || post.author_avatar
			};
		}

		return enhancedPost;
	});

	$: {
		console.log('🔄 USERNAME PAGE STATE:', {
			userPostsLength: userPosts.length,
			enhancedPostsLength: enhancedUserPosts?.length || 0,
			profileHasMore,
			profileLoadingMore,
			profileCurrentOffset,
			totalPosts,
			observerAttached: infiniteScrollManager?.isObserverAttached
		});
	}

	async function handleQuote(
		event: CustomEvent<{ content: string; attachments: File[]; quotedPostId: string }>
	) {
		if (!$currentUser) {
			toast.error('Please sign in to quote posts');
			return;
		}

		const { content, attachments, quotedPostId } = event.detail;

		const result = await clientTryCatch(
			postStore.quotePost(quotedPostId, content, attachments),
			'Quote post operation'
		);

		if (result.success) {
			const fetchResult = await clientTryCatch(fetchUserData(), 'Fetch user data');

			if (!fetchResult.success) {
				console.error('Failed to refresh user data:', fetchResult.error);
				toast.warning('Posted successfully but failed to refresh feed');
			} else {
				toast.success('Post quoted successfully!');
			}
		} else {
			console.error('Failed to quote post:', result.error);

			let userMessage = 'Failed to quote post';
			if (result.error.includes('not found')) {
				userMessage = 'Original post not found';
			} else if (result.error.includes('permission')) {
				userMessage = "You don't have permission to quote this post";
			} else if (result.error.includes('too long')) {
				userMessage = 'Your quote is too long';
			}

			toast.error(userMessage);
		}
	}

	function handleComment(event: CustomEvent<{ postId: string }>) {
		if (!$currentUser) {
			alert($t('generic.interactPrompt'));
			return;
		}

		console.log($t('posts.addingComment'), event.detail.postId);
	}

	function handleFollowUser(event: CustomEvent<{ userId: string }>) {
		console.log($t('posts.followUser'), event.detail.userId);
	}
	async function handleWallpaperUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file || !user) return;

		const maxSize = 5 * 1024 * 1024;
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

		if (file.size > maxSize) {
			alert('File size must be less than 5MB');
			return;
		}

		if (!allowedTypes.includes(file.type)) {
			alert('Please upload a valid image file (JPEG, PNG, WebP)');
			return;
		}

		try {
			uploading = true;
			const updatedUser = await uploadProfileWallpaper(user.id, file);
			if (updatedUser && user) {
				user = { ...user, profileWallpaper: updatedUser.profileWallpaper };
				dispatch('userUpdated', user);
			}
		} catch (error) {
			console.error('Error uploading wallpaper:', error);

			const errorMessage =
				error instanceof Error ? error.message : 'Failed to upload wallpaper. Please try again.';
			alert(errorMessage);
		} finally {
			uploading = false;

			if (fileInput) fileInput.value = '';
		}
	}

	async function saveDescription() {
		if (!user || !descriptionValue.trim() || descriptionValue === user.description) {
			editingDescription = false;
			descriptionValue = user?.description || '';
			return;
		}

		console.log('🔍 Calling updateUserDescription with:', user.id, descriptionValue.trim());

		const result = await clientTryCatch(
			updateUserDescription(user.id, descriptionValue.trim()),
			'Update user description'
		);

		if (isSuccess(result)) {
			console.log('✅ updateUserDescription succeeded');
			if (user) {
				user = { ...user, description: descriptionValue.trim() };
				dispatch('userUpdated', user);
				editingDescription = false;
			}
		} else {
			console.error('❌ updateUserDescription failed:', result.error);
			alert(`Failed to update description: ${result.error}`);
		}
	}

	function cancelEdit() {
		editingDescription = false;
		descriptionValue = user?.description || '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			saveDescription();
		} else if (event.key === 'Escape') {
			cancelEdit();
		}
	}
	$: wallpaperUrl = user?.profileWallpaper
		? `${pocketbaseUrl}/api/files/users/${user.id}/${user.profileWallpaper}?t=${Date.now()}`
		: '';
	$: profileDebugItems = [
		{ label: 'Observer', value: infiniteScrollManager ? '✅' : '❌' },
		{ label: 'ScrollY', value: scrollY },
		{ label: 'Threshold', value: SCROLL_THRESHOLD },
		{ label: 'IsScrolled', value: isScrolled },
		{ label: 'Header Visible', value: isScrolled ? 'YES' : 'NO' },
		{ label: 'Attached', value: infiniteScrollManager?.isObserverAttached ? '✅' : '❌' },
		{
			label: 'Trigger',
			value:
				typeof document !== 'undefined' && document?.getElementById('profile-loading-trigger')
					? '✅'
					: '❌'
		},
		{ label: 'Has More', value: profileHasMore ? '✅' : '❌' },
		{ label: 'Loading', value: profileLoadingMore ? '⏳' : '💤' },
		{ label: 'Posts', value: `${userPosts.length}/${totalPosts}` },
		{ label: 'User', value: $currentUser ? '✅' : '❌' },
		{ label: '--- STATUS DEBUG ---', value: '---' },
		{ label: 'User ID', value: user?.id || 'null' },
		{ label: 'Is Current User', value: isCurrentUser },
		{ label: 'User Raw Status', value: user?.status || 'none' },
		{ label: 'Fetch Attempts', value: statusFetchAttempts },
		{ label: 'Last Fetch', value: lastStatusFetch || 'Never' },
		{ label: 'Store Size', value: $userStatusStore.size },
		{ label: 'Store Has User', value: user?.id ? $userStatusStore.has(user.id) : false }
	];
	$: profileDebugButtons = [
		{
			label: 'Manual Load More',
			action: async () => {
				console.log('🚀 Manual trigger profile loadMore');
				await loadMoreProfilePosts();
			}
		},
		{
			label: 'Re-setup Scroll',
			action: () => {
				console.log('🔧 Re-setup infinite scroll');
				setupInfiniteScroll();
				if (infiniteScrollManager) {
					infiniteScrollManager.attachWithRetry();
				}
			},
			color: '#28a745'
		},
		{
			label: 'Refresh Profile',
			action: async () => {
				await fetchUserData(0, false);
			},
			color: '#ffc107'
		},
		{
			label: 'Test Status Update',
			action: async () => {
				if (!user?.id) {
					console.log('❌ No user ID available');
					return;
				}

				console.log('🔄 Testing status update to online...');
				const success = await updateUserStatus(user.id, 'online');
				console.log('Status update result:', success);

				if (success) {
					// Refresh the profile to see the updated status
					await fetchUserData(0, false);
				}
			},
			color: '#6f42c1'
		},
		{
			label: 'Check PB Fields',
			action: async () => {
				if (!user?.id) {
					console.log('❌ No user ID available');
					return;
				}

				console.log('🔍 Checking PocketBase fields directly...');

				try {
					// Test the status API directly
					const response = await fetch(`/api/users/${user.id}/status`);
					const data = await response.json();
					console.log('📥 Direct status API response:', data);

					// Test a manual update
					const updateResponse = await fetch(`/api/users/${user.id}/status`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'include',
						body: JSON.stringify({ status: 'online' })
					});
					const updateData = await updateResponse.json();
					console.log('📥 Manual update response:', updateData);
				} catch (error) {
					console.error('❌ Error testing PB fields:', error);
				}
			},
			color: '#dc3545'
		}
	];
	$: {
		isScrolled = scrollY > SCROLL_THRESHOLD;
		// console.log('Scroll update:', { scrollY, isScrolled, threshold: SCROLL_THRESHOLD });
	}
	$: username = $page.params.username;
	$: isCurrentUser = !!($currentUser && user && $currentUser.id === user.id);
	$: if (user && user.id) {
		console.log(
			'🔍 User loaded:',
			user.id,
			'status from profile:',
			user.status,
			'last_login:',
			user.last_login
		);

		// Calculate if user is actually online based on last_login
		if (user.last_login && user.status) {
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
			const lastLogin = new Date(user.last_login);
			const isOnline = user.status === 'online' && lastLogin > fiveMinutesAgo;
			userStatus = isOnline ? 'online' : 'offline';
		} else {
			userStatus = user.status || 'offline';
		}

		console.log('👤 Calculated status:', userStatus);
	}
	onMount(() => {
		console.log('=== USERNAME PAGE MOUNT START ===');

		const checkScrollableElements = () => {
			const elements = [
				document.documentElement,
				document.body,
				document.querySelector('.profile-content-wrapper'),
				document.querySelector('.main-wrapper'),
				document.querySelector('.profile-content')
			];

			elements.forEach((el, index) => {
				if (el) {
					console.log(`Element ${index}:`, {
						element: el.className || el.tagName,
						scrollTop: el.scrollTop,
						scrollHeight: el.scrollHeight,
						clientHeight: el.clientHeight,
						isScrollable: el.scrollHeight > el.clientHeight
					});
				}
			});
		};

		checkScrollableElements();

		const scrollHandler = (e: Event) => {
			// console.log('Scroll detected on:', e.target.className || e.target.tagName, 'ScrollTop:', e.target.scrollTop);
			const target = e.target as Element;
			scrollY = target.scrollTop;
		};

		document.addEventListener('scroll', scrollHandler, true);
		document.querySelector('.profile-content-wrapper')?.addEventListener('scroll', scrollHandler);
		document.querySelector('.main-wrapper')?.addEventListener('scroll', scrollHandler);

		const handleNewChat = () => {
			console.log('New chat requested from DM module');
		};

		document.addEventListener('newChat', handleNewChat);

		// Async initialization in IIFE
		(async () => {
			if (!user && username) {
				await fetchUserData(0, false);
			}

			console.log('🔧 Setting up infinite scroll...');
			setupInfiniteScroll();

			if (infiniteScrollManager) {
				infiniteScrollManager.attachWithRetry(10, 100).then((success) => {
					if (success) {
						console.log('✅ Infinite scroll ready!');
					} else {
						console.error('❌ Failed to setup infinite scroll');
					}
				});
			}

			console.log('=== USERNAME PAGE MOUNT END ===');
		})();

		// Cleanup function (returned synchronously)
		return () => {
			document.removeEventListener('newChat', handleNewChat);
			document.removeEventListener('scroll', scrollHandler, true);
			document
				.querySelector('.profile-content-wrapper')
				?.removeEventListener('scroll', scrollHandler);
			document.querySelector('.main-wrapper')?.removeEventListener('scroll', scrollHandler);
			console.log('🧹 Cleaning up infinite scroll...');
			if (infiniteScrollManager) {
				infiniteScrollManager.destroy();
				infiniteScrollManager = null;
			}
		};
	});
</script>

<svelte:window bind:scrollY />

<svelte:head>
	<title>{user?.name || user?.username || 'User'} - Profile</title>
	<meta name="description" content="Profile page for {user?.name || user?.username || 'User'}" />
</svelte:head>

<div
	class="profile-page-container"
	class:hide-left-sidebar={$showSidenav}
	class:hide-right-sidebar={$showRightSidenav}
	class:nav-visible={$showSettings}
	in:fly={{ y: 50, duration: 300 }}
	out:fly={{ y: -50, duration: 200 }}
>
	<!-- Left Sidebar Component -->
	{#if $showSidenav}
		<div class="sidebar-container">
			<PostSidenav />
		</div>
	{/if}

	<!-- Main Content -->
	<div class="profile-content-wrapper">
		{#if loading}
			<div
				class="trigger-loader"
				in:fly={{ y: 200, duration: 300 }}
				out:fly={{ y: -200, duration: 200 }}
			></div>
		{:else if error}
			<div class="error-container">
				<h1>{$t('posts.errorExpression')}</h1>
				<p>
					{$t('posts.historySignin')}
				</p>
				<button class="btn btn-primary" on:click={() => goto('/')}>
					{$t('generic.back')}
				</button>
			</div>
		{:else if user}
			{#if isScrolled || $showInput || $showOverlay}
				<div
					class="profile-sticky-header"
					class:input-open={$showInput}
					transition:fly={{ y: -50, duration: 200 }}
				>
					<BackButton />
					<div class="avatar-header">
						<div class="status-indicator" class:online={userStatus === 'online'}></div>
						<img
							src={user.avatar
								? `${pocketbaseUrl}/api/files/users/${user.id}/${user.avatar}`
								: '/api/placeholder/120/120'}
							alt="{user.name || user.username}'s avatar"
							class="sticky-avatar"
						/>
					</div>
					<div class="header-username">
						<span class="username-text">{user.name || user.username}</span>
						<span class="username-login"
							>{user.last_login ? DateUtils.formatRelativeDate(user.last_login) : 'Never'}</span
						>
					</div>
					<div class="content-nav">
						<nav class="tab-nav">
							{#if $currentUser}
								{#if !isCurrentUser}
									<button
										class="tab"
										class:active={$showInput}
										on:click={(event) => {
											event.preventDefault();
											if (innerWidth <= 450) {
												sidenavStore.hideLeft();
												sidenavStore.hideRight();
											}

											// Close overlay if open
											if ($showOverlay) {
												sidenavStore.hideOverlay();
											}

											// Toggle input
											if ($showInput) {
												sidenavStore.hideInput();
											} else {
												sidenavStore.showInput();
											}
										}}
									>
										<Icon name="MessageSquare" size={16} />
										{$t('chat.message')}
									</button>
								{:else}{/if}
							{:else}
								<button class="btn btn-primary" on:click={() => goto('/login')}>
									<Icon name="UserIcon" size={16} />
									{$t('generic.signin')}
								</button>
							{/if}

							<button
								class="tab"
								on:click={(event) => {
									event.preventDefault();
									if ($showInput) {
										sidenavStore.hideInput();
									}
									if ($showOverlay) {
										sidenavStore.hideOverlay();
									}
									// TODO: Add posts tab functionality here
								}}
							>
								<span>{totalPosts}</span>
								<span>{$t('posts.posts')}</span>
							</button>

							<button
								class="tab"
								on:click={(event) => {
									event.preventDefault();
									if ($showInput) {
										sidenavStore.hideInput();
									}
									if ($showOverlay) {
										sidenavStore.hideOverlay();
									}
									// TODO: Add media tab functionality here
								}}
							>
								{$t('posts.media')}
							</button>

							<button
								class="tab"
								on:click={(event) => {
									event.preventDefault();
									if ($showInput) {
										sidenavStore.hideInput();
									}
									if ($showOverlay) {
										sidenavStore.hideOverlay();
									}
									// TODO: Add likes tab functionality here
								}}
							>
								{$t('posts.likes')}
							</button>

							<button
								class="tab"
								class:activeOverlay={activeOverlay === 'followers'}
								class:active={$showOverlay && activeOverlay === 'followers'}
								on:click={(event) => {
									event.preventDefault();

									if (innerWidth <= 450) {
										sidenavStore.hideLeft();
										sidenavStore.hideRight();
									}

									// Close input if open
									if ($showInput) {
										sidenavStore.hideInput();
									}

									// Handle followers overlay
									if ($showOverlay && activeOverlay === 'followers') {
										// If followers overlay is currently open, close it
										sidenavStore.hideOverlay();
									} else {
										// Set active overlay to followers and show it
										activeOverlay = 'followers';
										sidenavStore.showOverlay();
									}
								}}
							>
								<span>{followerCount}</span>
								<span>{$t('profile.followers')}</span>
							</button>

							<button
								class="tab"
								class:activeOverlay={activeOverlay === 'following'}
								class:active={$showOverlay && activeOverlay === 'following'}
								on:click={(event) => {
									event.preventDefault();

									if (innerWidth <= 450) {
										sidenavStore.hideLeft();
										sidenavStore.hideRight();
									}

									// Close input if open
									if ($showInput) {
										sidenavStore.hideInput();
									}

									// Handle following overlay
									if ($showOverlay && activeOverlay === 'following') {
										// If following overlay is currently open, close it
										sidenavStore.hideOverlay();
									} else {
										// Set active overlay to following and show it
										activeOverlay = 'following';
										sidenavStore.showOverlay();
									}
								}}
							>
								<span>{followingCount}</span>
								<span>{$t('profile.following')}</span>
							</button>
						</nav>
					</div>
				</div>
			{/if}

			<div class="main-wrapper" class:with-sticky-header={isScrolled} class:input-open={$showInput}>
				{#if !isScrolled && !$showInput && !$showOverlay}
					<header class="profile-header" transition:fly={{ y: -50, duration: 200 }}>
						<div
							class="profile-background"
							class:interactive={isCurrentUser}
							class:uploading
							style={wallpaperUrl
								? `background-image: url(${wallpaperUrl}); background-size: cover; background-position: center;`
								: ''}
							on:mouseenter={() => isCurrentUser && (showWallpaperUpload = true)}
							on:mouseleave={() => isCurrentUser && (showWallpaperUpload = false)}
							on:click={() => isCurrentUser && fileInput?.click()}
							role={isCurrentUser ? 'button' : undefined}
							tabindex={isCurrentUser ? 0 : undefined}
							on:keydown={(e) =>
								isCurrentUser && (e.key === 'Enter' || e.key === ' ') && fileInput?.click()}
						>
							{#if isCurrentUser && (showWallpaperUpload || uploading)}
								<div class="upload-overlay" transition:fade={{ duration: 200 }}>
									{#if uploading}
										<div class="upload-spinner"></div>
										<span>Uploading...</span>
									{:else}
										<div class="upload-icon">📷</div>
										<span>Upload Wallpaper</span>
									{/if}
								</div>
							{/if}
						</div>
						{#if isCurrentUser}
							<input
								bind:this={fileInput}
								type="file"
								accept="image/jpeg,image/jpg,image/png,image/webp"
								on:change={handleWallpaperUpload}
								style="display: none;"
							/>
						{/if}
						<div class="profile-info">
							<div class="avatar-section">
								<img
									src={user.avatar
										? `${pocketbaseUrl}/api/files/users/${user.id}/${user.avatar}`
										: '/api/placeholder/120/120'}
									alt="{user.name || user.username}'s avatar"
									class="profile-avatar"
								/>
							</div>

							<div class="user-details">
								<div class="handle-wrapper">
									<h1 class="user-name">{user.name || user.username}</h1>
									<p class="username">@{user.username}</p>
								</div>

								<div class="user-meta">
									<div class="meta-item">
										<Icon name="Calendar" size={16} />
										<span>{$t('profile.joined')} {formatJoinDate(user.created)}</span>
										<div class="action-buttons"></div>
									</div>

									{#if user?.location}
										<div class="meta-item">
											<Icon name="MapPin" size={16} />
											<span>{user.location}</span>
										</div>
									{/if}

									{#if user?.website}
										<div class="meta-item">
											<Icon name="Link" size={16} />
											<a href={user.website} target="_blank" rel="noopener noreferrer">
												{user.website}
											</a>
										</div>
									{/if}
								</div>
								<div class="handle-wrapper"></div>
								{#if editingDescription && isCurrentUser}
									<div class="description-edit">
										<textarea
											bind:value={descriptionValue}
											on:keydown={handleKeydown}
											placeholder="Tell us about yourself..."
											class="description-input"
											rows="3"
											maxlength="160"
											autofocus
										></textarea>
										<div class="description-actions">
											<button class="btn btn-sm btn-primary" on:click={saveDescription}>
												Save
											</button>
											<button class="btn btn-sm btn-secondary" on:click={cancelEdit}>
												Cancel
											</button>
											<span class="char-count">{descriptionValue.length}/160</span>
										</div>
									</div>
								{:else if user.description || isCurrentUser}
									<div
										class="user-bio"
										class:editable={isCurrentUser}
										class:empty={!user.description && isCurrentUser}
										on:mouseenter={() => isCurrentUser && (showDescriptionEdit = true)}
										on:mouseleave={() => isCurrentUser && (showDescriptionEdit = false)}
										on:click={() => {
											if (isCurrentUser) {
												descriptionValue = user?.description || '';
												editingDescription = true;
											}
										}}
										role={isCurrentUser ? 'button' : undefined}
										tabindex={isCurrentUser ? 0 : undefined}
										on:keydown={(e) => {
											if (isCurrentUser && (e.key === 'Enter' || e.key === ' ')) {
												descriptionValue = user?.description || '';
												editingDescription = true;
											}
										}}
									>
										{#if user.description}
											{user.description}
										{:else if isCurrentUser}
											<span class="placeholder-text">Add a description...</span>
										{/if}

										{#if isCurrentUser && showDescriptionEdit}
											<div class="edit-hint" transition:fade={{ duration: 150 }}>
												✏️ Click to edit
											</div>
										{/if}
									</div>
								{/if}
								<div class="content-nav">
									<nav class="tab-nav">
										<button
											class="tab active"
											on:click={(event) => {
												event.preventDefault();
												if ($showInput) {
													sidenavStore.hideInput();
												}
												if ($showOverlay) {
													sidenavStore.hideOverlay();
												}
												// TODO: Add posts tab functionality here
											}}
										>
											{totalPosts}
											{$t('posts.posts')}
										</button>
										<button
											class="tab"
											on:click={(event) => {
												event.preventDefault();
												if ($showInput) {
													sidenavStore.hideInput();
												}
												if ($showOverlay) {
													sidenavStore.hideOverlay();
												}
												// TODO: Add media tab functionality here
											}}
										>
											{$t('posts.media')}
										</button>
										<button
											class="tab"
											on:click={(event) => {
												event.preventDefault();
												if ($showInput) {
													sidenavStore.hideInput();
												}
												if ($showOverlay) {
													sidenavStore.hideOverlay();
												}
												// TODO: Add likes tab functionality here
											}}
										>
											{$t('posts.likes')}
										</button>

										<button
											class="tab"
											class:activeOverlay={activeOverlay === 'followers'}
											class:active={$showOverlay && activeOverlay === 'followers'}
											on:click={(event) => {
												event.preventDefault();

												if (innerWidth <= 450) {
													sidenavStore.hideLeft();
													sidenavStore.hideRight();
												}

												// Close input if open
												if ($showInput) {
													sidenavStore.hideInput();
												}

												// Handle followers overlay
												if ($showOverlay && activeOverlay === 'followers') {
													// If followers overlay is currently open, close it
													sidenavStore.hideOverlay();
												} else {
													// Set active overlay to followers and show it
													activeOverlay = 'followers';
													sidenavStore.showOverlay();
												}
											}}
										>
											{followerCount}
											<Icon name="User" size={16} />
											{$t('profile.followers')}
										</button>
										<button
											class="tab"
											class:activeOverlay={activeOverlay === 'following'}
											class:active={$showOverlay && activeOverlay === 'following'}
											on:click={(event) => {
												event.preventDefault();

												if (innerWidth <= 450) {
													sidenavStore.hideLeft();
													sidenavStore.hideRight();
												}

												// Close input if open
												if ($showInput) {
													sidenavStore.hideInput();
												}

												// Handle following overlay
												if ($showOverlay && activeOverlay === 'following') {
													// If following overlay is currently open, close it
													sidenavStore.hideOverlay();
												} else {
													// Set active overlay to following and show it
													activeOverlay = 'following';
													sidenavStore.showOverlay();
												}
											}}
										>
											{followingCount}
											<Icon name="User" size={16} />
											{$t('profile.following')}
										</button>
										{#if $currentUser}
											{#if !isCurrentUser}
												<button
													class="tab"
													class:active={$showInput}
													on:click={(event) => {
														event.preventDefault();
														if (innerWidth <= 450) {
															sidenavStore.hideLeft();
															sidenavStore.hideRight();
														}

														// Close overlay if open
														if ($showOverlay) {
															sidenavStore.hideOverlay();
														}

														// Toggle input
														if ($showInput) {
															sidenavStore.hideInput();
														} else {
															sidenavStore.showInput();
														}
													}}
												>
													<Icon name="MessageSquare" size={16} />
													{$t('chat.message')}
												</button>
											{:else}
												<button
													class="tab"
													on:click={() => {
														if ($showInput) {
															sidenavStore.hideInput();
														}
														if ($showOverlay) {
															sidenavStore.hideOverlay();
														}

														if (isCurrentUser) {
															descriptionValue = user?.description || '';
															editingDescription = true;
														}
													}}
												>
													<Icon name="Settings" size={16} />
													{$t('profile.edit')}
												</button>
											{/if}
										{:else}
											<button class="btn btn-primary" on:click={() => goto('/login')}>
												<Icon name="UserIcon" size={16} />
												{$t('generic.signin')}
											</button>
										{/if}
									</nav>
								</div>
							</div>
						</div>
					</header>
				{/if}
				<!-- Profile Content -->
				<main class="profile-content">
					<!-- Posts Feed -->
					<section
						class="posts-section"
						in:fly={{ y: 200, duration: 300 }}
						out:fly={{ y: -200, duration: 200 }}
					>
						{#if $currentUser}
							<!-- Full post list for authenticated users -->
							{#if userPosts.length > 0}
								{#each enhancedUserPosts as post (post._displayKey || post.id)}
									{#if post._isRepost}
										<RepostCard
											{post}
											repostedBy={post.repostedBy_id
												? {
														id: post.repostedBy_id,
														username: post.repostedBy_username ?? 'unknown',
														name: post.repostedBy_name,
														avatar: post.repostedBy_avatar
													}
												: null}
											on:interact={handlePostInteraction}
											on:comment={handleComment}
											on:quote={handleQuote}
										/>
									{:else if post.quotedPost}
										<PostQuoteCard
											{post}
											on:interact={handlePostInteraction}
											on:comment={handleComment}
											on:quote={handleQuote}
										/>
									{:else}
										<PostCard
											{post}
											on:interact={handlePostInteraction}
											on:comment={handleComment}
											on:quote={handleQuote}
											hideHeaderOnScroll={isScrolled}
										/>
									{/if}
								{/each}

								<!-- FIXED: Loading trigger for authenticated users with more posts -->
								{#if profileHasMore}
									<div id="profile-loading-trigger" class="loading-trigger">
										{#if profileLoadingMore}
											<div class="loading-trigger">
												<div class="loading-indicator">
													<div
														class="trigger-loader"
														in:fly={{ y: 50, duration: 300 }}
														out:fly={{ y: -50, duration: 200 }}
													></div>
													<!-- <span>Loading more posts...</span> -->
												</div>
											</div>
										{:else}
											<div class="loading-trigger">
												<div class="loading-indicator">
													<div
														class="trigger-loader"
														in:fly={{ y: 50, duration: 300 }}
														out:fly={{ y: -50, duration: 200 }}
													></div>
													<!-- <span>Loading more posts...</span> -->
												</div>
											</div>
										{/if}
									</div>
								{:else if userPosts.length > 0}
									<div
										class="end-of-posts"
										style="text-center: center; padding: 20px; color: #666;"
									>
										<p>No more posts to load</p>
										<p>Total posts: {userPosts.length}</p>
									</div>
								{/if}
							{:else if !$showInput}
								<div class="empty-state">
									<p>{user?.username || 'This user'} hasn't posted anything yet.</p>
								</div>
							{/if}
						{:else}
							<!-- Limited preview for non-authenticated users -->
							<div class="auth-required-posts">
								{#if userPosts.length > 0}
									<!-- Show just 2 posts as a preview -->
									{#each userPosts.slice(0, 2) as post (post.id)}
										<PostCard
											{post}
											isRepost={post.isRepost || false}
											isPreview={true}
											on:upvote={handlePostInteraction}
											on:downvote={handlePostInteraction}
											on:repost={handlePostInteraction}
											on:comment={handleComment}
											on:share={handlePostInteraction}
											on:quote={handleQuote}
											on:read={handlePostInteraction}
											on:follow={handleFollowUser}
										/>
									{/each}

									<!-- Authentication wall -->
									<div class="auth-wall">
										<div class="blur-overlay"></div>
										<div class="auth-prompt">
											<h3>
												{$t('posts.seeAll')}
												{totalPosts}
												{$t('posts.postsFrom')}
												{user?.name || user?.username}
											</h3>
											<p>{$t('posts.historySignin')}</p>
										</div>
									</div>
								{:else}
									<div class="empty-state">
										<p>{user?.username || 'This user'} hasn't posted anything yet.</p>
									</div>
								{/if}
							</div>
						{/if}
					</section>
				</main>
			</div>
		{/if}
	</div>

	{#if $showInput}
		{#if $currentUser}
			{#if !isCurrentUser}
				<div class="dm-container">
					<DMModule
						bind:this={dmModule}
						{user}
						initialConversationId={selectedUserId}
						showDrawer={false}
						showChatHeader={false}
						showDrawerToggle={false}
						shouldLoadConversations={!isCurrentUser}
					/>
				</div>
			{/if}
		{/if}
	{/if}
	{#if $showOverlay}
		{#if $currentUser}
			<div class="dm-container">
				{#if user?.id}
					<UsersList
						userId={user.id}
						listType={activeOverlay}
						showFollowButton={true}
						showStatus={true}
						emptyMessage={activeOverlay === 'followers'
							? 'No followers yet'
							: 'Not following anyone yet'}
						onUserClick={(clickedUser) => {
							sidenavStore.hideOverlay();
							const newPath = `/${clickedUser.username}`;
							const currentPath = $page.url.pathname;

							// Check if both are username routes
							if (isUsernameRoute(currentPath) && isUsernameRoute(newPath)) {
								// Force full page reload for username-to-username navigation
								window.location.href = newPath;
							} else {
								goto(newPath);
							}
						}}
					/>
				{/if}
			</div>
		{/if}
	{/if}
	{#if $showRightSidenav}
		<div class="sidebar-container">
			<PostTrends on:followUser={handleFollowUser} />
		</div>
	{/if}
</div>

{#if $showDebug}
	<Debugger
		showDebug={$showDebug}
		title="🔄 Profile Scroll Debug"
		debugItems={profileDebugItems}
		buttons={profileDebugButtons}
		maxWidth="350px"
	/>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	/* HTML: <div class="loader"></div> */
	/* HTML: <div class="loader"></div> */
	.overlay-backdrop {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.overlay-content {
		background: var(--bg-color);
		border-radius: 12px;
		max-width: 500px;
		width: 100%;
		max-height: 80vh;
		border: 1px solid var(--line-color);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.overlay-header {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--line-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--secondary-color);
	}

	.overlay-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text-color);
	}

	.close-button {
		background: transparent;
		border: none;
		color: var(--text-color);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.close-button:hover {
		background: var(--tertiary-color);
	}

	.overlay-body {
		flex: 1;
		overflow: hidden;
		padding: 0;
	}
	/* New layout styles */
	.profile-page-container {
		display: flex;
		justify-content: center;
		min-height: 100vh;
		margin-left: 1rem;
		width: calc(100% - 2rem);
		transition: all 0.3s ease;
	}

	.profile-page-container.hide-left-sidebar {
		margin-left: 0;
		justify-content: center;
		width: 100%;
		& .profile-content-wrapper {
			margin-left: 0;
			width: 100%;
		}
	}
	.profile-page-container.hide-right-sidebar {
		margin-left: 0;
		justify-content: center;
		width: 100%;
		& .profile-content-wrapper {
			margin-left: 0;
			width: 100%;
		}
	}
	.profile-page-container.hide-right-sidebar.hide-left-sidebar {
		margin-left: 0;
		justify-content: center;
	}
	.loading-trigger {
		height: 100px !important;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		position: relative;
	}
	.sidebar-container {
		position: relative;
		top: 0;
		height: 100vh;
	}
	.dm-container {
		position: absolute;
		top: 3rem;
		bottom: 3rem;
		display: flex;
		width: 100%;
		max-width: 800px;
		z-index: 1001;
		transition: all 0.3s ease;
		background: var(--bg-gradient-r-t);
	}
	.profile-content-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: center;
		max-width: 800px;
	}

	.profile-sticky-header.input-open {
		border-radius: 0;
		background: transparent;
		max-width: calc(800px - 1rem);
		margin-right: 1rem;
		border-radius: 0 0 2rem 2rem;
	}

	.profile-sticky-header {
		position: fixed;
		top: 0;
		z-index: 10;
		height: 3rem;
		width: 100%;
		max-width: 800px;
		border-radius: 0 0 2rem 2rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		background: var(--primary-color);
		user-select: none;
		& .tab-nav {
			display: flex;
			margin-left: 1rem;
		}

		& .tab {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 0.5rem 1rem;
			border: none;
			color: var(--placeholder-color);
			font-weight: 500;
			font-size: 0.8rem;
			cursor: pointer;
			// border-bottom: 3px solid transparent;
			transition: all 0.2s;
			&:hover {
				color: var(--tertiary-color);
			}
			&.active {
				color: var(--text-color);
				font-weight: 800;
				letter-spacing: 0.1rem;
			}
		}
	}

	.back-button:hover {
		background-color: rgba(var(--primary-color), 0.1);
	}

	.header-username {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.handle-wrapper {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		align-items: center;
		gap: 1rem;
	}

	.username-text {
		font-weight: 600;
		font-size: 1rem;
		color: var(--text-color);
		line-height: 1.2;
	}
	.username-login {
		font-size: 0.8rem;
		color: var(--placeholder-color);
	}

	.post-count {
		font-size: 0.8rem;
		color: var(--placeholder-color);
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.error-container h1 {
		font-size: 2rem;
		color: var(--text-color);
		margin-bottom: 8px;
	}

	.error-container p {
		color: var(--placeholder-color);
		margin-bottom: 16px;
	}
	.main-wrapper.input-open {
		padding-top: 3rem;
	}

	.main-wrapper {
		/* border-radius: 0.75rem; */
		width: 100%;
		margin-top: 0;

		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--placeholder-color);
			border-radius: 1rem;
		}
	}
	.profile-header {
		overflow: hidden;
		position: relative;
		z-index: 999;
	}

	.profile-background {
		height: 200px;
		background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
		background-size: cover;
		background-position: center;
		position: relative;
		overflow: hidden;
		transition: all 0.3s ease;
	}

	.profile-background.interactive {
		cursor: pointer;
	}

	.profile-background.interactive:hover {
		transform: scale(1.02);
	}

	.profile-background.uploading {
		pointer-events: none;
	}

	.upload-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 500;
		gap: 8px;
	}

	.upload-icon {
		font-size: 2rem;
	}

	.upload-spinner {
		width: 24px;
		height: 24px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top: 3px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.user-bio {
		margin: 12px 0;
		color: var(--text-secondary);
		line-height: 1.4;
		position: relative;
		transition: all 0.2s ease;
	}

	.user-bio.editable {
		cursor: pointer;
		padding: 0 0.5rem;
		border-radius: 8px;
		margin: 12px -8px;
	}

	.user-bio.editable:hover {
		background: var(--background-secondary);
	}

	.user-bio.empty {
		font-style: italic;
	}

	.placeholder-text {
		color: var(--text-muted);
	}

	.edit-hint {
		position: absolute;
		top: -30px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--background-elevated);
		color: var(--text-primary);
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		box-shadow: var(--shadow-sm);
		white-space: nowrap;
		z-index: 10;
	}

	.edit-hint::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: var(--background-elevated);
	}

	.description-edit {
		margin: 12px 0;
	}

	.description-input {
		width: calc(100% - 2rem);
		padding: 0.5rem;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		background: var(--secondary-color);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.9rem;
		line-height: 1.4;
		resize: vertical;
		min-height: 80px;
	}

	.description-input:focus {
		outline: none;
		border-color: var(--primary-color);
	}

	.description-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}

	.char-count {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.btn {
		padding: 6px 12px;
		border: none;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-sm {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
	}

	.btn-primary {
		background: transparent;
		color: var(--placeholder-color) !important;
		display: flex;
	}
	.btn-primary.active {
		background-color: var(--secondary-color) !important;
		color: var(--text-color) !important;
	}
	.btn-primary:hover {
		background: var(--primary-color);
		color: var(--tertiary-color) !important;
	}

	.btn-secondary {
		background: var(--background-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.btn-secondary:hover {
		background: var(--background-tertiary);
	}

	.user-bio.secondary {
		opacity: 0.8;
		font-style: italic;
		margin-top: 0.5rem;
	}
	.profile-info {
		padding: 1rem;
		position: relative;
	}
	.avatar-header {
		display: flex;
		position: relative;
		width: auto;
		margin-right: 0.5rem;

		& img {
			width: 2.5rem;
			height: 2.5rem;
			object-fit: cover;
			border: 1px solid var(--bg-color);
		}
	}

	.avatar-section {
		position: absolute;
		top: -60px;
		right: 24px;
	}

	.profile-avatar {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		border: 4px solid var(--bg-color);
		object-fit: cover;
	}
	.sticky-avatar {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: 4px solid var(--bg-color);
		object-fit: cover;
	}
	.user-name {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-color);
		margin-bottom: 4px;
		margin-top: 0;
	}

	.username {
		color: var(--placeholder-color);
		font-size: 1.1rem;
		margin-bottom: 16px;
	}

	.user-meta {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 16px;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--placeholder-color);
		font-size: 0.9rem;
	}

	.meta-item a {
		color: var(--primary-color);
		text-decoration: none;
	}

	.meta-item a:hover {
		text-decoration: underline;
	}

	.user-stats {
		display: flex;
		gap: 24px;
		margin-bottom: 0.5rem;
	}

	.stat {
		text-align: center;
	}

	.stat-number {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-color);
	}

	.stat-label {
		color: var(--placeholder-color);
		font-size: 0.9rem;
	}

	.action-buttons {
		display: flex;
		gap: 12px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 8px;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-outline {
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--line-color);
	}

	.btn-outline:hover {
		background: var(--line-color);
	}

	.profile-content {
		background: var(--bg-color);
		border-radius: 12px;
		overflow: hidden;
	}
	.loading-trigger {
		height: 100px;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
	}
	.trigger-loader {
		width: 20px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--tertiary-color);
		box-shadow: 0 0 0 0 var(--tertiary-color);
		animation: l2 1.5s infinite linear;
		position: relative;
	}
	.trigger-loader:before,
	.trigger-loader:after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: 0 0 0 0 var(--tertiary-color);
		animation: inherit;
		animation-delay: -0.5s;
	}
	.trigger-loader:after {
		animation-delay: -1s;
	}
	@keyframes l2 {
		100% {
			box-shadow: 0 0 0 40px var(--primary-color);
		}
	}
	.tab-nav {
		display: flex;
		padding: 0.5rem 0;
	}

	.tab {
		padding: 1rem 1.5rem 0.5rem 0;
		background: none;
		border: none;
		color: var(--placeholder-color);
		font-weight: 500;
		font-size: 1rem;
		cursor: pointer;
		border-bottom: 3px solid transparent;
		transition: all 0.2s;
	}

	.tab.active {
		color: var(--text-color);
		font-weight: 800;
		letter-spacing: 0.1rem;
	}

	.tab:hover {
		color: var(--text-color);
	}

	.posts-section {
		padding: 0 0.5rem;
		/* padding: 20px; */
	}

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: var(--placeholder-color);
	}
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		text-align: center;
		gap: 16px;
	}
	.status-indicator {
		position: absolute;
		top: 0;
		left: 0;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;

		&.online {
			background: #4ade80;
			border: 2px solid var(--bg-color);
		}
	}

	@media (max-width: 768px) {
		.overlay-backdrop {
			padding: 0.5rem;
		}

		.overlay-content {
			max-height: 90vh;
		}

		.overlay-header {
			padding: 0.75rem 1rem;
		}

		.overlay-header h3 {
			font-size: 16px;
		}

		.stat-number {
			font-weight: 600;
			margin-right: 0.25rem;
		}

		.tab.activeOverlay {
			background: var(--primary-color);
			color: var(--bg-color);
		}
		.profile-content-wrapper {
			padding: 1rem 0.5rem;
		}

		.main-wrapper {
			width: 100%;
			border-radius: 0.5rem;
		}

		.profile-info {
			padding: 16px;
		}

		.avatar-section {
			left: 16px;
		}

		.user-details {
			margin-top: 40px;
		}

		.profile-avatar {
			width: 80px;
			height: 80px;
		}

		.user-name {
			font-size: 1.5rem;
		}

		.action-buttons {
			flex-wrap: wrap;
		}

		.btn {
			flex: 1;
			justify-content: center;
		}
	}
</style>
