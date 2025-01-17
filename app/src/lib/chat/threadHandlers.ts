import { createEventDispatcher } from 'svelte';
import { pb } from '$lib/pocketbase';

import { writable, get, derived } from 'svelte/store';
import { t } from '$lib/stores/translationStore';
import { deleteThread } from '$lib/pocketbase';

import type { ThreadGroup,ThreadStoreState, Threads } from '$lib/types/types';
import { fetchThreads, resetThread, createThread, updateThread } from '$lib/clients/threadsClient';
import { threadsStore } from '$lib/stores/threadsStore';
import { projectStore } from '$lib/stores/projectStore';
import { messagesStore} from '$lib/stores/messagesStore';
import { messageCountsStore } from '$lib/stores/messageCountStore';

import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
import { searchQuery } from '$lib/ui/interactions';
import { aiModel, showPromptCatalog} from '$lib/chat/promptHandlers';

import { messages, groupOrder, groupedMessages} from '$lib/chat/messageHandlers';
export let currentThread: Threads | null = null;
export let currentThreadId: string | null = null;
export let currentPage = 1;
export let isThreadsLoaded: boolean;


export const threadId: string | null = null;

export const isThreadListVisible = false;

import { fetchThreadsForProject} from '$lib/clients/projectClient';

export const threadVisibilityStore = writable({ 
    isThreadListVisible: false,
    isProjectListVisible: true 
});
export let expandedDates = new Set<string>();



export let userId: string;
export let threads: Threads[];

export const isLoadingMessages = writable(false);
export let isCreatingThread = false;
export const namingThread = true;
export let namingThreadId: string | null = null;
export let filteredThreads: Threads[] = [];
export let isEditingThreadName = false;
export let editedThreadName = '';
export let updateStatus: string = ''; 
export const searchedThreads = derived(threadsStore, ($store) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return $store.threads;
    
    return $store.threads.filter(thread => 
        thread.name?.toLowerCase().includes(query) || 
        thread.last_message?.content?.toLowerCase().includes(query)
    );
});

const dispatch = createEventDispatcher();



export const showThreadList = derived(
    threadsStore,
    $store => $store.showThreadList
);

export async function handleCreateNewThread() {
    if (isCreatingThread) return null;
    
    try {
        isCreatingThread = true;
        const currentProjectId = get(projectStore).currentProjectId;
        
        // Get current threadlist visibility state
        const currentVisibility = get(threadsStore).showThreadList;
        
        const threadData: Partial<Threads> = {
            op: userId,
            name: `Thread ${threads?.length ? threads.length + 1 : 1}`,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            current_thread: '',
            ...(currentProjectId && { project_id: currentProjectId })
        };

        const newThread = await createThread(threadData);

        if (newThread?.id) {
            // Preserve thread list visibility state
            threadsStore.update(state => ({
                ...state,
                showThreadList: currentVisibility
            }));

            if (currentProjectId) {
                const currentProject = get(projectStore).currentProject;
                if (currentProject) {
                    await projectStore.updateProject(currentProjectId, {
                        threads: [...(currentProject.threads || []), newThread.id]
                    });
                }

                const projectThreads = await fetchThreadsForProject(currentProjectId);
                threadsStore.update(state => ({
                    ...state,
                    threads: projectThreads,
                    currentThreadId: newThread.id,
                    showThreadList: currentVisibility  // Preserve visibility
                }));
            } else {
                const allThreads = await fetchThreads();
                threadsStore.update(state => ({
                    ...state,
                    threads: allThreads,
                    currentThreadId: newThread.id,
                    showThreadList: currentVisibility  // Preserve visibility
                }));
            }

            currentThreadId = newThread.id;
            showPromptCatalog.set(false);
            await handleLoadThread(newThread.id);
            return newThread;
        }
        
        return null;
    } catch (error) {
        console.error('Error in handleCreateNewThread:', error);
        return null;
    } finally {
        isCreatingThread = false;
    }
}


export async function loadThreadCounts(threads: Threads[]) {
    // isLoading = true;
    try {
      const { totalThreads } = await messageCountsStore.fetchBatch(threads, currentPage);
      if (totalThreads > currentPage * 20) {
        currentPage++;
      }
    } finally {
      // isLoading = false;
    }
  }

export async function handleDeleteThread(event: MouseEvent, threadId: string) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this thread?')) {
      const success = await deleteThread(threadId);
      if (success) {
        threads = threads.filter(t => t.id !== threadId);
        if (currentThreadId === threadId) {
          currentThreadId = null;
          chatMessages = [];
        }
      }
    }
  }
  
export async function submitThreadNameChange() {
    if (currentThreadId && editedThreadName.trim() !== '') {
      try {
        await updateThread(currentThreadId, { name: editedThreadName.trim() });
        if (currentThread) {
          currentThread.name = editedThreadName.trim();
        }
        // Update the thread in the threads array
        threads = threads.map(thread => 
          thread.id === currentThreadId 
            ? { ...thread, name: editedThreadName.trim() } 
            : thread
        );
        // Trigger reactivity for orderedGroupedThreads
        orderedGroupedThreads = groupOrder
          .filter(group => groupedThreads[group] && groupedThreads[group].length > 0)
          .map(group => ({ 
            group, 
            threads: groupedThreads[group].map(thread => 
              thread.id === currentThreadId 
                ? { ...thread, name: editedThreadName.trim() } 
                : thread
            ) 
          }));
      } catch (error) {
        console.error("Error updating thread name:", error);
      } finally {
        isEditingThreadName = false;
      }
    }
  }


export async function startEditingThreadName() {
    isEditingThreadName = true;
    editedThreadName = currentThread?.name || '';
  }
  export async function initializeThreadsAndMessages(): Promise<void> {
    try {
        // Get current store state first
        const currentState = get(threadsStore);
        
        // Only load threads if we don't have them already
        if (!currentState.threads || currentState.threads.length === 0) {
            threads = await threadsStore.loadThreads();
        } else {
            threads = currentState.threads;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const threadIdFromUrl = urlParams.get('threadId');

        if (threadIdFromUrl) {
            await handleLoadThread(threadIdFromUrl);
        } else if (!currentThreadId && (!threads || threads.length === 0)) {
            // Ensure we preserve showThreadList state
            const currentVisibility = currentState.showThreadList;
            
            const newThread = await threadsStore.addThread({ 
                name: `Thread ${threads?.length ? threads.length + 1 : 1}`,
                op: userId 
            });
            
            if (newThread?.id) {
                currentThreadId = newThread.id;
                // Update store with preserved visibility
                threadsStore.update(state => ({
                    ...state,
                    currentThreadId: newThread.id,
                    showThreadList: currentVisibility
                }));
                await handleLoadThread(newThread.id);
            }
        }

        filteredThreads = threads;
        initialLoadComplete = true;
        
    } catch (error) {
        console.error('Error initializing:', error);
    }
}
export async function handleLoadThread(threadId: string) {
    try {
      isLoadingMessages.set(true);
      // showThreadList = false;

        const thread = await pb.collection('threads').getOne(threadId, {
            expand: 'project_id',
            $autoCancel: false
        });

        if (!thread) {
            throw new Error('Thread not found');
        }

        // Update stores
        await threadsStore.setCurrentThread(threadId);
        
        // Handle project context
        if (thread.project_id) {
            await projectStore.setCurrentProject(thread.project_id);
            const projectThreads = await fetchThreadsForProject(thread.project_id);
            threadsStore.update(state => ({
                ...state,
                threads: projectThreads
                
            }));
            
        }

        // Update local state
        currentThreadId = thread.id;
        currentThread = thread;

        // Fetch messages
        await messagesStore.fetchMessages(threadId);
        
        // Map messages
        chatMessages = messages.map(msg => ({
            role: msg.type === 'human' ? 'user' : 'assistant',
            content: msg.text,
            id: msg.id,
            isTyping: false,
            text: msg.text,
            user: msg.user,
            created: msg.created,
            updated: msg.updated,
            parent_msg: msg.parent_msg,
            prompt_type: msg.prompt_type,
            model: msg.model
        }));

        showPromptCatalog = false;

        return thread;
    } catch (error) {
        console.error(`Error loading thread ${threadId}:`, error);
        return null;
    } finally {
      isLoadingMessages.set(false);
    }
}
export function toggleThreadList() {
    console.log('Sidenav - Toggle thread list clicked. Current state:', showThreadList);
    threadsStore.toggleThreadList();
    dispatch('threadListToggle');
  }


  export async function handleThreadNameUpdate(threadId: string) {
  try {
    const currentMessages = await messagesStore.fetchMessages(threadId);
    if (currentMessages?.length > 0) {
      const robotMessages = currentMessages.filter(m => m.type === 'robot');
      if (robotMessages.length === 1) {
        // Set naming state before update
        threadsStore.update(state => ({
          ...state,
          namingThreadId: threadId,
          isNaming: true
        }));

        await updateThreadNameIfNeeded(threadId, currentMessages, aiModel, userId);
        
        // Refresh threads after update
        await threadsStore.loadThreads();
        
        // Clear naming state
        threadsStore.update(state => ({
          ...state,
          namingThreadId: null,
          isNaming: false
        }));
      }
    }
  } catch (error) {
    console.error('Thread name update failed:', error);
    // Clear naming state on error
    threadsStore.update(state => ({
      ...state,
      namingThreadId: null,
      isNaming: false
    }));
  }
}




  export function toggleDateExpansion(date: string, event?: Event) {
    // Prevent any scroll behavior
    event?.preventDefault();
    event?.stopPropagation();

    const newExpandedDates = new Set(expandedDates);
    
    if (newExpandedDates.has(date)) {
      if (date !== groupedMessages[0]?.date) {  // If it's not the most recent group
        newExpandedDates.delete(date);
      }
    } else {
      newExpandedDates.add(date);
    }
    
    expandedDates = newExpandedDates;
  }

export async function goBack() {
    console.log('Back button clicked');
    console.log('Initial state:', {
      currentThreadId,
      threads: threads?.length,
    });
    
    try {
      if (currentThreadId) {
        isLoading = true;
        console.log('Starting thread reset...');
        
        // First update any pending changes
        await resetThread(currentThreadId);
        console.log('Thread reset complete');
  
        // Keep a copy of current threads before clearing state
        const currentThreads = [...threads];
        
        // Clear local state
        
        currentThread = null;
        currentThreadId = null;
        chatMessages = [];
        messages = [];
        expandedDates = new Set();
        quotedMessage = null;
        thinkingMessageId = null;
        typingMessageId = null;
        
        console.log('Local state cleared');
        
        // Reset store current thread but maintain threads list
        threadsStore.clearCurrentThread();
        console.log('Store thread cleared');
  
        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.delete('threadId');
        url.searchParams.delete('messageId');
        url.searchParams.delete('autoTrigger');
        history.replaceState({}, '', url.toString());
        console.log('URL updated');
        
        // Show thread list and restore threads
        threads = currentThreads;
        
        console.log('Final threads length:', threads?.length);
      }
    } catch (error) {
      console.error('Error going back:', error);
    } finally {
      isLoading = false;
      
      console.log('Final state:', {
        currentThreadId,
        threads: threads?.length,
        showThreadList
      });
    }
    }
export function getThreadDateGroup(thread: Threads): string {
        const now = new Date();
        const threadDate = new Date(thread.updated);
        const diffDays = Math.floor((now.getTime() - threadDate.getTime()) / (1000 * 3600 * 24));
      
        if (diffDays === 0) return get(t)('threads.today');
        if (diffDays === 1) return get(t)('threads.yesterday');
        
        // Format other dates as "Sat, 14. Dec 2024"
        return threadDate.toLocaleDateString('en-US', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
export function groupThreadsByDate(threads: Threads[]): ThreadGroup[] {
        // Create groups object to store threads by date
        const groups: { [key: string]: Threads[] } = {};
      
        // Sort threads by updated date in descending order
        const sortedThreads = [...threads].sort((a, b) => 
          new Date(b.updated).getTime() - new Date(a.updated).getTime()
        );
      
        // Group threads by their date group
        sortedThreads.forEach(thread => {
          const group = getThreadDateGroup(thread);
          if (!groups[group]) {
            groups[group] = [];
          }
          groups[group].push(thread);
        });
      
        // Convert groups object to array and sort by date priority
        const groupPriority = (group: string): number => {
          if (group === $t('threads.today')) return 0;
          if (group === $t('threads.yesterday')) return 1;
          return 2;
        };
      
        return Object.entries(groups)
          .map(([group, threads]) => ({ group, threads }))
          .sort((a, b) => {
            const priorityDiff = groupPriority(a.group) - groupPriority(b.group);
            if (priorityDiff !== 0) return priorityDiff;
            
            // If neither is today/yesterday, sort by date
            if (groupPriority(a.group) === 2 && groupPriority(b.group) === 2) {
              return new Date(b.threads[0].updated).getTime() - 
                     new Date(a.threads[0].updated).getTime();
            }
            return 0;
          });
      }
      