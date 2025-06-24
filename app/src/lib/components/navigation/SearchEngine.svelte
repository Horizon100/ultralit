<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { currentUser } from '$lib/pocketbase';
	import { get } from 'svelte/store';

	import { projectStore } from '$lib/stores/projectStore';
	import { threadsStore } from '$lib/stores/threadsStore';
	import { messagesStore } from '$lib/stores/messagesStore';
	import { postStore } from '$lib/stores/postStore';
	import { goto } from '$app/navigation';
	import { t } from '$lib/stores/translationStore';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	import type { Projects, Threads, Messages, Task } from '$lib/types/types';
	import type { Post, PostWithInteractions } from '$lib/types/types.posts';

	export let placeholder = 'Search projects, threads, messages, tasks...';
	export let size: 'small' | 'medium' | 'large' = 'medium';
	export let isFocused = false;

	let searchQuery = '';
	let searchInput: HTMLInputElement;
	let dropdownContainer: HTMLElement;
	let isExpanded = false;
	let isLoading = false;
	let activeTab = 'all';
	let multipleTabsAvailable = false;
	let isMouseInside = false;

	// Search results
	let projectResults: Projects[] = [];
	let threadResults: Threads[] = [];
	let messageResults: Messages[] = [];
	let taskResults: Task[] = [];
	let postResults: PostWithInteractions[] = [];

	// Search configuration
	let searchCategories = {
		projects: true,
		threads: true,
		messages: true,
		tasks: true,
		posts: true
	};

	// Debounce timer
	let searchTimer: NodeJS.Timeout;

	$: {
		if (searchTimer) clearTimeout(searchTimer);

		if (searchQuery.trim()) {
			searchTimer = setTimeout(() => {
				searchGlobal();
			}, 300);
		} else {
			clearResults();
		}
	}
	function clearResults() {
		projectResults = [];
		threadResults = [];
		messageResults = [];
		taskResults = [];
		postResults = [];
		isExpanded = false;
	}

	function handleInputFocus() {
		isFocused = true;
		if (searchQuery.trim() && hasResults()) {
			isExpanded = true;
		}
	}

	function handleInputBlur() {
		isFocused = false;
		setTimeout(() => {
			isExpanded = false;
		}, 200);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			searchQuery = '';
			clearResults();
			searchInput.blur();
		}
	}
	function handleClickOutside(event: MouseEvent) {
		if (dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
			isExpanded = false;
		}
	}
	function setActiveTab(tab: string): void {
		activeTab = tab;
		console.log('Tab changed to:', tab);
	}

	function hasMultipleTabs() {
		let count = 0;
		if (projectResults.length > 0) count++;
		if (threadResults.length > 0) count++;
		if (messageResults.length > 0) count++;
		if (postResults.length > 0) count++;
		if (taskResults.length > 0) count++;

		return count > 1;
	}
	$: multipleTabsAvailable = hasMultipleTabs();

	$: {
		if (hasResults() && !multipleTabsAvailable) {
			if (projectResults.length > 0) activeTab = 'projects';
			else if (threadResults.length > 0) activeTab = 'threads';
			else if (messageResults.length > 0) activeTab = 'messages';
			else if (postResults.length > 0) activeTab = 'posts';
			else if (taskResults.length > 0) activeTab = 'tasks';
		}
	}
	$: if (isMouseInside && !isExpanded && hasResults()) {
		isExpanded = true;
	}
	function hasResults(): boolean {
		return (
			projectResults.length > 0 ||
			threadResults.length > 0 ||
			messageResults.length > 0 ||
			taskResults.length > 0 ||
			postResults.length > 0
		);
	}
	async function searchGlobal() {
		if (!searchQuery.trim()) {
			clearResults();
			return;
		}

		isLoading = true;

		try {
			// Get the current user
			const user = get(currentUser);
			const isAuthenticated = !!user;

			// For posts, always search (available to all users)
			const postSearchPromise = searchCategories.posts ? loadAndSearchPosts() : Promise.resolve();

			// Only search authenticated-only content if the user is logged in
			const promises = [postSearchPromise];

			if (isAuthenticated) {
				// Add authenticated-only searches
				if (searchCategories.projects) promises.push(loadAndSearchProjects());
				if (searchCategories.threads) promises.push(loadAndSearchThreads());
				if (searchCategories.messages) promises.push(loadAndSearchMessages());
				if (searchCategories.tasks) promises.push(loadAndSearchTasks());
			}

			await Promise.all(promises);

			// Only expand if we have results
			if (hasResults()) {
				isExpanded = true;
			}
		} catch (error) {
			console.error('Search error:', error);
		} finally {
			isLoading = false;
		}
	}

	async function loadAndSearchProjects() {
		// Ensure projects are loaded
		if ($projectStore.threads.length === 0) {
			await projectStore.loadProjects();
		}

		// Search projects
		const allProjects = $projectStore.threads;
		projectResults = allProjects
			.filter(
				(project) =>
					project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					project.description?.toLowerCase().includes(searchQuery.toLowerCase())
			)
			.slice(0, 5); // Limit to 5 results
	}

	async function loadAndSearchThreads() {
		// Ensure threads are loaded
		if (!$threadsStore.isThreadsLoaded || $threadsStore.threads.length === 0) {
			await threadsStore.loadThreads();
		}

		// Search threads
		const allThreads = $threadsStore.threads;
		threadResults = allThreads
			.filter(
				(thread) =>
					thread.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					thread.description?.toLowerCase().includes(searchQuery.toLowerCase())
			)
			.slice(0, 5); // Limit to 5 results
	}

	async function loadAndSearchMessages() {
		try {
			// Get current project context for more relevant results
			const currentProject = get(projectStore);
			const projectId = currentProject.currentProjectId;

			// Build search URL with optional project filter
			let searchUrl = `/api/messages/search?q=${encodeURIComponent(searchQuery)}&limit=10`;
			if (projectId) {
				searchUrl += `&project=${projectId}`;
			}

			const response = await fetch(searchUrl, {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				messageResults = data.messages || [];
			} else {
				console.error('Failed to search messages via API:', response.statusText);
				// Fallback to searching through current messages in store
				console.log('Falling back to local message search...');
				await searchMessagesLocally();
			}
		} catch (error) {
			console.error('Error searching messages via API:', error);
			// Fallback to searching through current messages in store
			console.log('Falling back to local message search...');
			await searchMessagesLocally();
		}
	}

	async function searchMessagesLocally() {
		try {
			// Get current messages from store
			const currentMessages = get(messagesStore);
			const messages = currentMessages.messages || [];

			if (messages.length === 0) {
				// If no messages in store, try to load them for current thread
				const currentThread = get(threadsStore);
				if (currentThread.currentThreadId) {
					const fetchedMessages = await messagesStore.fetchMessages(currentThread.currentThreadId);
					messageResults = fetchedMessages
						.filter((message) => message.text?.toLowerCase().includes(searchQuery.toLowerCase()))
						.slice(0, 10);
				} else {
					messageResults = [];
				}
			} else {
				// Search through current messages
				messageResults = messages
					.filter((message) => message.text?.toLowerCase().includes(searchQuery.toLowerCase()))
					.map((message) => ({
						...message,
						threadName:
							$threadsStore.threads.find((t) => t.id === message.thread)?.name || 'Unknown Thread',
						threadId: message.thread
					}))
					.slice(0, 10);
			}
		} catch (error) {
			console.error('Error in local message search:', error);
			messageResults = [];
		}
	}
	async function loadAndSearchTasks() {
		try {
			const user = get(currentUser);

			if (!user) {
				taskResults = [];
				return;
			}

			// Get current project context for more relevant results
			const currentProject = get(projectStore);
			const projectId = currentProject.currentProjectId;

			// Build search URL with optional project filter
			let searchUrl = `/api/tasks/search?q=${encodeURIComponent(searchQuery)}&limit=5`;
			if (projectId) {
				searchUrl += `&project=${projectId}`;
			}

			const response = await fetch(searchUrl, {
				method: 'GET',
				credentials: 'include', // Include credentials for authenticated requests
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				taskResults = data.tasks || [];
			} else {
				console.error('Failed to search tasks via API:', response.statusText);
				taskResults = [];
			}
		} catch (error) {
			console.error('Error searching tasks:', error);
			taskResults = [];
		}
	}

	async function loadAndSearchPosts() {
		try {
			// Create the search URL
			let searchUrl = `/api/posts/search?q=${encodeURIComponent(searchQuery)}&limit=5`;

			const response = await fetch(searchUrl, {
				method: 'GET',
				// No credentials required for post searches (allows guest access)
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				postResults = data.posts || [];
			} else {
				console.error('Failed to search posts via API:', response.statusText);
				postResults = [];
			}
		} catch (error) {
			console.error('Error searching posts:', error);
			postResults = [];
		}
	}

	async function handleProjectSelect(project: Projects) {
		console.log('handleProjectSelect called with project:', project);

		try {
			// Set current project first
			await projectStore.setCurrentProject(project.id);

			// Build the URL
			const url = '/dashboard';
			console.log('Navigating to URL:', url);

			// Close the dropdown
			searchQuery = '';
			clearResults();
			isExpanded = false;

			// Navigate
			try {
				await goto(url);
			} catch (error) {
				console.error('goto navigation failed, using window.location:', error);
				window.location.href = url;
			}
		} catch (error) {
			console.error('Navigation error:', error);
		}
	}

	async function handleThreadSelect(thread: Threads) {
		console.log('handleThreadSelect called with thread:', thread);

		try {
			// Set current thread first
			await threadsStore.setCurrentThread(thread.id);

			// If thread belongs to a project, set that project first
			if (thread.project_id) {
				await projectStore.setCurrentProject(thread.project_id);
			} else {
				// If thread is unassigned, clear project
				await projectStore.setCurrentProject(null);
			}

			// Build the URL
			const url = `/chat?threadId=${thread.id}`;
			console.log('Navigating to URL:', url);

			// Close the dropdown
			searchQuery = '';
			clearResults();
			isExpanded = false;

			// Navigate
			try {
				await goto(url);
			} catch (error) {
				console.error('goto navigation failed, using window.location:', error);
				window.location.href = url;
			}
		} catch (error) {
			console.error('Navigation error:', error);
		}
	}

	async function handleMessageSelect(message: Messages) {
		console.log('handleMessageSelect called with message:', message);

		try {
			if (!message.thread) {
				throw new Error('Message missing thread ID');
			}

			// Set the current thread
			await threadsStore.setCurrentThread(message.thread);

			// Find the thread to get project context
			const thread = $threadsStore.threads.find((t) => t.id === message.thread);

			if (thread?.project_id) {
				// If message's thread belongs to a project, set that project first
				await projectStore.setCurrentProject(thread.project_id);
			} else {
				// If thread is unassigned, clear project
				await projectStore.setCurrentProject(null);
			}

			// Build the URL
			const url = `/chat?threadId=${message.thread}&messageId=${message.id}`;
			console.log('Navigating to URL:', url);

			// Close the dropdown
			searchQuery = '';
			clearResults();
			isExpanded = false;

			// Navigate
			try {
				await goto(url);
			} catch (error) {
				console.error('goto navigation failed, using window.location:', error);
				window.location.href = url;
			}
		} catch (error) {
			console.error('Navigation error:', error);
		}
	}

	async function handleTaskSelect(task: Task) {
		console.log('handleTaskSelect called with task:', task);

		try {
			// If task belongs to a project, set that project first
			if (task.project_id) {
				await projectStore.setCurrentProject(task.project_id);
			}

			// Build the URL
			const url = `/tasks/${task.id}`;
			console.log('Navigating to URL:', url);

			// Close the dropdown
			searchQuery = '';
			clearResults();
			isExpanded = false;

			// Navigate
			try {
				await goto(url);
			} catch (error) {
				console.error('goto navigation failed, using window.location:', error);
				window.location.href = url;
			}
		} catch (error) {
			console.error('Navigation error:', error);
		}
	}

	async function handlePostSelect(post: PostWithInteractions) {
		console.log('handlePostSelect called with post:', post);

		// Check if author_username exists
		if (!post.author_username) {
			console.error('Post is missing author_username:', post);
		}

		try {
			const url = post.author_username
				? `/${post.author_username}/posts/${post.id}`
				: `/posts/${post.id}`;

			console.log('Navigating to URL:', url);
			await goto(url);
			console.log('Navigation completed');

			searchQuery = '';
			clearResults();
			searchInput.blur();
		} catch (error) {
			console.error('Navigation error:', error);
		}
	}

	onMount(() => {
		let isMouseInside = false;

		// Handle when mouse enters the search results
		const handleMouseEnter = () => {
			isMouseInside = true;
		};

		// Handle when mouse leaves the search results
		const handleMouseLeave = () => {
			isMouseInside = false;
		};

		// Handle click/mousedown events
		const handleOutsideClick = (e: MouseEvent) => {
			const searchResults = document.querySelector('.search-results');

			// If element exists and click is inside it, prevent propagation
			if (searchResults && searchResults.contains(e.target as Node)) {
				e.stopPropagation();

				// If it's specifically a tab button click, make sure we update the state
				if ((e.target as HTMLElement).closest('.tab-button')) {
					const tabButton = (e.target as HTMLElement).closest('.tab-button');
					// Force tab change directly in case the event handler didn't work
					if (tabButton) {
						const tabType = tabButton.textContent?.trim().toLowerCase().split(' ')[0];
						if (tabType === 'projects') setActiveTab('projects');
						else if (tabType === 'threads') setActiveTab('threads');
						else if (tabType === 'messages') setActiveTab('messages');
						else if (tabType === 'posts') setActiveTab('posts');
						else if (tabType === 'tasks') setActiveTab('tasks');
						else if (tabType === 'all') setActiveTab('all');
					}
				}
			}
		};

		const searchResultsElement = document.querySelector('.search-results');
		if (searchResultsElement) {
			searchResultsElement.addEventListener('mouseenter', handleMouseEnter);
			searchResultsElement.addEventListener('mouseleave', handleMouseLeave);
		}

		document.addEventListener('click', handleOutsideClick, true);
		document.addEventListener('mousedown', handleOutsideClick, true);

		const keepSearchResultsOpen = () => {
			if (isMouseInside && isExpanded) {
				setTimeout(() => {
					if (isMouseInside && !isExpanded) {
						isExpanded = true;
					}
				}, 10);
			}
		};

		const observer = new MutationObserver((mutations) => {
			if (isMouseInside) {
				keepSearchResultsOpen();
			}
		});

		const searchParent = searchResultsElement?.parentElement;
		if (searchParent) {
			observer.observe(searchParent, { childList: true, subtree: true });
		}

		return () => {
			document.removeEventListener('click', handleOutsideClick, true);
			document.removeEventListener('mousedown', handleOutsideClick, true);

			if (searchResultsElement) {
				searchResultsElement.removeEventListener('mouseenter', handleMouseEnter);
				searchResultsElement.removeEventListener('mouseleave', handleMouseLeave);
			}

			observer.disconnect();
		};
	});
</script>

<div
	class="search-engine"
	class:size-small={size === 'small'}
	class:size-medium={size === 'medium'}
	class:size-large={size === 'large'}
>
	<div class="search-input-container" bind:this={dropdownContainer}>


		{#if isExpanded && hasResults()}
			<div
				class="search-results"
				transition:slide={{ duration: 200 }}
				on:click|stopPropagation={() => {}}
				on:mousedown|stopPropagation={() => {}}
				on:mouseenter|stopPropagation={() => (isMouseInside = true)}
				on:mouseleave|stopPropagation={() => (isMouseInside = false)}
			>


				<div class="results-container">
					<!-- Project Results -->
					{#if projectResults.length > 0 && (activeTab === 'projects' || activeTab === 'all')}
						<div class="result-section">
							{#each projectResults as project}
								<a
									href="/dashboard?projectId={project.id}"
									class="result-item project-result"
									on:click|preventDefault={(event) => {
										event.preventDefault();
										console.log('Project clicked:', project.id);
										handleProjectSelect(project);
									}}
									tabindex="0"
									role="link"
									transition:fade={{ duration: 150 }}
								>
									<div class="result-content">
										<span class="result-title">{project.name}</span>
										{#if project.description}
											<span class="result-description">{project.description}</span>
										{/if}
									</div>
									<span class="result-arrow">
										{@html getIcon('ArrowRight', { size: 14 })}
									</span>
								</a>
							{/each}
						</div>
					{/if}

					<!-- Thread Results -->
					{#if threadResults.length > 0 && (activeTab === 'threads' || activeTab === 'all')}
						<div class="result-section">
							{#each threadResults as thread}
								<a
									href="/chat?threadId={thread.id}"
									class="result-item thread-result"
									on:click|preventDefault={(event) => {
										event.preventDefault();
										console.log('Thread clicked:', thread.id);
										handleThreadSelect(thread);
									}}
									tabindex="0"
									role="link"
									transition:fade={{ duration: 150 }}
								>
									<div class="result-content">
										<span class="result-title">{thread.name}</span>
										{#if thread.project_id}
											<span class="result-meta">in project</span>
										{/if}
									</div>
									<span class="result-arrow">
										{@html getIcon('ArrowRight', { size: 14 })}
									</span>
								</a>
							{/each}
						</div>
					{/if}

					<!-- Message Results -->
					{#if messageResults.length > 0 && (activeTab === 'messages' || activeTab === 'all')}
						<div class="result-section">
							{#each messageResults as message}
								<a
									href="/chat?threadId={message.thread}&messageId={message.id}"
									class="result-item message-result"
									on:click|preventDefault={(event) => {
										event.preventDefault();
										console.log('Message clicked:', message.id);
										handleMessageSelect(message);
									}}
									tabindex="0"
									role="link"
									transition:fade={{ duration: 150 }}
								>
									<div class="result-content">
										<span class="result-title">
											{message.text
												? message.text.length > 80
													? message.text.substring(0, 80) + '...'
													: message.text
												: 'Empty Message'}
										</span>
										<div class="result-meta">
											<span class="thread-name"
												>{$t('generic.in')} {message.threadName || 'Unknown Thread'}</span
											>
											{#if message.userName}
												<span class="separator">•</span>
												<span class="user-name">{$t('generic.by')} {message.userName}</span>
											{/if}
											{#if message.created}
												<span class="separator">•</span>
												<span class="message-date"
													>{new Date(message.created).toLocaleDateString()}</span
												>
											{/if}
										</div>
									</div>
									<span class="result-arrow">
										{@html getIcon('ArrowRight', { size: 14 })}
									</span>
								</a>
							{/each}
						</div>
					{/if}

					<!-- Task Results -->
					{#if taskResults.length > 0 && (activeTab === 'tasks' || activeTab === 'all')}
						<div class="result-section">
							{#each taskResults as task}
								<a
									href="/tasks/{task.id}"
									class="result-item task-result"
									on:click|preventDefault={(event) => {
										event.preventDefault();
										console.log('Task clicked:', task.id);
										handleTaskSelect(task);
									}}
									tabindex="0"
									role="link"
									transition:fade={{ duration: 150 }}
								>
									<div class="result-content">
										<span class="result-title">
											{task.title || 'Untitled Task'}
										</span>
										<div class="result-meta">
											<span class="task-status">{task.status}</span>
											{#if task.due_date}
												<span class="separator">•</span>
												<span class="task-due-date"
													>{$t('tasks.due')} {new Date(task.due_date).toLocaleDateString()}</span
												>
											{/if}
											{#if task.priority}
												<span class="separator">•</span>
												<span class="task-priority {task.priority.toLowerCase()}"
													>{task.priority}</span
												>
											{/if}
										</div>
									</div>
									<span class="result-arrow">
										{@html getIcon('ArrowRight', { size: 14 })}
									</span>
								</a>
							{/each}
						</div>
					{/if}

					{#if postResults.length > 0 && (activeTab === 'posts' || activeTab === 'all')}
						<div class="result-section">
							{#each postResults as post}
								<!-- Use a direct anchor tag for better link behavior -->
								<a
									href="/{post.author_username}/posts/{post.id}"
									class="result-item post-result"
									on:click|preventDefault={(event) => {
										// Still prevent default, but DON'T stop propagation
										event.preventDefault();
										console.log('Post clicked:', post.id);
										handlePostSelect(post);
									}}
									tabindex="0"
									role="link"
									transition:fade={{ duration: 150 }}
								>
									<div class="result-content">
										<span class="result-title">
											{post.content
												? post.content.length > 80
													? post.content.substring(0, 80) + '...'
													: post.content
												: 'Empty Post'}
										</span>
										<div class="result-meta">
											{#if post.author_name || post.author_username}
												<span class="user-name"
													>{$t('generic.by')} {post.author_name || post.author_username}</span
												>
											{/if}
											{#if post.created}
												<span class="separator">•</span>
												<span class="post-date">{new Date(post.created).toLocaleDateString()}</span>
											{/if}
											{#if post.commentCount > 0}
												<span class="separator">•</span>
												<span class="comment-count"
													>{post.commentCount}
													{post.commentCount === 1 ? 'comment' : 'comments'}</span
												>
											{/if}
										</div>
									</div>
									<span class="result-arrow">
										{@html getIcon('ArrowRight', { size: 14 })}
									</span>
								</a>
							{/each}
						</div>
					{/if}

					<!-- Task Results -->
					{#if taskResults.length > 0 && (activeTab === 'tasks' || activeTab === 'all')}
						<div class="result-section">
							<!-- <div class="section-header">
            <CheckSquare size={16} class="section-icon" />
            <span>Tasks</span>
          </div> -->
							{#each taskResults as task}
								<div
									class="result-item task-result"
									on:click|stopPropagation={() => handleTaskSelect(task)}
									on:keydown={(e) => e.key === 'Enter' && handleTaskSelect(task)}
									tabindex="0"
									role="button"
									transition:fade={{ duration: 150 }}
								>
									<div class="result-content">
										<span class="result-title">
											{task.title || 'Untitled Task'}
										</span>
										<div class="result-meta">
											<span class="task-status">{task.status}</span>
											{#if task.due_date}
												<span class="separator">•</span>
												<span class="task-due-date"
													>{$t('tasks.due')}: {new Date(task.due_date).toLocaleDateString()}</span
												>
											{/if}
											{#if task.priority}
												<span class="separator">•</span>
												<span class="task-priority {task.priority.toLowerCase()}"
													>{task.priority}</span
												>
											{/if}
										</div>
									</div>
									<span class="result-arrow">
										{@html getIcon('ArrowRight', { size: 14 })}
									</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Empty state -->
					{#if searchQuery.trim() && !isLoading && !hasResults()}
						<div class="result-section">
							<div class="empty-results">
								<span>{$t('generic.noResults')} "{searchQuery}"</span>
							</div>
						</div>
					{/if}
				</div>
				<div class="tab-navigation">
					{#if projectResults.length > 0}
						<button
							class="tab-button {activeTab === 'projects' ? 'active' : ''}"
							on:click|stopPropagation={() => setActiveTab('projects')}
							on:mousedown|stopPropagation={() => {}}
						>
							{@html getIcon('Book', { size: 16 })}
							<span>{$t('profile.projects')} ({projectResults.length})</span>
						</button>
					{/if}

					{#if threadResults.length > 0}
						<button
							class="tab-button {activeTab === 'threads' ? 'active' : ''}"
							on:click|stopPropagation={() => setActiveTab('threads')}
							on:mousedown|stopPropagation={() => {}}
						>
							{@html getIcon('MessagesSquare', { size: 16 })}
							<span>{$t('threads.threads')} ({threadResults.length})</span>
						</button>
					{/if}

					{#if messageResults.length > 0}
						<button
							class="tab-button {activeTab === 'messages' ? 'active' : ''}"
							on:click|stopPropagation={() => setActiveTab('messages')}
							on:mousedown|stopPropagation={() => {}}
						>
							{@html getIcon('MessageCircle', { size: 16 })}
							<span>{$t('chat.messages')} ({messageResults.length})</span>
						</button>
					{/if}

					{#if postResults.length > 0}
						<button
							class="tab-button {activeTab === 'posts' ? 'active' : ''}"
							on:click|stopPropagation={() => setActiveTab('posts')}
							on:mousedown|stopPropagation={() => {}}
						>
							{@html getIcon('Layers', { size: 16 })}
							<span>{$t('posts.posts')} ({postResults.length})</span>
						</button>
					{/if}

					{#if taskResults.length > 0}
						<button
							class="tab-button {activeTab === 'tasks' ? 'active' : ''}"
							on:click|stopPropagation={() => setActiveTab('tasks')}
							on:mousedown|stopPropagation={() => {}}
						>
							{@html getIcon('CheckSquare', { size: 16 })}
							<span>{$t('tasks.title')} ({taskResults.length})</span>
						</button>
					{/if}

					{#if multipleTabsAvailable}
						<button
							class="tab-button {activeTab === 'all' ? 'active' : ''}"
							on:click|stopPropagation={() => setActiveTab('all')}
							on:mousedown|stopPropagation={() => {}}
						>
							{@html getIcon('Layers', { size: 16 })}
							<span>{$t('generic.all')} </span>
						</button>
					{/if}
				</div>
			</div>
		{/if}
				<div class="input-wrapper" class:expanded={isExpanded}>
			<!-- <Search class="search-icon" size={size === 'small' ? 16 : size === 'large' ? 20 : 20} /> -->
			<input
				bind:this={searchInput}
				bind:value={searchQuery}
				type="text"
				{placeholder}
				class="search-input"
				on:focus={handleInputFocus}
				on:blur={handleInputBlur}
				on:keydown={handleKeydown}
			/>
			{#if isLoading}
				<div class="loading-indicator">
					<div class="spinner"></div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.search-engine {
		position: relative;
		top: 0;
		left: 0;
		right: 0;
		margin-left: 0;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-end;
		border-radius: 1rem;
		padding-inline-start: 1rem;
		width: 100% !important;
		border: 1px solid var(--line-color);
		background: var(--bg-color);
		& .search-input-container {
			position: relative;
			width: 100% !important;
			top: 0;
			bottom: 0;
			border-radius: 1rem;
			padding: 0;
			gap: 0;
			
		}

		& .input-wrapper {
			position: relative;
			display: flex;
			flex-direction: row;
			align-items: center;
			width: 100% !important;
			// margin-left: 5rem ;
			height: 2rem;
			padding: 0;
			transition: cubic-bezier(0.55, 0.085, 0.68, 0.53);

			&.expanded {
				width: 600px;
			}
		}
		& .search-input {
			display: flex;
			flex-direction: row;
			padding: 0 !important;
			width: 500px !important;
			font-size: 0.9rem !important;
			// padding: 0.75rem 2.75rem 0.75rem 2.75rem;
			border: 1px solid transparent;
			border-radius: 8px;
			color: var(--text-color);
			transition: all 0.2s ease;
			outline: none;
			background: transparent;
			&::placeholder {
				color: var(--placeholder-color);
			}

			&:focus {
				margin-left: 0;
			}
		}
		.tab-navigation {
			display: flex;
			overflow-x: auto;
			position: relative;
			width: 100%;
			flex: 1;
			padding: 2rem;
			background-color: var(--bg-gradient-left);
			overflow-y: hidden;
			backdrop-filter: blur(2px);
		}

		.tab-button {
			display: flex;
			align-items: center;
			width: auto;
			margin: 0;
			padding: 0.5rem 1rem;
			border: none;
			background: transparent;
			color: var(--text-color);
			cursor: pointer;
			font-size: 0.7rem;
			font-weight: 500;
			transition: all 0.2s ease;
			white-space: nowrap;
			span {
				display: flex;
			}
		}

		.tab-button:hover {
			color: var(--tertiary-color);
		}

		.tab-button.active {
			color: var(--text-color);
			background: var(--secondary-color);
			border-bottom: 2px solid var(--primary-color);
		}

		&.size-small {
			.search-input {
				padding: 0.5rem 2.5rem 0.5rem 2.5rem;
				font-size: 0.875rem;
			}
			.search-icon {
				left: 0.65rem;
			}
			.loading-indicator {
				right: 0.65rem;
			}
		}

		&.size-medium {
			.search-input {
				padding: 0.75rem 2.75rem 0.75rem 2.75rem;
				font-size: 1rem;
				width: 100%;
			}
		}

		&.size-large {
			.search-input {
				padding: 0.5rem;
				font-size: 1.125rem;
				display: flex;
				justify-content: center;
				align-items: center;
			}
			.search-icon {
				left: 0.85rem;
			}
			.loading-indicator {
				right: 0.85rem;
			}
		}
	}

	.search-icon {
		position: relative;
		left: 0.75rem;
		color: var(--placeholder-color);
		pointer-events: none;
		z-index: 2;
	}

	.loading-indicator {
		position: absolute;
		right: 0.75rem;
		z-index: 2;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid var(--line-color);
		border-top: 2px solid var(--primary-color);
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

	.search-results {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: space-between;
		left: 0;
		right: 0;
		top: 0;
		bottom: 3rem;
		max-width: 1000px;
		margin-top: 0;
		z-index: 100;
		border-top: none;
		border-radius: 0 0 0.5rem 0.5rem;
		// box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		width: 100%;
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
			background: var(--secondary-color);
			border-radius: 1rem;
		}
	}

	.results-container {
		// padding: 0.5rem 0;
		width: 100%;
		padding: 0;
		margin: 0;
		max-width: 1200px;
		height: auto;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.result-section {
		height: auto;
		& + .result-section {
			padding-top: 0.5rem;
		}
	}
	.post-result {
	}
	a {
		color: var(--tertiary-color);
	}
	.section-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--tertiary-color);
		background-color: rgba(var(--primary-color-rgb), 0.05);
	}

	.section-icon {
		color: var(--primary-color);
	}

	.result-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		cursor: pointer;
		transition: background-color 0.2s ease;
		color: transparent;
		&:hover {
			background-color: var(--bg-color) !important;
		}
	}

	.result-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.result-title {
		font-weight: 500;
		color: var(--text-color);
		font-size: 0.95rem;
	}

	.result-description,
	.result-meta {
		font-size: 0.875rem;
		color: var(--placeholder-color);
	}

	.result-arrow {
		color: var(--placeholder-color);
		transition: color 0.2s ease;
		flex-shrink: 0;
	}

	.result-item:hover .result-arrow {
		color: var(--primary-color);
	}
	@media (max-width: 1000px) {
		.search-results {
			width: 100% !important;
			position: fixed;
		}
		.search-engine {
			position: absolute;
			top: 0;
			left: 0;
			margin-left: 0.5rem;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: flex-start;
			width: auto !important;
			&.expanded {
				width: 50%;
				margin-left: 10rem !important;
			}
			& .input-wrapper {
				position: relative;
				display: flex;
				flex-direction: row;
				align-items: center;
				width: auto;
				margin-left: 0 !important;
				// margin-left: 5rem ;
				height: 2rem;
				padding: 0;
				transition: cubic-bezier(0.55, 0.085, 0.68, 0.53);
				margin-left: auto;
			}
			.tab-navigation {
				display: flex;
				overflow-x: auto;
				width: 100%;
				padding: 0.5rem;
				background-color: var(--bg-gradient-left);
				border-bottom: 1px solid var(--line-color);
				border-top-left-radius: 8px;
				border-top-right-radius: 8px;
				overflow-y: hidden;
				backdrop-filter: blur(2px);
			}
			.tab-button {
				font-size: 0.7rem;
				font-weight: 500;
				transition: all 0.2s ease;
				white-space: nowrap;
				span {
					display: none;
				}
			}
			.tab-button:hover {
				color: var(--tertiary-color);
			}
			.tab-button.active {
				color: var(--text-color);
				background: var(--secondary-color);
				border-bottom: 2px solid var(--primary-color);
				& span {
					display: flex;
				}
			}
			& .search-input-container {
				position: relative;
				width: auto;
				top: auto;
				left: 0;
				justify-content: flex-start;
				border-radius: 1rem;
				padding: 0;
				gap: 0;
			}
		}
	}

	@media (max-width: 450px) {
		.search-engine {
			position: absolute;
			top: 0;
			left: 0;
			margin-left: 0.5rem;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			justify-content: flex-start;
			width: auto !important;
			& .input-wrapper {
				position: relative;
				display: flex;
				flex-direction: row;
				align-items: center;
				width: auto;
				margin-left: 0 !important;
				// margin-left: 5rem ;
				height: 2rem;
				padding: 0;
				transition: cubic-bezier(0.55, 0.085, 0.68, 0.53);
				margin-left: 0;

				&.expanded {
					width: 100%;
					margin-left: 1rem !important;
				}
			}
			& .search-input-container {
				margin-left: 0 !important;
				left: 0 !important;
				& .search-input {
					font-size: 0.8rem !important;
					margin-left: 2.5rem;
				}
			}
			& .search-results {
				position: absolute;
				left: 0;
				right: 0;
				padding: 0;
				background: var(--primary-color);
				border: 1px solid var(--line-color);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
				margin-top: 0;
				max-height: 70vh;
				z-index: 100;
				border-top: none;
				border-radius: 0 0 0.5rem 0.5rem;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
				max-height: 400px;
				width: 100%;
				overflow: hidden;
				// width: 600px !important;
				// max-height: 600px;
				overflow-y: auto;
			}
		}
	}
</style>
