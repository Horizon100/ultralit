import { get } from 'svelte/store';
import { threadsStore } from '$lib/stores/threadsStore';
import { projectStore } from '$lib/stores/projectStore';
import { messagesStore } from '$lib/stores/messagesStore';
import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
import { createThread, threadListVisibility, deleteThread } from '$lib/clients/threadsClient';
import { updateThreadNameIfNeeded } from '$lib/features/threads/utils/threadNaming';
import type { Threads, AIModel } from '$lib/types/types';

interface ThreadResponse {
	threads?: Threads[];
	data?: Threads[];
	success?: boolean;
	error?: string;
	thread?: Threads;
}

export class ThreadService {
	private static isLoadingThreads = false;
	private static lastLoadedProjectId: string | null = null;

	/**
	 * Loads threads for a specific project or all threads for the user
	 */
	static async loadProjectThreads(projectId?: string): Promise<void> {
		const isLoadingAllThreads = !projectId;
		const currentState = get(threadsStore);

		// Prevent duplicate loading in quick succession
		if (this.isLoadingThreads) {
			console.log(`Already loading threads, skipping request`);
			return;
		}

		// Check if we're reloading the same project/all threads
		if (!isLoadingAllThreads && projectId === currentState.project_id) {
			console.log(`Project ${projectId} threads already loaded, skipping duplicate request`);
			return;
		}

		if (
			isLoadingAllThreads &&
			currentState.project_id === null &&
			currentState.threads.length > 0
		) {
			console.log('All threads already loaded, skipping duplicate request');
			return;
		}

		this.isLoadingThreads = true;
		this.lastLoadedProjectId = projectId || null;

		console.log(
			isLoadingAllThreads
				? 'Loading all threads for user (including unassigned)'
				: `Loading threads for project ${projectId}`
		);

		// Reset thread loading state
		threadsStore.update((state) => ({
			...state,
			threads: [],
			searchedThreads: [],
			isThreadsLoaded: false,
			loadingError: null
		}));

		try {
			let fetchedThreads: Threads[] = [];

			if (isLoadingAllThreads) {
				fetchedThreads = await this.loadAllThreadsIncludingUnassigned();
			} else {
				// Get threads for a specific project using the existing endpoint
				fetchedThreads = await this.fetchThreadsForProject(projectId);
				console.log(`Fetched ${fetchedThreads.length} threads for project ${projectId}`);
			}

			if (!Array.isArray(fetchedThreads)) {
				throw new Error('Unexpected threads response format');
			}

			// Ensure each thread has the project_id set correctly
			const validatedThreads = fetchedThreads.map((thread) => ({
				...thread,
				project_id: thread.project_id || thread.project || projectId || null
			}));

			threadsStore.update((state) => {
				// Apply the current search query if it exists
				let filteredThreads = validatedThreads;
				if (state.searchQuery) {
					filteredThreads = validatedThreads.filter((thread) =>
						thread.name?.toLowerCase().includes(state.searchQuery.toLowerCase())
					);
				}

				return {
					...state,
					threads: validatedThreads,
					searchedThreads: filteredThreads,
					isThreadsLoaded: true,
					showThreadList: true,
					project_id: projectId || null
				};
			});

			const logMessage = isLoadingAllThreads
				? `Updated threadsStore with ${validatedThreads.length} threads for user (including unassigned)`
				: `Updated threadsStore with ${validatedThreads.length} threads for project ${projectId}`;
			console.log(logMessage);
		} catch (error) {
			console.error(
				isLoadingAllThreads ? 'Error loading all threads:' : `Error loading project threads:`,
				error
			);

			threadsStore.update((state) => ({
				...state,
				loadingError: error instanceof Error ? error.message : 'Failed to load threads',
				isThreadsLoaded: true
			}));
		} finally {
			// Reset loading state after a delay to prevent immediate reloading
			setTimeout(() => {
				this.isLoadingThreads = false;
			}, 500);
		}
	}

	/**
	 * Loads all threads including unassigned ones using the enhanced endpoint
	 */
	private static async loadAllThreadsIncludingUnassigned(): Promise<Threads[]> {
		try {
			console.log('Loading all threads including unassigned...');

			// Use the existing endpoint without project parameter to get all threads
			const response = await fetch('/api/threads', {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${get(currentUser)?.token || ''}`
				}
			});

			if (response.ok) {
				const data: ThreadResponse = await response.json();
				const allThreads: Threads[] = data.threads || data.data || [];

				// Sort by updated date (newest first)
				allThreads.sort(
					(a: Threads, b: Threads) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
				);

				const unassignedCount = allThreads.filter((t: Threads) => !t.project_id).length;
				console.log(`Loaded ${allThreads.length} threads total (${unassignedCount} unassigned)`);

				return allThreads;
			} else {
				console.warn('Failed to fetch all threads:', response.status);
				return [];
			}
		} catch (err) {
			console.error('Error loading all threads:', err);
			return [];
		}
	}

	/**
	 * Fetches threads for a specific project using the enhanced endpoint
	 */
	private static async fetchThreadsForProject(projectId: string): Promise<Threads[]> {
		try {
			console.log(`Fetching threads for project ${projectId}...`);

			const response = await fetch(`/api/threads?project=${encodeURIComponent(projectId)}`, {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${get(currentUser)?.token || ''}`
				}
			});

			if (response.ok) {
				const data: ThreadResponse = await response.json();
				const projectThreads: Threads[] = data.threads || data.data || [];

				console.log(`Fetched ${projectThreads.length} threads for project ${projectId}`);
				return projectThreads;
			} else {
				console.warn(`Failed to fetch threads for project ${projectId}:`, response.status);
				return [];
			}
		} catch (err) {
			console.error(`Error fetching threads for project ${projectId}:`, err);
			return [];
		}
	}

	/**
	 * Explicitly loads only unassigned threads
	 */
	static async loadUnassignedThreads(): Promise<Threads[]> {
		try {
			console.log('Loading unassigned threads only...');

			const response = await fetch('/api/threads?unassigned=true', {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${get(currentUser)?.token || ''}`
				}
			});

			if (response.ok) {
				const data: ThreadResponse = await response.json();
				const unassignedThreads: Threads[] = data.threads || data.data || [];

				console.log(`Loaded ${unassignedThreads.length} unassigned threads`);
				return unassignedThreads;
			} else {
				console.warn('Failed to fetch unassigned threads:', response.status);
				return [];
			}
		} catch (err) {
			console.error('Error loading unassigned threads:', err);
			return [];
		}
	}

	/**
	 * Loads a specific thread and its messages
	 */
	static async loadThread(threadId: string): Promise<Threads | null> {
		try {
			const threadResponse = await fetch(`/api/keys/threads/${threadId}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!threadResponse.ok) {
				throw new Error('Failed to fetch thread');
			}

			const threadData = await threadResponse.json();
			if (!threadData.success) {
				throw new Error(threadData.error || 'Failed to fetch thread');
			}

			return threadData.thread as Threads;
		} catch (error) {
			console.error(`Error loading thread ${threadId}:`, error);
			return null;
		}
	}

	/**
	 * Creates a new thread
	 */
	static async createNewThread(): Promise<Threads | null> {
		try {
			await ensureAuthenticated();

			const user = get(currentUser);
			if (!user?.id) {
				throw new Error('User information not available');
			}

			const currentProjectId = get(projectStore).currentProjectId;

			const threadData = {
				op: user.id,
				name: `(untitled)`,
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				current_thread: '',
				project: currentProjectId || '',
				project_id: currentProjectId || ''
			};

			console.log('Attempting to create thread with data:', threadData);

			let newThread;

			try {
				const response = await fetch('/api/threads', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${user.token}`
					},
					credentials: 'include',
					body: JSON.stringify(threadData)
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`Error response from thread creation: ${response.status} - ${errorText}`);
					throw new Error(`Failed to create thread: ${response.status}`);
				}

				const data = await response.json();
				newThread = data.thread || data.data;
			} catch (apiError) {
				console.warn('API thread creation failed, using client fallback:', apiError);
				newThread = await createThread(threadData);
			}

			if (!newThread?.id) {
				throw new Error('No thread ID returned from creation');
			}

			// Update stores
			threadsStore.update((state) => ({
				...state,
				currentThreadId: newThread.id,
				threads: [newThread, ...state.threads]
			}));

			threadListVisibility.set(false);

			// Load the new thread
			await this.loadThread(newThread.id);

			return newThread;
		} catch (error) {
			console.error('Error creating thread:', error);
			return null;
		}
	}

	/**
	 * Deletes a thread
	 */
	static async deleteThread(threadId: string): Promise<boolean> {
		try {
			const result = await deleteThread(threadId);
			if (result.success) {
				threadsStore.update((state) => ({
					...state,
					threads: state.threads.filter((t) => t.id !== threadId),
					currentThreadId: state.currentThreadId === threadId ? null : state.currentThreadId
				}));
				return true;
			} else {
				console.error('Error deleting thread:', result.error);
				return false;
			}
		} catch (error) {
			console.error('Error deleting thread:', error);
			return false;
		}
	}

	/**
	 * Updates thread name if needed
	 */
	static async updateThreadNameIfNeeded(
		threadId: string,
		aiModel: AIModel,
		userId: string
	): Promise<void> {
		try {
			const currentMessages = await messagesStore.fetchMessages(threadId);
			if (currentMessages?.length > 0) {
				const robotMessages = currentMessages.filter((m) => m.type === 'robot');
				if (robotMessages.length === 1) {
					// Store current thread state before updates
					const currentState = get(threadsStore);

					// Set naming state
					threadsStore.update((state) => ({
						...state,
						namingThreadId: threadId,
						isNaming: true
					}));

					try {
						const threadToUpdate = currentState.threads.find((t) => t.id === threadId);

						if (!threadToUpdate) {
							// If thread isn't in the store, fetch it from the API
							await this.fetchAndUpdateThread(threadId);
						}

						await updateThreadNameIfNeeded(threadId, currentMessages, aiModel, userId);

						threadsStore.update((state) => ({
							...state,
							currentThreadId: threadId
						}));
					} finally {
						threadsStore.update((state) => ({
							...state,
							namingThreadId: null,
							isNaming: false
						}));
						threadListVisibility.set(false);
					}
				}
			}
		} catch (error) {
			console.error('Thread name update failed:', error);
			// Clear naming state on error
			threadsStore.update((state) => ({
				...state,
				namingThreadId: null,
				isNaming: false
			}));
		}
	}

	/**
	 * Verifies if user has access to a thread
	 */
	private static async verifyThreadAccess(thread: Threads, userId: string): Promise<boolean> {
		// Get project access
		let hasProjectAccess = false;
		if (thread.project) {
			const projectId =
				typeof thread.project === 'string' ? thread.project : (thread.project as { id: string }).id;

			try {
				const projectResponse = await fetch(`/api/projects/${projectId}/threads`, {
					method: 'GET',
					credentials: 'include'
				});

				if (projectResponse.ok) {
					const projectData = await projectResponse.json();
					if (projectData.success) {
						const project = projectData.data;
						hasProjectAccess =
							project.owner === userId ||
							(project.collaborators &&
								(Array.isArray(project.collaborators)
									? project.collaborators.includes(userId)
									: project.collaborators.split(',').includes(userId)));
					}
				}
			} catch (err) {
				console.error('Error fetching project:', err);
			}
		}

		// Verify thread ownership/access
		const isCreator = thread.user === userId;
		const isOp = thread.op === userId || (thread.expand?.op && thread.expand.op.id === userId);

		// Check if user is a member
		const isMember =
			thread.members &&
			((typeof thread.members === 'string' && thread.members.includes(userId)) ||
				(Array.isArray(thread.members) &&
					thread.members.some((m: unknown) =>
						typeof m === 'string'
							? m === userId
							: typeof m === 'object' &&
								m !== null &&
								'id' in m &&
								(m as { id: string }).id === userId
					)));

		// Allow access if user is creator, op, member, or has project access
		return isCreator || isOp || isMember || hasProjectAccess;
	}

	/**
	 * Handles project context for a thread
	 */
	private static async handleProjectContext(project: string | { id: string }): Promise<void> {
		const projectId = typeof project === 'string' ? project : project.id;
		await projectStore.setCurrentProject(projectId);

		try {
			const projectThreadsResponse = await fetch(`/api/projects/${projectId}/threads`, {
				method: 'GET',
				credentials: 'include'
			});

			if (projectThreadsResponse.ok) {
				const projectThreadsData = await projectThreadsResponse.json();
				if (projectThreadsData.success) {
					threadsStore.update((state) => ({
						...state,
						threads: projectThreadsData.threads || []
					}));
				}
			}
		} catch (err) {
			console.error('Error fetching project threads:', err);
		}
	}

	/**
	 * Loads messages for a thread
	 */
	private static async loadThreadMessages(threadId: string): Promise<void> {
		try {
			await messagesStore.fetchMessages(threadId);
		} catch (err) {
			console.error('Error loading messages:', err);
		}
	}

	/**
	 * Fetches and updates a thread in the store
	 */
	private static async fetchAndUpdateThread(threadId: string): Promise<void> {
		try {
			const response = await fetch(`/api/keys/threads/${threadId}`, {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${get(currentUser)?.token || ''}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				if (data.thread) {
					threadsStore.update((state) => ({
						...state,
						threads: [data.thread, ...state.threads.filter((t) => t.id !== threadId)]
					}));
				}
			}
		} catch (fetchError) {
			console.error('Failed to fetch thread:', fetchError);
		}
	}
}
