<script lang="ts">
  import { pb, currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
  import { onMount, afterUpdate, createEventDispatcher, onDestroy, tick } from 'svelte';
  import { get, writable, derived } from 'svelte/store';
  import { page } from '$app/stores';
  import { replaceState } from '$app/navigation';
  import { fade, fly, scale, slide } from 'svelte/transition';
  import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
  import { elasticOut, cubicOut } from 'svelte/easing';
  import { Send, Paperclip, Bot, Menu, Reply, Smile, Plus, X, FilePenLine, Save, Check, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Edit2, Pen, Trash, MessageCirclePlus, Search, Trash2, Brain, Command, Calendar, ArrowLeft, ListTree, Box, PackagePlus, MessageCircleMore, RefreshCcw, CalendarClock, MessageSquareText} from 'lucide-svelte';
  import { fetchAIResponse, generateScenarios, generateTasks as generateTasksAPI, createAIAgent, generateGuidance } from '$lib/clients/aiClient';
  import { networkStore } from '$lib/stores/networkStore';
  import { messagesStore} from '$lib/stores/messagesStore';
  import NetworkVisualization from '$lib/components/network/NetworkVisualization.svelte';
  import { updateAIAgent, ensureAuthenticated, deleteThread } from '$lib/pocketbase';
  import PromptSelector from './PromptSelector.svelte';
  import PromptCatalog from './PromptCatalog.svelte';
  import type {ExpandedGroups, ExpandedSections, ThreadGroup, MessageState, PromptState, UIState, AIModel, ChatMessage, InternalChatMessage, Scenario, ThreadStoreState, Projects, Task, Attachment, Guidance, RoleType, PromptType, NetworkData, AIAgent, Network, Threads, Messages } from '$lib/types/types';
  import { projectStore } from '$lib/stores/projectStore';
  import { fetchProjects, resetProject, fetchThreadsForProject, updateProject, removeThreadFromProject, addThreadToProject} from '$lib/clients/projectClient';
  import { fetchThreads, fetchMessagesForThread, resetThread, fetchLastMessageForThread, createThread, updateThread, addMessageToThread } from '$lib/clients/threadsClient';
  import { threadsStore } from '$lib/stores/threadsStore';
  import { t } from '$lib/stores/translationStore';
  import { promptStore } from '$lib/stores/promptStore';
  import { modelStore } from '$lib/stores/modelStore';
  import Reactions from '$lib/components/common/chat/Reactions.svelte';
  import { messageCountsStore, messageCounts, getCountColor} from '$lib/stores/messageCountStore';
  import { saveMessageAndUpdateThread, ensureValidThread } from '$lib/utils/threadManagement';
  import { tweened } from 'svelte/motion';
  import { availablePrompts, getPrompt} from '$lib/constants/prompts';
  import { availableModels } from '$lib/constants/models';
  import ModelSelector from '$lib/components/ai/ModelSelector.svelte';
  import greekImage from '$lib/assets/illustrations/greek.png';
  import { processMarkdown } from '$lib/scripts/markdownProcessor';
	import { DateInput, DatePicker, localeFromDateFnsLocale } from 'date-picker-svelte'
	import { hy } from 'date-fns/locale'
  import { adjustFontSize, resetTextareaHeight } from '$lib/utils/textHandlers';
  import { formatDate, formatContent, getRelativeTime } from '$lib/utils/formatters';

  export let seedPrompt: string = '';
  export let additionalPrompt: string = '';
  export let aiModel: AIModel;
  export let userId: string;
  export let attachment: File | null = null;
  export let promptType: PromptType = 'TUTOR';
  export let threadId: string | null = null;
  export let initialMessageId: string | null = null;
  // export let showThreadList = true;
  export let namingThread = true;

  type MessageContent = string | Scenario[] | Task[] | AIAgent | NetworkData;

	let date = new Date()
	let locale = localeFromDateFnsLocale(hy)
  let deg = 0;
  // Chat-related state
  let messages: Messages[] = [];
  let chatMessages: InternalChatMessage[] = [];
  let userInput: string = '';
  //Auth state
  let isAuthenticated = false;
  let username: string = 'You';
  let avatarUrl: string | null = null;
  let showAuth = false;
  // Thread-related state
  let threads: Threads[];
  let currentThread: Threads | null = null;
  let currentThreadId: string | null = null;  
  let namingThreadId: string | null = null;
  let filteredThreads: Threads[] = [];
  let isEditingThreadName = false;
  let editedThreadName = '';
  let isCreatingThread = false;
  let updateStatus: string = ''; 
  let showThreadList = $threadsStore.showThreadList;
  let isThreadsLoaded: boolean;
  let isThreadListVisible = false;
  let isProjectListVisible = true;
  // UI state
  let isLoading = false;
  let isExpanded = false;
  // let isLoading: boolean = false;
  let isTextareaFocused = false;
  let isFocused = false;
  let hideTimeout: ReturnType<typeof setTimeout>;
  let showPromptCatalog = false;
  let showModelSelector = false;
  let thinkingPhrase: string = '';
  let thinkingMessageId: string | null = null;
  let typingMessageId: string | null = null;
  let isLoadingMessages = false;
  let initialLoadComplete = false;
  let showScrollButton = false;
  let textareaElement: HTMLTextAreaElement;
  let defaultTextareaHeight = '60px'; 
  let selected: Date = date || new Date(); 
  let showNetworkVisualization: boolean = false;
  let isDragging = false;
  let startY: number;
  let scrollTopStart: number;
  let currentPage = 1;
  let searchQuery = '';
  let quotedMessage: Messages | null = null;
  let expandedDates = new Set<string>();
  let isMinimized = false;
  let lastScrollTop = 0;
  // let expandedGroups: Set<string> = new Set();
  let isCleaningUp = false;
  let selectedPromptLabel = '';
  let selectedModelLabel = '';
  let createHovered = false;
  let searchHovered = false;
    // Message state
  let chatMessagesDiv: HTMLDivElement;
  let messageIdCounter: number = 0;
  let lastMessageCount = 0;
  let latestMessageId: string | null = null;
  //Prompt state
  let currentPromptType: PromptType;
  let hasSentSeedPrompt: boolean = false;
  let scenarios: Scenario[] = [];
  let tasks: Task[] = [];
  let attachments: Attachment[] = [];
  let currentStage: 'initial' | 'scenarios' | 'guidance' | 'tasks' | 'refinement' | 'final' | 'summary' = 'initial';
  let guidance: Guidance | null = null;
    // Project state
  let projects: Projects[] = [];
  let currentProject: Projects | null = null;
  let currentProjectId: string | null = null;
  let isEditingProjectName = false;
  let newProjectName = '';
  let editingProjectId: string | null = null;
  let editedProjectName = '';
  let isCreatingProject = false;
  let filteredProjects: Projects[] = [];

export const expandedSections = writable<ExpandedSections>({
  prompts: false,
  models: false,
});
const dispatch = createEventDispatcher();
const expandedGroups = writable<ExpandedGroups>({});
const groupOrder = [
  $t('threads.today'),
  $t('threads.yesterday'), 
  $t('threads.lastweek'),
  $t('threads.thismonth'),
  $t('threads.older')
];
const isMobileScreen = () => window.innerWidth < 1000;
const focusOnMount = (node: HTMLElement) => {
    node.focus();
  };
const defaultAIModel: AIModel = {
  id: 'default',
  name: 'Default Model',
  api_key: '',
  base_url: 'https://api.openai.com/v1',
  api_type: 'gpt-3.5-turbo',
  api_version: 'v1',
  description: 'Default AI Model',
  user: [],
  created: new Date().toISOString(),
  updated: new Date().toISOString()
};
const handleTextareaFocus = () => {
  clearTimeout(hideTimeout); // Clear any existing timeout
  isTextareaFocused = true;
};
const handleTextareaBlur = () => {
  // Set a timeout before hiding the button
  hideTimeout = setTimeout(() => {
    isTextareaFocused = false;
  }, 300); // 1000ms = 1 second delay
};
const searchedThreads = derived(threadsStore, ($store) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return $store.threads;
    
    return $store.threads.filter(thread => 
        thread.name?.toLowerCase().includes(query) || 
        thread.last_message?.content?.toLowerCase().includes(query)
    );
});
// FUNCTIONS
  function toggleThreadList() {
    console.log('Sidenav - Toggle thread list clicked. Current state:', showThreadList);
    threadsStore.toggleThreadList();
    dispatch('threadListToggle');
  }

// Message handling functions
  function cancelEditing() {
    editingProjectId = null;
    editedProjectName = '';
  }
  function startEditingProjectName(projectId: string) {
    const project = $projectStore.threads.find(p => p.id === projectId);
    if (project) {
      editingProjectId = projectId;
      editedProjectName = project.name;
    }
  }
  function addMessage(
    role: RoleType,
    content: string | Scenario[] | Task[], 
    parentMsgId: string | null = null,
    model: string = 'default',
    
  ): InternalChatMessage {
    messageIdCounter++;

    let messageContent = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Add prompt context to assistant messages
    if (role === 'assistant' && promptType) {
      messageContent = `[Prompt: ${promptType}]\n${messageContent}`;
    }
    
    const newMessageId = `msg-${messageIdCounter}`;
    latestMessageId = newMessageId;
    const createdDate = new Date().toISOString();

    if (currentThreadId) {
        messageCountsStore.increment(currentThreadId);
    }
    return { 
      id: newMessageId,
      role,
      content: messageContent,
      text: messageContent,
      user: userId,
      isTyping: role === 'assistant',
      collectionId: '',     
      collectionName: '',   
      created: createdDate,
      updated: createdDate,
      parent_msg: parentMsgId,
      prompt_type: promptType,
      model: model,
      reactions: {
        upvote: 0,
        downvote: 0,
        bookmark: [],
        highlight: [],
        question: 0
      }
    };
  }
  function getLastMessage(): Messages | null {
    if (messages && messages.length > 0) {
      return messages[messages.length - 1]; // Returns the last message in the array
    }
    return null;
  }

  function getTotalMessages(): number {
    return messages.length;
  }
  function mapMessageToInternal(message: Messages): InternalChatMessage {
  const content = formatContent(
    message.text,
    message.prompt_type as PromptType || 'TUTOR',
    message.type === 'human' ? 'user' : 'assistant'
  );

  return {
    id: message.id,
    content,
    text: message.text,
    role: message.type === 'human' ? 'user' : 'assistant' as RoleType,
    collectionId: message.collectionId,
    collectionName: message.collectionName,
    parent_msg: message.parent_msg,
    reactions: message.reactions,
    prompt_type: message.prompt_type as PromptType || 'TUTOR',
    model: message.model,
    thread: message.thread,
    isTyping: false,
    isHighlighted: false,
    user: message.user,
    created: message.created,
    updated: message.updated
  };
}
  function groupMessagesByDate(messages: InternalChatMessage[]) {
  const groups: { [key: string]: { messages: InternalChatMessage[]; displayDate: string } } = {};
  const today = new Date().setHours(0, 0, 0, 0);
  const yesterday = new Date(today - 86400000).setHours(0, 0, 0, 0);

  messages.forEach(message => {
    const messageDate = new Date(message.created).setHours(0, 0, 0, 0);
    let dateKey = new Date(messageDate).toISOString().split('T')[0];
    let displayDate: string;

    if (messageDate === today) {
      displayDate = $t('threads.today');
    } else if (messageDate === yesterday) {
      displayDate = $t('threads.yesterday');
    } else {
      const date = new Date(messageDate);
      displayDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }

    if (!groups[dateKey]) {
      groups[dateKey] = { messages: [], displayDate };
    }
    groups[dateKey].messages.push(message);
  });

  return Object.entries(groups)
    .map(([date, { messages, displayDate }]) => ({
      date,
      displayDate,
      messages: messages.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()), // Sort messages within group
      isRecent: false
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort groups chronologically
}
  function initializeExpandedDates() {
    if (groupedMessages.length > 0) {
      const latestGroup = groupedMessages[0];
      expandedDates.add(latestGroup.date);
      expandedDates = expandedDates;
    }
  }
  function toggleDateExpansion(date: string, event?: Event) {
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

  // function groupMessagesWithReplies(messages: Messages[]): Messages[][] {
  //   const messageGroups: Messages[][] = [];
  //   const messageMap = new Map<string, Messages>();

  //   messages.forEach(message => {
  //     if (!message.parent_msg) {
  //       messageGroups.push([message]);
  //       messageMap.set(message.id, message);
  //     } else {
  //       const parentGroup = messageGroups.find(group => group[0].id === message.parent_msg);
  //       if (parentGroup) {
  //         parentGroup.push(message);
  //       } else {
  //         const parent = messageMap.get(message.parent_msg);
  //         if (parent) {
  //           const newGroup = [parent, message];
  //           messageGroups.push(newGroup);
  //         } else {
  //           messageGroups.push([message]);
  //         }
  //       }
  //     }
  //   });

  //   return messageGroups;
  // }
// Thread management functions
function initializeExpandedGroups(groups: ThreadGroup[]) {
  const initialState: ExpandedGroups = {};
  groups.forEach((group, index) => {
    initialState[group.group] = index === 0; // Only expand first group
  });
  expandedGroups.set(initialState);
}
// Toggle group expansion
function toggleGroup(group: string) {
  expandedGroups.update(state => ({
    ...state,
    [group]: !state[group]
  }));
}
function getThreadDateGroup(thread: Threads): string {
  const now = new Date();
  const threadDate = new Date(thread.updated);
  const diffDays = Math.floor((now.getTime() - threadDate.getTime()) / (1000 * 3600 * 24));

  if (diffDays === 0) return $t('threads.today');
  if (diffDays === 1) return $t('threads.yesterday');
  
  // Format other dates as "Sat, 14. Dec 2024"
  return threadDate.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
function groupThreadsByDate(threads: Threads[]): ThreadGroup[] {
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
// UI helper functions

function handleClickOutside() {
  window.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.btn-ai')) {
      expandedSections.set({
        prompts: false,
        models: false
      });
    }
  });
}
  function handleScroll(event: { target: HTMLElement }) {
    const currentScrollTop = event.target.scrollTop;
      if (currentScrollTop > lastScrollTop && currentScrollTop > 50) {
        isMinimized = true;
      } else if (currentScrollTop < lastScrollTop || currentScrollTop <= 50) {
        isMinimized = false;
      }
      lastScrollTop = currentScrollTop;
  }

  function getRandomThinkingPhrase(): string {
    const thinkingPhrases = $t('extras.thinking');
    if (!thinkingPhrases?.length) {
      return 'Thinking...';
    }
    return thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
  }
  // function drag(event: MouseEvent) {
  //   if (isDragging) {
  //     const deltaY = startY - event.clientY;
  //     chatMessagesDiv.scrollTop = scrollTopStart + deltaY;
  //   }
  // }
  // function stopDrag() {
  //   isDragging = false;
  //   document.removeEventListener('mousemove', drag);
  //   document.removeEventListener('mouseup', stopDrag);
  // }
  function updateAvatarUrl() {
      if ($currentUser && $currentUser.avatar) {
          avatarUrl = pb.getFileUrl($currentUser, $currentUser.avatar);
      }
  }
  function handlePromptSelection(newPromptType: PromptType) {
  promptStore.set(newPromptType);
  promptType = newPromptType;
}
function handleScrolling() {
  setTimeout(() => {
    if (chatMessagesDiv) {
      const { scrollTop, scrollHeight, clientHeight } = chatMessagesDiv;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        scrollToBottom();
      }
    }
  }, 0);
}
function cleanup() {
  isLoading = false;
  thinkingMessageId = null;
  typingMessageId = null;
  attachment = null;
}
function handleError(error: unknown) {
  console.error('Message handling error:', error);
  chatMessages = chatMessages.filter(msg => msg.id !== thinkingMessageId);
  const errorMessage = error instanceof Error ? error.message : 'An error occurred';
  chatMessages = [...chatMessages, addMessage('assistant', errorMessage)];
}
export function toggleSection(section: keyof ExpandedSections): void {
  expandedSections.update(sections => {
    const newSections: ExpandedSections = {
      prompts: false,
      models: false
    };
    
    if (!sections[section]) {
      newSections[section] = true;
      
      // Add click listener after a small delay
      setTimeout(() => {
        window.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('.btn-ai') && !target.closest('.section-content')) {
            expandedSections.set({
              prompts: false,
              models: false
            });
          }
        }, { once: true });
      }, 0);
    }
    
    return newSections;
  });
}
  // ASYNC
  // Message handling functions
  async function submitProjectNameChange(projectId: string) {
    if (editedProjectName.trim()) {
      await projectStore.updateProject(projectId, { name: editedProjectName.trim() });
    }
    cancelEditing();
  }
  async function handleThreadNameUpdate(threadId: string) {
  try {
    const currentMessages = await messagesStore.fetchMessages(threadId);
    if (currentMessages?.length > 0) {
      const robotMessages = currentMessages.filter(m => m.type === 'robot');
      if (robotMessages.length === 1) {
        // Store current thread state
        const currentState = get(threadsStore);
        
        // Set naming state
        threadsStore.update(state => ({
          ...state,
          namingThreadId: threadId,
          isNaming: true
        }));

        try {
          await updateThreadNameIfNeeded(threadId, currentMessages, aiModel, userId);
          
          // Try to refresh threads but don't fail if it errors
          try {
            await threadsStore.loadThreads();
          } catch (refreshError) {
            console.error('Failed to refresh threads, keeping current state:', refreshError);
            // Restore previous thread state
            threadsStore.update(state => ({
              ...state,
              threads: currentState.threads,
              showThreadList: currentState.showThreadList
            }));
          }
        } finally {
          // Always clear naming state
          threadsStore.update(state => ({
            ...state,
            namingThreadId: null,
            isNaming: false
          }));
        }
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
async function handleSendMessage(message: string = userInput) {
  if (!message.trim() && chatMessages.length === 0 && !attachment) return;

  try {
    userInput = '';
    resetTextareaHeight();
    
    if (!currentThreadId) {
      const newThread = await threadsStore.addThread({
        op: userId,
        name: `Thread ${threads?.length ? threads.length + 1 : 1}`
      });

      if (!newThread?.id) {
        console.error('Thread creation failed');
        return;
      }

      threads = [...(threads || []), newThread];
      currentThreadId = newThread.id;
      await handleLoadThread(newThread.id);
    }

    const currentMessage = message.trim();
    const userMessageUI = addMessage('user', currentMessage, quotedMessage?.id ?? null, aiModel.id);
    chatMessages = [...chatMessages, userMessageUI];

    // Scroll the new message into view at the top
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${userMessageUI.id}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    const userMessage = await messagesStore.saveMessage({
      text: currentMessage,
      type: 'human',
      thread: currentThreadId,
      parent_msg: quotedMessage?.id ?? null,
      prompt_type: promptType
    }, currentThreadId);

    quotedMessage = null;

    const thinkingMessage = addMessage('thinking', getRandomThinkingPhrase());
    thinkingMessageId = thinkingMessage.id;
    chatMessages = [...chatMessages, thinkingMessage];

    const messagesToSend = chatMessages
      .filter(({ role, content }) => role && content)
      .map(({ role, content }) => ({
        role,
        content: role === 'user' && promptType 
          ? `[Using ${promptType} prompt]\n${content.toString()}`
          : content.toString()
      }));

    if (!messagesToSend.length) {
      throw new Error('No valid messages to send');
    }

    if (promptType) {
      messagesToSend.unshift({
        role: 'system',
        content: `You are responding using the ${promptType} prompt. Please format your response accordingly.`
      });
    }

    const aiResponse = await fetchAIResponse(messagesToSend, aiModel, userId, attachment);
    chatMessages = chatMessages.filter(msg => msg.id !== String(thinkingMessageId));

    const assistantMessage = await messagesStore.saveMessage({
      text: aiResponse,
      type: 'robot',
      thread: currentThreadId,
      parent_msg: userMessage.id,
      prompt_type: promptType,
      mode: aiModel,
    }, currentThreadId);

    const newAssistantMessage = addMessage('assistant', '', userMessage.id);
    chatMessages = [...chatMessages, newAssistantMessage];
    typingMessageId = newAssistantMessage.id;

    await typeMessage(aiResponse);

    chatMessages = chatMessages.map(msg =>
      msg.id === String(typingMessageId)
        ? { ...msg, content: aiResponse, text: aiResponse, isTyping: false }
        : msg
    );

    await handleThreadNameUpdate(currentThreadId);
    handleScrolling();

  } catch (error) {
    handleError(error);
  } finally {
    cleanup();
  }
}

//// Add setscurrent handler
async function handleCreateNewProject(name: string) {
    if (!name.trim()) return;
    
    try {
      isCreatingProject = true;
      
      const newProject = await projectStore.addProject({
        name: name.trim(),
        description: ''
      });
      
      if (newProject) {
        newProjectName = '';
        showPromptCatalog = false;
      }
    } catch (error) {
      console.error('Error in handleCreateNewProject:', error);
    } finally {
      isCreatingProject = false;
    }
  }
  async function handleSelectProject(projectId: string) {
    try {
        // Set the current project in the store
        await projectStore.setCurrentProject(projectId);

        // Fetch the threads associated with the selected project
        const threads = await fetchThreadsForProject(projectId);

        // Update the threads store with the fetched threads
        threadsStore.update(state => ({ ...state, threads }));

        // Update visibility flags
        isProjectListVisible = false; // Hide project list
        isThreadListVisible = true;  // Show thread list
    } catch (error) {
        console.error("Error handling project selection:", error);
    }
}
  async function handleDeleteProject(e: Event, projectId: string) {
    e.stopPropagation();
    // Add delete confirmation logic
  }
  async function typeMessage(message: string) {
      const typingSpeed = 10; // milliseconds per character
      let typedMessage = '';
      
      for (let i = 0; i <= message.length; i++) {
        typedMessage = message.slice(0, i);
        chatMessages = chatMessages.map(msg => 
          msg.id === String(typingMessageId) 
            ? { ...msg, content: typedMessage, text: typedMessage, isTyping: true }
            : msg
        );
        await new Promise(resolve => setTimeout(resolve, typingSpeed));
      }

      // Set isTyping to false when typing is complete
      chatMessages = chatMessages.map(msg => 
        msg.id === String(typingMessageId) 
          ? { ...msg, isTyping: false }
          : msg
      );
      
      // Scroll to the bottom after typing is complete
      if (chatMessagesDiv) {
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
      }
  }
// Thread management functions
async function handleCreateNewThread() {
    if (isCreatingThread) return null;
    
    try {
        isCreatingThread = true;
        const currentProjectId = get(projectStore).currentProjectId;
        
        // Get current threadlist visibility state
        const currentVisibility = get(threadsStore).showThreadList;
        
        const threadData: Partial<Threads> = {
            op: userId,
            name: `(untitled)`,
            // name: `(untitled) ${threads?.length ? threads.length + 1 : 1}`,
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
                    // showThreadList: currentVisibility  // Preserve visibility
                }));
            } else {
                const allThreads = await fetchThreads();
                threadsStore.update(state => ({
                    ...state,
                    threads: allThreads,
                    currentThreadId: newThread.id,
                    // showThreadList: currentVisibility  // Preserve visibility
                }));
            }

            currentThreadId = newThread.id;
            showPromptCatalog = false;
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
async function handleLoadThread(threadId: string) {
    try {
        isLoadingMessages = true;
        showThreadList = false;

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
        isLoadingMessages = false;
    }
}

  async function handleDeleteThread(event: MouseEvent, threadId: string) {
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
  
  async function submitThreadNameChange() {
    if (currentThreadId && editedThreadName.trim() !== '') {
        try {
            // Store current states
            const currentThreadState = currentThread;
            const currentVisibility = $threadsStore.showThreadList;

            // Update thread in PocketBase
            const updatedThread = await updateThread(currentThreadId, { 
                name: editedThreadName.trim() 
            });

            // Update store with preserved state
            threadsStore.update(state => ({
                ...state,
                threads: state.threads.map(thread => 
                    thread.id === currentThreadId 
                        ? { 
                            ...thread, 
                            name: editedThreadName.trim(),
                            // Preserve important states
                            showThreadList: currentVisibility
                        } 
                        : thread
                ),
                currentThread: {
                    ...currentThreadState,
                    name: editedThreadName.trim()
                }
            }));

            // Update derived states
            orderedGroupedThreads = groupThreadsByDate(
                $threadsStore.threads.filter(thread => 
                    thread.id === currentThreadId 
                        ? { ...thread, name: editedThreadName.trim() }
                        : thread
                )
            );

        } catch (error) {
            console.error("Error updating thread name:", error);
        } finally {
            isEditingThreadName = false;
        }
    }
}
  // UI helper functions
  async function scrollToBottom() {
    console.log('Scroll button clicked');
    const chatMessages = chatMessagesDiv.querySelector('.chat-messages');
    if (chatMessages) {
      // console.log('Before scroll - scrollTop:', chatMessages.scrollTop, 'scrollHeight:', chatMessages.scrollHeight);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      // console.log('After scroll - scrollTop:', chatMessages.scrollTop, 'scrollHeight:', chatMessages.scrollHeight);
      showScrollButton = false;
      // console.log('showScrollButton set to false');
    } else {
      console.log('chat-messages div not found');
    }
  }
  async function goBack() {
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
  async function handleAutoTriggerResponse(targetMessage) {
    try {
        isLoading = true;

        // Store current thread state before any operations
        const currentThreadState = currentThread;
        const currentChatMessages = chatMessages;
        
        // Start thinking animation
        thinkingPhrase = getRandomThinkingPhrase();
        const thinkingMessage = addMessage('thinking', thinkingPhrase);
        thinkingMessageId = thinkingMessage.id;
        chatMessages = [...currentChatMessages, thinkingMessage];

        // Set naming state while preserving current state
        if (currentThreadId) {
            threadsStore.update(state => ({
                ...state,
                namingThreadId: currentThreadId,
                currentThread: currentThreadState
            }));
        }

        // Fetch AI response
        const aiResponse = await fetchAIResponse(
            chatMessages.map(({ role, content }) => ({ role, content: content.toString() })),
            aiModel,
            userId,
            attachment
        );

        // Remove thinking message while preserving state
        chatMessages = chatMessages.filter(msg => msg.id !== String(thinkingMessageId));

        // Save AI response to store
        const assistantMessage = await messagesStore.saveMessage({
            text: aiResponse,
            type: 'robot',
            thread: currentThreadId,
            parent_msg: targetMessage.id,
            prompt_type: promptType // Fixed: use promptType instead of prompt
        }, currentThreadId);

        // Add AI response to UI while maintaining state
        const newAssistantMessage = addMessage('assistant', '', targetMessage.id);
        chatMessages = [...chatMessages, newAssistantMessage];
        typingMessageId = newAssistantMessage.id;

        // Use typewriting effect
        await typeMessage(aiResponse);

        // Update the message with full response while preserving state
        chatMessages = chatMessages.map(msg => 
            msg.id === String(typingMessageId) 
                ? { ...msg, content: aiResponse, text: aiResponse, isTyping: false }
                : msg
        );

        // Handle thread naming for first AI response
        const robotMessages = messages.filter(m => m.type === 'robot');
        if (robotMessages.length === 1) {
            try {
                // Update thread name while preserving state
                await threadsStore.update(state => ({
                    ...state,
                    namingThreadId: currentThreadId,
                    currentThread: currentThreadState,
                    messages: chatMessages
                }));

                // Update thread name
                await threadsStore.autoUpdateThreadName(currentThreadId, {
                    preserveState: true,
                    currentThread: currentThreadState,
                    currentMessages: chatMessages
                });

                // Refresh threads without clearing current state
                await threadsStore.loadThreads({
                    preserveCurrent: true,
                    currentThreadId,
                    currentThread: currentThreadState
                });
            } catch (error) {
                console.error('Error updating thread name:', error);
                // Restore original state on error
                threadsStore.update(state => ({
                    ...state,
                    currentThread: currentThreadState,
                    messages: chatMessages
                }));
            } finally {
                // Clear naming state while preserving thread state
                threadsStore.update(state => ({
                    ...state,
                    namingThreadId: null,
                    currentThread: currentThreadState,
                    messages: chatMessages
                }));
            }
        }

        // Refresh messages while maintaining state
        await messagesStore.fetchMessages(currentThreadId);

    } catch (error) {
        console.error('Error processing AI response:', error);
        // Error handling with state preservation
        chatMessages = [
            ...chatMessages.filter(msg => msg.id !== thinkingMessageId),
            addMessage('assistant', `Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
        ];
    } finally {
        isLoading = false;
        thinkingMessageId = null;
        typingMessageId = null;
        // Final cleanup while preserving thread state
        if (currentThreadId) {
            threadsStore.update(state => ({
                ...state,
                namingThreadId: null,
                currentThread: state.currentThread,
                messages: chatMessages
            }));
        }
    }
}
  async function startEditingThreadName() {
    isEditingThreadName = true;
    editedThreadName = currentThread?.name || '';
  }
  async function initializeThreadsAndMessages(): Promise<void> {
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

messagesStore.subscribe(value => messages = value);
  projectStore.subscribe((state) => {
    projects = state.threads;
    currentProjectId = state.currentProjectId;
    currentProject = state.currentProject;
    filteredProjects = state.filteredProject;
    isEditingProjectName = state.isEditingProjectName;
    editedProjectName = state.editedProjectdName;
  });
  threadsStore.subscribe((state: ThreadStoreState) => {
    threads = state.threads;
    currentThreadId = state.currentThreadId;
    messages = state.messages;
    updateStatus = state.updateStatus;
    showThreadList = state.showThreadList;
    currentThread = state.currentThread;
    filteredThreads = state.filteredThreads;
    isEditingThreadName = state.isEditingThreadName;
    editedThreadName = state.editedThreadName;
    namingThreadId = state.namingThreadId; 
});

// Reactive statements for naming
$: {
  if (namingThreadId) {
    // Force refresh of current thread when naming starts
    currentThread = threads?.find(t => t.id === namingThreadId) || null;
  }
}
$: {
  if (currentThread && namingThreadId === currentThread.id) {
    // Update UI when naming is complete
    threadsStore.update(state => ({
      ...state,
      isEditingThreadName: false,
      namingThreadId: null
    }));
  }
}

  $: selectedPromptLabel = $promptStore ? availablePrompts.find(option => option.value === $promptStore)?.label || '' : '';
  $: selectedIcon = $promptStore ? availablePrompts.find(option => option.value === $promptStore)?.icon : null;  
  $: selectedModelName = $modelStore?.selectedModel?.name || '';  
  // $: showThreadList = $threadsStore.showThreadList;
  $: promptType = $promptStore;
$: {
  if ($expandedSections.models) {
    showModelSelector = true;
    showPromptCatalog = false;
  } else if ($expandedSections.prompts) {
    showPromptCatalog = true;
    showModelSelector = false;
  } else {
    showModelSelector = false;
    showPromptCatalog = false;
  }
}
// Handle seed prompt
$: if (seedPrompt && !hasSentSeedPrompt) {
   console.log("Processing seed prompt:", seedPrompt);
   hasSentSeedPrompt = true;
   handleSendMessage(seedPrompt);
}
// Core thread and message handling
$: currentThread = threads?.find(t => t.id === currentThreadId) || null;  
$: safeAIModel = aiModel || defaultAIModel;
$: groupedMessages = groupMessagesByDate(messages.map(m => mapMessageToInternal(m)));
// Handle expanded dates
$: {
   if (groupedMessages?.length > 0 && expandedDates.size === 0) {
       expandedDates = new Set([groupedMessages[groupedMessages.length - 1].date]);
   }
}
// Thread grouping and visibility management
$: isSearchActive = searchQuery.trim().length > 0;
$: isProjectActive = currentProjectId !== null;
// Update store when search changes
$: {
  threadsStore.setSearchQuery(searchQuery);
}
$: {
  if (namingThreadId) {
    // Force a refresh of the current thread if it's being named
    if (currentThreadId === namingThreadId) {
      currentThread = threads?.find(t => t.id === currentThreadId) || null;
    }
  }
}
$: orderedGroupedThreads = groupThreadsByDate(filteredThreads || []);
$: visibleThreads = orderedGroupedThreads.flatMap(group => group.threads);
// Stage-based operations
// UI state updates
$: console.log("isLoading changed:", isLoading);
$: if ($currentUser?.avatar) {
   updateAvatarUrl();
}
// Store synchronization with visibility protection
// $: {
//    const storeState = $threadsStore;
//    if (storeState) {
//        threads = storeState.threads;
//        currentThreadId = storeState.currentThreadId;
//        messages = storeState.messages;
//        updateStatus = storeState.updateStatus;
       
//        // Only update showThreadList if threads exist and list should be visible
//        if (storeState.threads?.length > 0 && (!showThreadList || storeState.showThreadList)) {
//            showThreadList = true;
//        }
//    }
// }
$: {
    const storeState = $threadsStore;
    if (storeState) {
        threads = storeState.threads;
        currentThreadId = storeState.currentThreadId;
        messages = storeState.messages;
        updateStatus = storeState.updateStatus;
        showThreadList = storeState.showThreadList;
    }
}
$: groupedThreads = (filteredThreads || []).reduce((acc, thread) => {
   const group = getThreadDateGroup(thread);
   if (!acc[group]) acc[group] = [];
   acc[group].push(thread);
   return acc;
}, {} as Record<string, Threads[]>);
// Maintain thread visibility
// $: {
//    if (currentThreadId && threads?.length > 0 && !showThreadList) {
//        showThreadList = true;
//        threadsStore.update(state => ({
//            ...state,
//            showThreadList: true
//        }));
//    }
// }
$: if (date) {
        messagesStore.setSelectedDate(date.toISOString());
    }
//     $: if (threads?.length) {
//   messageCountsStore.fetchBatch(threads, currentPage);
// }
$: {
    if ($threadsStore.currentThread) {
        currentThread = $threadsStore.currentThread;
    }
}

$: {
    if (currentThread?.name) {
        orderedGroupedThreads = groupThreadsByDate(
            $threadsStore.threads.map(thread => 
                thread.id === currentThread?.id 
                    ? { ...thread, name: currentThread.name }
                    : thread
            )
        );
    }
}
// Lifecycle hooks
onMount(() => {
		const interval = setInterval(() => {
			deg += 2;
			if (deg >= 360) deg = 0;
			document.body.style.setProperty('--deg', deg);
		}, 60);
		return () => clearInterval(interval);
	});
onMount(async () => {
  try {
    console.log('onMount initiated');

    // Check authentication first
    isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.error('User is not logged in. Please log in.');
      showAuth = true;
      return;
    }

    // Set up user info
    if ($currentUser && $currentUser.id) {
      console.log('Current user:', $currentUser);
      updateAvatarUrl();
      username = $currentUser.username || $currentUser.email;
    }

    // Load data sequentially to avoid race conditions
    await projectStore.loadProjects();
    await threadsStore.loadThreads();
// $: if (threads?.length) {
//   messageCountsStore.fetchBatch(threads, currentPage);
// }
    // Initialize textarea after data is loaded
    if (textareaElement) {
      const adjustTextareaHeight = () => {
        console.log('Adjusting textarea height');
        textareaElement.style.height = 'auto';
        textareaElement.style.height = `${textareaElement.scrollHeight}px`;
      };
      textareaElement.addEventListener('input', adjustTextareaHeight);
    }

    // Initialize messages last
    await initializeThreadsAndMessages();
    initialLoadComplete = true;

  } catch (error) {
    console.error('Error during onMount:', error);
    isLoading = false;
  }
});
afterUpdate(() => {
  if (chatMessagesDiv && chatMessages.length > lastMessageCount) {
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    lastMessageCount = chatMessages.length;
    scrollToBottom();
  }
});
onDestroy(() => {
  currentProjectId = null;
  currentThreadId = null;
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }
  
  chatMessages = [];
  messages = [];
  
  const url = new URL(window.location.href);
  url.searchParams.delete('threadId');
  url.searchParams.delete('messageId');
  url.searchParams.delete('autoTrigger');
  window.history.replaceState({}, '', url);
});

</script>

<div class="chat-interface" in:fly="{{ y: -200, duration: 300 }}" out:fade="{{ duration: 200 }}">
  <div class="chat-container" 
    transition:fly="{{ x: 300, duration: 300 }}" 
    class:drawer-visible={$threadsStore.showThreadList}
  >

  {#if $threadsStore.showThreadList}

    <div class="drawer" transition:fly="{{ x: -300, duration: 300 }}">
      <!-- <h2>
        {$t('threads.threadHeader')}
      </h2> -->

        <div class="drawer-list" in:fly={{duration: 200}} out:fade={{duration: 200}}>


          {#if isProjectListVisible}
          <div class="project-section" in:fly={{duration: 200}} out:fade={{duration: 200}}>
            <!-- Create Project Button -->

        
            <!-- Project List -->
            <div class="cards" in:fly={{duration: 200}} out:fade={{duration: 200}}
            class:empty={!$projectStore?.threads?.length}>
              {#if $projectStore?.threads?.length > 0}
                {#each $projectStore.threads as project (project.id)}
                <button class="card-container" in:fly={{duration: 200}} out:fade={{duration: 200}}
                    on:click={() => handleSelectProject(project.id)}
                  >                  
                  <div 
                    class="card"
                    class:active={currentProjectId === project.id}
                    in:fly={{x: 20, duration: 200}}
                  >
                    {#if project.id === editingProjectId}
                      <input
                        type="text"
                        bind:value={editedProjectName}
                        on:keydown={(e) => {
                          if (e.key === 'Enter') submitProjectNameChange(project.id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        use:focusOnMount
                      />
                    {:else}

                      <div class="card-static">
                        <span class="card-title project">{project.name}</span>
                        <span class="card-time">
                          {#if project.updated && !isNaN(new Date(project.updated).getTime())}
                            {getRelativeTime(new Date(project.updated))}
                          {:else}
                            No date available
                          {/if}
                        </span>
                      </div>

                    {/if}
        
                    <div class="card-actions">
                      <button 
                        class="action-btn"
                        on:click|stopPropagation={() => startEditingProjectName(project.id)}
                        >
                        <Pen size={14} />
                      </button>
                      <button 
                        class="action-btn delete"
                        on:click|stopPropagation={(e) => handleDeleteProject(e, project.id)}
                        >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </button>

                {/each}
              {:else}
                <div class="no-projects">
                  <span>No projects yet</span>
                </div>
              {/if}
            </div>
            <div class="drawer-toolbar">
              <button 
                class="add"
                on:click={() => {
                  console.log('New project button clicked');
                  isCreatingProject = true;
                }}
                disabled={isCreatingProject}
                on:mouseenter={() => createHovered = true}
                on:mouseleave={() => createHovered = false}
              >
                <span 
                  class="icon" 
                  class:active={isCreatingProject} 
                  on:click={() => {
                    isCreatingProject = !isCreatingProject;
                  }}
                  on:mouseenter={() => searchHovered = true}
                  on:mouseleave={() => searchHovered = false}
                >

                  <span class="icon" class:active={isCreatingProject}>
                    {#if isCreatingProject}
                      <ArrowLeft/>
                      {:else}
                      <PackagePlus />
                      {#if searchHovered && !isCreatingProject}
                        <span class="tooltip" in:fade>
                          {$t('tooltip.newProject')}
                        </span>
                      {/if}
                    {/if}
                </span>
                {#if isCreatingProject}

                  <div class="drawer-input" transition:slide>
                    <input
                      type="text"
                      bind:value={newProjectName}
                      placeholder="Project name..."
                      on:keydown={(e) => {
                        console.log('Keydown event:', e.key);
                        if (e.key === 'Enter' && newProjectName.trim()) {
                          console.log('Enter pressed with name:', newProjectName);
                          handleCreateNewProject(newProjectName);
                        } else if (e.key === 'Escape') {
                          console.log('Escape pressed, canceling');
                          isCreatingProject = false;
                          newProjectName = '';
                        }
                      }}
                      use:focusOnMount
                    />
                    <button 
                      class="create-confirm"
                      disabled={!newProjectName.trim()}
                      on:click={() => {
                        console.log('Confirm button clicked with name:', newProjectName);
                        handleCreateNewProject(newProjectName);
                      }}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                {:else}
                {/if}
              </button>
              
            </div>
          </div>
        {/if}
        {#if isThreadListVisible}

          {#if isThreadListVisible || namingThreadId}
          <div class="thread-filtered-results" transition:slide={{duration: 200}}>
            {#each $searchedThreads as thread (thread.id)}
              <button 
                class="card-container"
                class:selected={currentThreadId === thread.id}
                on:click={() => handleLoadThread(thread.id)}
                on:mouseenter={async () => {
                  if (!$messageCounts.hasCount(thread.id)) {
                    await messageCountsStore.updateCount(thread.id);
                  }
                }}
              >
                <div class="card" 
                  class:active={currentThreadId === thread.id}
                  in:fade
                >
                  <div class="card-static">
                    <!-- When thread is being named, show spinner -->
                    {#if namingThreadId === thread.id}
                      <div class="spinner2" in:fade={{duration: 200}} out:fade={{duration: 200}}>
                        <Bot size={30} class="bot-icon" />
                      </div>
                    {:else}
                      <span class="card-title">{thread.name}</span>
                      <span class="card-time">
                        {#if thread.updated && !isNaN(new Date(thread.updated).getTime())}
                          {getRelativeTime(new Date(thread.updated))}
                        {:else}
                          No date available
                        {/if}
                      </span>
                    {/if}
        
                    <!-- Actions always visible for uniformity -->
                    <div class="card-actions" transition:fade={{duration: 300}}>
                      {#if $messageCounts.hasCount(thread.id)}
                        <button 
                          class="action-btn badge"
                          style="color: {getCountColor($messageCounts.getCount(thread.id))}"
                        >
                          <MessageSquareText size={14}/>
                          <span class="count">{$messageCounts.getCount(thread.id)}</span>
                        </button>
                      {/if}
                      <button 
                        class="action-btn delete"
                        on:click|stopPropagation={(e) => handleDeleteThread(e, thread.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
          <div class="drawer-toolbar" in:fade={{duration: 200}} out:fade={{duration: 200}}>
            <button 
              class="add"
              on:click={async () => {
                if (isCreatingThread) return;
                try {
                  const newThread = await handleCreateNewThread();
                  if (newThread?.id) {
                    showPromptCatalog = false;
                  }
                } catch (error) {
                  console.error('Error creating new thread:', error);
                }
              }}
              disabled={isCreatingThread}
              on:mouseenter={() => createHovered = true}
              on:mouseleave={() => createHovered = false}
            >
              {#if isCreatingThread}
                <div class="spinner2" in:fade={{duration: 200}} out:fade={{duration: 200}}>
                  <Bot class="bot-icon" />
                </div>
              {:else}
                  <div class="icon" in:fade>
                    <MessageCirclePlus />
                    {#if createHovered}
                      <span class="tooltip" in:fade>
                        {$t('tooltip.newThread')}
                      </span>
                    {/if}
                  </div> 
              {/if}
            </button>
            
            <div class="drawer-input">
              
              <span 
                class="icon" 
                class:active={isExpanded} 
                on:click={() => {
                  isExpanded = !isExpanded;
                }}
                on:mouseenter={() => searchHovered = true}
                on:mouseleave={() => searchHovered = false}
              >
                <div class="icon" in:fade>
                  <Search />
                  {#if searchHovered && !isExpanded}
                    <span class="tooltip" in:fade>
                      {$t('tooltip.findThread')}
                    </span>
                  {/if}
                </div> 
              </span>
              {#if isExpanded}
                <input
                  transition:slide={{ duration: 300 }}
                  type="text"
                  bind:value={searchQuery}
                  placeholder="Search..."
                  on:input={() => {
                    console.log('Search query changed:', searchQuery);
                    console.log('Before setSearchQuery call');
                    threadsStore.setSearchQuery(searchQuery);
                    console.log('After setSearchQuery call');
                  }}                  
                  on:blur={() => {
                    console.log('Search input blur, searchQuery:', searchQuery);
                    if (!searchQuery) {
                      console.log('Clearing search, collapsing input');
                      isExpanded = false;
                    }
                  }}
                  use:focusOnMount
                />
              {/if}
            </div>
          </div>
        {/if}

              {:else}
              
 
              {/if}
        </div>
        <div class="drawer-header" in:fly={{duration: 200}} out:fade={{duration: 200}}>
          <button class="drawer-tab" in:fly={{duration: 200}} out:fly={{duration: 200}}
          class:active={isProjectListVisible} 
          on:click={() => {
            if (!isProjectListVisible) {
              // Reset project selection when going back to project list
              projectStore.setCurrentProject(null);
              currentProjectId = null;
              threadsStore.setCurrentThread(null);
              currentThreadId = null;
      
              // Clear project-specific threads
              threadsStore.update(state => ({...state, threads: []}));
            }
            isProjectListVisible = !isProjectListVisible;
            if (isProjectListVisible) {
              isThreadListVisible = false;
              // Reload all projects to ensure fresh data
              projectStore.loadProjects();
              
            }
          }}
        >
          <span class="icon" class:active={isProjectListVisible} in:fly={{duration: 200}} out:fade={{duration: 200}}>
            {#if !isProjectListVisible && !currentProjectId}
            <Box />              
            {:else if !isProjectListVisible && currentProjectId}  
              <ArrowLeft />
            {:else}
              <Box />
              <span in:fade>{$t('drawer.project')}</span>
            {/if}
           </span>
         </button>
         <button 
         class="drawer-tab"
         class:active={isThreadListVisible} 
         on:click={() => {
           isThreadListVisible = !isThreadListVisible;
           if (isThreadListVisible) {
             isProjectListVisible = false;
             // Reset project selection
             projectStore.setCurrentProject(null);
             currentProjectId = null;
             // Reload all threads
             threadsStore.loadThreads();
           }
         }}
       >
       <span 
       class="icon"
       class:active={isThreadListVisible}
      >
       {#if isThreadListVisible && currentProjectId}
         <Box />
         <span in:fade>
           {get(projectStore).currentProject?.name || ''}
         </span>
       {:else if !isThreadListVisible}
         <MessageCircleMore />
       {:else}
         <MessageCircleMore />
         <span in:fade>
           {$t('drawer.thread')}
         </span>
       {/if}
      </span>
          </button>
        </div>
    </div>
      {/if}
      <div class="chat-container" in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}" on:scroll={handleScroll}>



          <div class="chat-content" class:drawer-visible={$threadsStore.showThreadList} in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}" bind:this={chatMessagesDiv}>

              {#if isLoadingMessages}
                <div class="loading-overlay">
                  <div class="spinner"></div>
                  <p>{$t('chat.loading')}</p>
                </div>
              {/if}
              <div class="chat-header" class:minimized={isMinimized} transition:slide={{duration: 300, easing: cubicOut}}>
                {#if currentThread}
      
                    <!-- <button class="btn-back" on:click={goBack}>
                      <ArrowLeft />
                    </button> -->
                    
                    {#if isEditingThreadName}
                      <input 
                        
                        transition:fade={{duration: 300, easing: cubicOut}}
                        bind:value={editedThreadName}
                        on:keydown={(e) => e.key === 'Enter' && submitThreadNameChange()}
                        on:blur={submitThreadNameChange}
                        autofocus
                      />
                      <span class="save-button" on:click={submitThreadNameChange}>
                        <Save />
                      </span>
                    {:else}
                    <!-- <div class="drawer-tab">
                      <span class="icon">
                        <h3>
                          /
                        </h3>
                      </span>
                    </div> -->
                    <span class="icon" on:click={startEditingThreadName}>
                      <h3>
                        {currentThread.name}
                      </h3>
                    </span>
                    {/if}
                  {#if !isMinimized}
                  {/if}
                {:else}
                  <div class="chat-placeholder"
                  class:drawer-visible={$threadsStore.showThreadList}
                  >              
                    {$t('threads.selectThread')}
                  </div>
                {/if}
              </div>
              <div class="chat-messages" in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}">

                {#each groupMessagesByDate(chatMessages) as { date, messages }}
                  <div class="date-divider">
                    {formatDate(date)}
                  </div>
                  
                  
                  {#each messages as message (message.id)}
                    <div class="message {message.role}" class:latest-message={message.id === latestMessageId} in:fly="{{ y: 20, duration: 300 }}" out:fade="{{ duration: 200 }}">
                      <div class="message-header">
                        {#if message.role === 'user'}
                          <div class="user-header">
                            <div class="avatar-container">
                              {#if avatarUrl}
                                <img src={avatarUrl} alt="User avatar" class="avatar" />
                              {:else}
                                <!-- <div class="avatar-placeholder">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-user"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </div> -->
                              {/if}
                            </div>
                            <span class="role">{username}</span>
                          </div>
                          <!-- <div class="message-time">
                            {#if message.created}
                              {new Date(message.created).toLocaleTimeString()}
                            {:else}
                              Time not available
                            {/if}
                          </div> -->
                        {:else if message.role === 'thinking'}
                          <!-- <span class="role">
                            <Bot size="50" color="white" />
                          </span> -->
                        {:else if message.role === 'assistant'}
                          <div class="user-header">
                            <div class="avatar-container">
                              <Bot color="white" />
                            </div>
                            <span class="role">{message.prompt_type}</span>
                          </div>
                        {/if}
                      </div>
                
                      {#if message.role === 'options'}
                        <div class="options" in:fly="{{ y: 20, duration: 300, delay: 300 }}" out:fade="{{ duration: 200 }}">
                          {#each JSON.parse(message.content) as option, index (`${message.id}-option-${index}`)}
                            <button 
                              on:click={() => currentStage === 'scenarios'
                                ? handleScenarioSelection(option) 
                                : handleTaskSelection(option)}
                            >
                              <span class="option-description">{option.description}</span>
                              <span class="option-id">{option.id}</span>
                            </button>
                          {/each}
                        </div>
                      {:else if message.isHighlighted}
                        <!-- <p>{@html message.content}</p> -->
                      {:else}
                        <p class:typing={message.isTyping && message.id === latestMessageId}>{@html message.content}</p>
                      {/if}
                      
                      {#if message.role === 'thinking'}
                        <div class="thinking-animation">
                          <span>
                            <Bot color="white" />
                          </span>
                          <span>
                            <Bot color="gray" />
                          </span>
                          <span>
                            <Bot color="white" />
                          </span>
                        </div>
                      {/if}
                
                      {#if message.role === 'assistant'}
                        <div class="message-footer">
                          <Reactions 
                            {message}
                            userId={$currentUser.id}
                            on:update={async (event) => {
                              const { messageId, reactions } = event.detail;
                              await messagesStore.updateMessage(messageId, { reactions });
                              chatMessages = chatMessages.map(msg => 
                                msg.id === messageId 
                                  ? { ...msg, reactions }
                                  : msg
                              );
                            }}
                            on:notification={(event) => {
                              console.log(event.detail);
                            }}
                          />
                        </div>
                      {/if}
                    </div>
                  {/each}
                {/each}
                <button class="scroll-bottom-btn" on:click={scrollToBottom}>
                  <ChevronDown size={24} />
                </button>
              </div>
              <div class="input-container" class:drawer-visible={$threadsStore.showThreadList} transition:slide={{duration: 300, easing: cubicOut}}>
                <!-- Prompts Section -->
                 <div class="combo-input" in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}">
        
        
                  <textarea 
                    bind:this={textareaElement}
                    bind:value={userInput}
                    on:input={(e) => adjustFontSize(e.target)}
                    on:keydown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        !isLoading && handleSendMessage();
                      }
                    }}      
                    on:focus={handleTextareaFocus}
                    on:blur={handleTextareaBlur}
                    placeholder={$t('chat.placeholder')}
                    disabled={isLoading}
                    rows="1"
                  />
                  <div>
                    <div class="submission" class:visible={isTextareaFocused}                    >
                      <span class="btn" >
                        <Paperclip  />
                      </span>
          
                      {#if isTextareaFocused}

                      <span 
                      class="btn"
                      on:click={() => toggleSection('prompts')}
                    >
                        <span class="icon">
                          {#if $expandedSections.prompts}
                          <!-- <Command size={30} /> -->
                          {:else}
                          <!-- <Command size={20} /> -->
                          {/if}
                        </span>
                        {#if selectedPromptLabel}
                          {#if selectedIcon}
                          <div class="icon-wrapper">
                            <svelte:component this={selectedIcon} size={30} color="var(--text-color)" />
                          </div>
                        {/if}
                          <!-- <h3>{$t('chat.prompts')}</h3> -->
                          <!-- <p class="selector-lable">{selectedPromptLabel}</p> -->
                        {:else}
                          <!-- <Command size={20} /> -->
                          <!-- <h3>{$t('chat.prompts')}</h3> -->
                        {/if}
                    </span>
                    <span 
                    class="btn"
                    on:click={() => toggleSection('models')}
                    >
                      <span class="icon">
                        {#if $expandedSections.models}
                        <Brain />
                        {:else}
                        <Brain/>
                        {/if}
                      </span>
                      {#if selectedModelLabel}
                        <!-- <h3>{$t('chat.models')}</h3> -->
                        <p class="selector-lable">{selectedModelLabel} </p>
                      {:else}
                        <!-- <p>{$t('chat.models')}</p> -->
                      {/if}
                    </span>
                    <span 
                    class="btn send-btn" 
                    class:visible={isTextareaFocused}
                    transition:slide
                    on:click={() => !isLoading && handleSendMessage()} 
                    disabled={isLoading}
                  >
                    <Send />
                  </span>
                    {/if}
                  </div>
                  </div>
                </div>
    
                  <div class="ai-selector">
        

            
                    {#if $expandedSections.prompts}
                      <div class="section-content" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                        <PromptCatalog 
                        on:select={(event) => {
                          // Close the prompt catalog by updating the expanded sections store
                          expandedSections.update(sections => ({
                            ...sections,
                            prompts: false
                          }));
                          
                          // Update the selected prompt
                          showPromptCatalog = false;
                          console.log('Parent received selection from catalog:', event.detail);
                        }}
                      />
                      </div>
                    {/if}
            

            
                
                    {#if $expandedSections.models}
                      <div class="section-content" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                        <ModelSelector
                          on:select={(event) => {
                            showModelSelector = !showModelSelector;
                            console.log('Parent received selection from catalog:', event.detail);
                          }}
                        />
                      </div>
                    {/if}
            
                      
                    </div>
    
        
        
    
        
                  </div>
            
          </div>

          
        </div>
      </div>  




        {#if currentStage === 'summary'}

        {/if}
      </div>

  {#if showNetworkVisualization && networkData}
  <div class="network-overlay">
    <div class="network-container">
      <NetworkVisualization networkData={networkData} />
    </div>
  </div>
  {/if}

<link href='https://fonts.googleapis.com/css?family=Montserrat' rel='stylesheet'>

<style lang="scss">
  $breakpoint-sm: 576px;
  $breakpoint-md: 1000px;
  $breakpoint-lg: 992px;
  $breakpoint-xl: 1200px;
	@use "src/styles/themes.scss" as *;
  * {
    /* font-family: 'Merriweather', serif; */
    /* font-family: 'Roboto', sans-serif; */
    /* font-family: 'Montserrat'; */
    /* color: var(--text-color); */
    font-family: var(--font-family);
  }

  :root {
  --h3-min-size: 0.875rem;
  --h3-max-size: 1.125rem;
  --breakpoint-sm: #{$breakpoint-sm};
  --breakpoint-md: #{$breakpoint-md};
  --breakpoint-lg: #{$breakpoint-lg};
  --breakpoint-xl: #{$breakpoint-xl};
}


  // :global(body) {
  //   --date-picker-background: var(--bg-gradient);
	// 	--date-picker-foreground: white;
	// 	--date-picker-highlight-border: var(--bg-color);
	// 	--date-picker-highlight-shadow: var(--tertiary-color);
	// 	--date-picker-selected-color: var(--text-color);
	// 	--date-picker-selected-background: var(--tertiary-color);
    
  // }

  :global {
  // Table styles
  .language-table {
    width: 100%;
    // border-collapse: collapse;
    // margin: 1rem 0;
    // background: var(--bg-gradient-left);
    // box-shadow: 0px 1px 40px 1px var(--secondary-color, 0.01);
    // border-radius: var(--radius-m);
    // overflow: hidden;
  }

  th {
    background: var(--bg-gradient-r);
    padding: 1rem;
    text-align: left;
    font-weight: 400;
    color: var(--text-color);
    border: {
      bottom: 1px solid var(--bg-color);
      right: 1px solid var(--bg-color);
    }
    font-style: italic;

    &:last-child {
      border: {
        right: none;
        left: none;
      }
    }
    &:first-child {
      font-weight: 600;
      text-transform: uppercase;
      font-style: normal;
    }
    &:nth-child(even) {
      background: var(--bg-gradient-left);
    }
  }

  td {
    padding: 1rem;
    border: {
      bottom: 1px solid var(--secondary-color);
      right: 1px solid var(--secondary-color);
    }
    &:last-child {
      border: {
        right: none;
        left: none;
      }
    }
  }

  tr {
    &:last-of-type td {
      border-bottom: none;
    }
    &:nth-child(even) {
      background: var(--primary-color);
    }
    &:hover {
      background: var(--bg-gradient-right);
    }
  }

  // List styles
  ul {
    margin-left: 0;
    padding-inline-start: 0;
  }

  li {
    margin: 0;
    transform: all;
    margin: {
      block-start: 1.5rem;
      block-end: 1rem;
    }
    letter-spacing: 0.1rem;
    border-radius: var(--radius-m);
    gap: 1rem;
    
    li {
      margin-inline-start: 1.5rem;
      padding-inline-start: 0;
    }
    &:li {
      font-size: 1.2rem;
      font-weight: 600;
      transition: 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
      background: var(--bg-gradient-right);
    }
  }

  ol {
    display: flex;
    flex-direction: column;
    list-style-position: outside;
    padding-left: 2.5rem;
    margin: 1rem 0;
    gap: 2rem;

    p {
      font-size: 1.1rem;
      line-height: 1.5;
      margin: {
        left: 0;
        bottom: 0;
      }

      & ol {
        display: flex;
        flex-direction: column;
      }




    }

    li {
      display: flex;
      flex-direction: column;
      position: relative;
      padding: 1rem;
      margin: 0;
      background: var(--bg-gradient-r);
      border-radius: var(--radius-m);
      transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

      &::marker {
        font-weight: 600;
        color: var(--text-color);
      }
      li li {
        transform: all;
        border: 1px solid transparent;

        &:hover {
          transition: 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
          transform: translateX(-0.5rem);
          scale: 1.1;
          box-shadow: 0px 1px 2px 1px var(--secondary-color, 0.01);
          background-color: var(--bg-color);
        }
      }
      
    }

    
  }
  ol, ul {
        margin-top: 1rem;
        margin-bottom: 0.5rem;
      }

      // // Hover effect
      // &:hover {
      //   transform: translateX(0.5rem);
      //   background: var(--bg-gradient-left);
      //   box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
      // }

      // First level items
      &:first-child {
        margin-top: 0;
        margin-bottom: 0;
      }

      // Spacing between heading and content
      strong, b {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 1.2rem;
      }
    
  // Code styles
  pre.language-json {
    margin: 0;
    padding: 0;
    background: none;
  }
  pre code {
    padding: 1rem !important;
    margin-top: 1rem;
  }
  code.language-json {
    display: block;
    color: #d4d4d4;
    padding: 1em;
    border-radius: var(--radius-l);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.5;
    overflow-x: auto;
    tab-size: 2;
    counter-reset: line;
    background: var(--secondary-color);

    .property { color: #9cdcfe; }
    .string { color: #ce9178; }
    .number { color: #b5cea8; }
    .boolean { color: #569cd6; }
    .null { color: #569cd6; }
    .punctuation { color: #d4d4d4; }
    .bracket { color: #ffd700; }

    .error {
      background: rgba(255, 0, 0, 0.2);
      border-bottom: 1px wavy #ff0000;
    }

    .indent-guide {
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      position: absolute;
      left: calc(var(--depth) * 2ch);
      height: 100%;
    }

    > code {
      display: block;
      position: relative;
      padding-left: 3.5em;
      &::before {
        counter-increment: line;
        content: counter(line);
        position: absolute;
        left: -2em;
        width: 1.5em;
        color: #858585;
        text-align: right;
        user-select: none;
      }
    }

    &::selection {
      background: rgba(97, 175, 239, 0.3);
    }

    &:hover {
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
      &-thumb {
        background: #4a4a4a;
        border-radius: 4px;
      }
      &-track {
        background: #2a2a2a;
        border-radius: 4px;
      }
    }
  }
}
  .calendar {
      // background: var(--bg-gradient);
      width: auto;
      padding: 0.1rem 0.5rem;
      border-radius: var(--radius-m);

      &input {
        background: red;
      }
    }
  
  input {
      flex-grow: 1;
      margin-right: auto;
      padding: 0.5rem;
      height: auto;
      font-size: 1rem;
      border-radius: 25px;
      background-color: transparent;
      color: #818380;
      border: none;
      transition: all ease-in 0.3s;
      outline: none;

      
    }

  span {
    display: flex;
    justify-content: left;
    align-items: center;
    color: var(--text-color);

    &.icon {
      transition: all 0.2s ease-in-out;
      gap: 0.5rem;
      height: 36px;

      & 
      
      &.active {
        color: var(--tertiary-color) !important;
      }


    }
    &.counter {
      color: var(--placeholder-color);
      font-size: 16px;
      max-width: 100px;
      margin: 0 !important;
      display: flex;
      flex-direction: row;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }


    &.role {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    &.delete-card-container {
      border: none;
      color: #606060;
      cursor: pointer;
      height: 30px;
      width: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      transition: all ease 0.3s;
      opacity: 0;
      visibility: hidden;
      &:hover {
        height: 30px;
        width: 30px;
        color: red;
      }
    }
  }

  h1 {
    font-size: 1.5rem;
    display: inline-block;
  }

  h3 {
    margin: 0;
    font-size: clamp(var(--h3-min-size), 2vw, var(--h3-max-size));
    font-weight: 600;
    line-height: 1.4;
    }




  button {
    display: flex;
    user-select: none;
    &.btn-back {
      background-color: var(--placeholder-color);
      position: relative;
      display: flex;
      overflow-x: none;
      // height: 50%;
      // top: 3rem;
      justify-content: center;
      align-items: center;
      border: none;
      color: var(--text-color);
      cursor: pointer;
      border-radius: var(--radius-l);
      transition: all 0.3s ease;
    // &:hover {
    //   background-color: var(--tertiary-color);
    //   transform: translateX(2px);
    // }
    // &:active {
    // }

    }

    

    &.btn-ai {
      border-radius: var(--radius-m);
      width: auto;
      height: auto;
      border: none;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all 0.3s ease;
      justify-content: center !important;
      background-color: transparent;
      z-index: 2000;
      &:hover{
        background: var(--secondary-color);
        // box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
        transform: translateY(-10px);

      }
    }
    &.drawer-header {
      justify-content: space-between;
      width: 100%;
      height: 100%;
      gap: 0.5rem;
      &:hover {
        background-color: var(--secondary-color);
      }
    }
    &.add {
      background-color: transparent;
      font-size: var(--font-size-s);
      font-weight: bold;
      cursor: pointer;
      transition: all ease 0.3s;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      user-select: none;
      transition: all 0.2s ease;
      width: fit-content !important;


      // gap: var(--spacing-sm);

      & span.icon {
        color: var(--placeholder-color);
        gap: 0.5rem;

        &:hover {
        color: var(--tertiary-color);
      }

      &.active {
        color: var(--tertiary-color);
      }
      }
    
      &:hover {
        color: var(--tertiary-color);
      }
    }

  }

  /// KEYFRAMES
  @at-root {
  @keyframes swipe {
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    100% {
      transform: translateX(100%) translateY(100%) rotate(45deg);
    }
  }

  @keyframes nonlinearSpin {
    0% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(1080deg);
    }
    50% {
      transform: rotate(0deg);
    }
    75% {
      transform: rotate(1080deg);
    }
    100% {
      transform: rotate(2160deg);
    }
  }

  @keyframes spin {
    from { 
      transform: rotate(0deg); 
    }
    to { 
      transform: rotate(360deg); 
    }
  }

  @keyframes glowy {
    0% { 
      box-shadow: {
        first: 0 0 0 #2b2b29, 0 0 2px #4b505d;
      }
    }
    50% { 
      box-shadow: {
        first: 0 1px 0 #2b2b29, 0 0 15px #4c4e55;
      }
    }
    100% { 
      box-shadow: {
        first: 0 0 1px #474539, 0 0 50px #32322e;
      }
    }
  }

  @keyframes pulsate {
    0% {
      box-shadow: {
        first: 0 0 0 var(--secondary-color);
        second: 0 0 4px var(--tertiary-color);
      }
    }
    100% {
      box-shadow: {
        first: 0 0 1px var(--secondary-color);
        second: 0 0 6px var(--bg-color);
      }
    }
  }

  @keyframes bounce {
    0%, 80%, 100% { 
      transform: scale(0); 
    }
    40% { 
      transform: scale(1); 
    }
  }

  @keyframes blink {
    from, to { 
      opacity: 0; 
    }
    50% { 
      opacity: 1; 
    }
  }

  @keyframes blink-slow {
    0%, 100% { 
      opacity: 0.2; 
    }
    50% { 
      opacity: 0.7; 
    }
  }
}

.project-section {}
.calendar {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;

  }

  .date-input-container {
    display: flex;
    align-items: center;
    justify-content: right;
    gap: 0.5rem;
    position: relative;
    z-index: 4000;
    width: 99%;

  }

  :global(.date-input) {
    display: flex;
    flex-direction: row;
    justify-content: right;
    gap: 20px;
    user-select: none;
    position: relative;
    z-index: 1000;
    width: 100%;
    z-index: 2000;
        &:hover {
      display: flex;
      flex-wrap: nowrap;
      justify-content: right;
      background-color: red;
    }
  }


  /// CONTAINERS
  .thread-info-container {
    display: flex;
    flex-direction:row;
    width: auto;
    margin-top: 0;
    margin-right: 4rem;
    position: relative;
    justify-content: space-between;
    align-items: flex-start;
    min-height: fit-content;
    overflow: visible;
    z-index: 2000;
  }
  .drawer-container {
    display: flex;
    flex-direction: column;

    margin-left: 64px;
    width: 400px;
    padding-left: 1rem;
    padding-right: 1rem;
    position: fixed;
    padding-top: 1rem;    
    margin-right: 0;
    margin-left: 0;
    right: 0;
    left: 0;
    width: 100%;
  

  }
  .chat-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    position: fixed;
    transition: all 0.3s ease-in-out;
    overflow-y: auto;
    overflow-x: hidden;
    // /* left: 20%; */
    width: 100%;
    padding: 0;
    padding-top: 0;
    height: 100vh;
    margin-top: 0;

  }


  .chat-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    background: var(--primary-color);
    margin-left: 25vw;
    width: 50vw;
    height: auto;
    margin-top: 0;
    margin-right: 0;
    height: auto;
    // width: 50%;
    // margin: 0 1rem;
    // margin-left: 25%;
    // padding: 0 10px;
    overflow-y: hidden;
    overflow-x: hidden;
    border-radius: var(--radius-l);
    transition: all ease 0.3s;
  }

  
  .avatar-container {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    position: relative;
    background: var(--primary-color);
    display: flex;
    object-fit: cover;

    & .avatar,
    & .avatar-placeholder {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    & .avatar-placeholder {
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #2c3e50;
      & svg {
        width: 20px;
        height: 20px;
        color: white;
      }
    }
  }

 .drawer-visible {
    &.input-container {
      left: 0;
      margin-left: 400px;
    margin-right: 0;
    width: auto; 
      & textarea {
        margin-left: 0;
      }
    } 
    & .chat-placeholder {
        right: 0;
        width: 100%;
        left: 0;
        margin-left: 0;
    }

    & .chat-content {
      margin-left: auto;
      width: 100%;
      
    }
    & .chat-container {
      right: 0;
      margin-right: 0;
      width: auto;
      left: 400px;
    }
    & .thread-info {
      margin-left: 0;
      margin-right: 0;
    }
  }


  .input-container {
    display: flex;
    flex-direction: column;
    position: fixed;
    margin-left: 25vw;
    margin-right: 25vw;
    width: 50vw;    
    margin-top: 0;
    right: 0;
    left: 0;
    bottom: 0;
    height: auto;
    margin-bottom: 0;
    // backdrop-filter: blur(4px);
    justify-content: flex-end;
    align-items: center;
    // background: var(--bg-gradient);
    z-index: 3000;

    &::placeholder {
      color: var(--placeholder-color);
    }
    
    :global(svg) {
      color: var(--primary-color);
      stroke: var(--primary-color);
      fill: var(--tertiary-color);
    }

    & textarea {
      font-size: 1.5rem;
      border: none;
      box-shadow: none;
      position: relative; 
      left: 0;
      border-radius: var(--radius-m);

      // background-color: transparent;
      background: var(--bg-gradient-r);
      margin-right: 2rem !important;
      margin-left: 4rem;
      // margin-left: 7rem;
      margin-top: 0.5rem;
      transition: 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);  
      padding-top: 1rem;
      padding-left: 1rem;
      // box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
      color: var(--text-color);
      // background: transparent;
      display: flex;
      width: 100%;
      // backdrop-filter: blur(40px);
      // & :focus {
      //   border-top: 1px solid red;
      // color: white;
      // animation: pulse 10.5s infinite alternate;
      // box-shadow: none;

      // display: flex;
      // // background: var(--bg-gradient-left) !important;
      //     // box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);
      //     border-top: 1px solid var(--secondary-color) !important;

      // background: black !important; 
      // padding: 2rem;
      // margin-left: 2rem;
      // margin-right: 0;
      // height: auto;
      // box-shadow: none !important;
      
      // }
    }

  }

  .auth-container {
    background-color: #fff;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }



.combo-input {
  // width: 100vw;;
  bottom: 0;
  margin-bottom: 0;
  // background: var(--bg-gradient);
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: flex-end;
  // backdrop-filter: blur(40px);
  & textarea {
    border-top: 1px solid var(--primary-color) !important;
    max-height: 50vh;
    margin-left: 0;
    margin-top: 0;
  
  :focus {
    background: var(--bg-gradient-left);
    z-index: 4000;   

  }
}
}

.save-button {
position: absolute;
right: 2rem;
top: 1rem;
transition: all 0.3s ease;
}

.save-button:hover {
color: #6fdfc4;
}

.button-row {
  display: flex;
  flex-direction: row;
}

.button-column {
  display: flex;
  flex-direction: column;
}



.submission {
  display: flex;
  flex-direction: column;
  height: auto;
  width: auto;
  justify-content: center;
  align-self: flex-end;
  width: fit-content;
  z-index: 1000;
  gap: 2rem;
  padding: 0.5rem;
  transition: height 0.3s ease;
  border-radius: var(--radius-m);

}

.visible.submission {
  // backdrop-filter: blur(4px);
  background: var(--bg-gradient-left);
}


  .chat-messages {
    flex-grow: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--primary-color);
    /* padding: 10px; */
    display: flex;
    position: relative;
    margin-right: 0;
    // margin-top: 1rem;
    // left: 25%;
    bottom: auto;
    padding: 1rem;
    flex-direction: column;
    overflow-x: hidden;
    align-items: stretch;
    scrollbar-width:2px;
    scrollbar-color: var(--secondary-color) transparent;
    scroll-behavior: smooth;
    // margin-bottom: 100px;
    // height: 100%;
    width: auto;
    border-radius: var(--radius-l);
    // padding-bottom: 40px;
    // border: 2px solid var(--bg-color);
    // background-color: var(--secondary-color);
    // backdrop-filter: blur(10px);

    background: linear-gradient (
      90deg,
      rgba(117, 118, 114, 0.9) 0%,
      rgba(0, 0, 0, 0.85) 5%,
      rgba(117, 118, 114, 0.8) 10%,
      rgba(117, 118, 114, 0.75) 15%,
      rgba(117, 118, 114, 0.7) 20%,
      rgba(0, 0, 0, 0.65) 25%,
      rgba(117, 118, 114, 0.6) 30%,
      rgba(0, 0, 0, 0.55) 35%,
      rgba(0, 0, 0, 0.5) 40%,
      rgba(117, 118, 114, 0.45) 45%,
      rgba(0, 0, 0, 0.4) 50%,
      rgba(0, 0, 0, 0.35) 55%,
      rgba(117, 118, 114, 0.3) 60%,
      rgba(117, 118, 114, 0.25) 65%,
      rgba(117, 118, 114, 0.2) 70%,
      rgba(117, 118, 114, 0.15) 75%,
      rgba(0, 0, 0, 0.1) 80%,
      rgba(1, 1, 1, 0.05) 85%,
      rgba(117, 118, 114, 0) 100%
    );

    &::before {
      display: flex;
      flex-direction: column;
          /* top: 0;
      background: linear-gradient(
        to bottom, 
        rgba(117, 118, 114, 0.9) 0%,
        rgba(117, 118, 114, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(117, 118, 114, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(117, 118, 114, 0.55) 35%,
        rgba(117, 118, 114, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(117, 118, 114, 0.4) 50%,
        rgba(117, 118, 114, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(117, 118, 114, 0.1) 80%,
        rgba(117, 118, 114, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
        
      );
      backdrop-filter: blur(3px);
      height: 20px; */
    }
    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: 30px;
      width: 100%;
      pointer-events: none;
      /* bottom: 90px;
      background: linear-gradient(
        to top,
        rgba(117, 118, 114, 0.9) 0%,
        rgba(117, 118, 114, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(117, 118, 114, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(117, 118, 114, 0.55) 35%,
        rgba(117, 118, 114, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(117, 118, 114, 0.4) 50%,
        rgba(117, 118, 114, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(117, 118, 114, 0.1) 80%,
        rgba(117, 118, 114, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
      );
      backdrop-filter: blur(5px);
      z-index: 1;*/
    }
    &::-webkit-scrollbar {
      width: 10px;
    }
    &::-webkit-scrollbar-track {
      background: #f1f1f1;
    }
    &::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 5px;
    }

  }


  
  .message {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-weight: 200;
    padding: 1rem 1rem;
    gap: 1rem;
    margin-bottom: 1rem;
    width: 100%;
    letter-spacing: 1px;
    line-height: 1;
    transition: all 0.3s ease-in-out;

    & p {
      // font-size: calc(10px + 1vmin);
      font-size: var(--font-size-sm);
      margin: 0;
      padding-left: 0.5rem;
      display: flex;
      flex-direction: column;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-wrap: break-word;
      hyphens: auto;
      text-align: left;
      height: fit-content;
      // margin-left: 1rem;
      // margin-right: 1rem;
      // padding-left: 1rem;
      // margin-block-start: 1rem;
      // margin-block-end: 1rem;


    }
    &:hover::before {
      opacity: 0.8;
      background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);
    }

    // &::before {
    //   content: '';
    //   position: absolute;
    //   top: 0;
    //   left: 0;
    //   right: 0;
    //   bottom: 0;
    //   background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
    //   opacity: 0.5;
    //   z-index: -1;
    //   transition: opacity 0.3s ease;
    // }
    &.thinking {
      display: flex;
      flex-direction: column;
      align-self: center;
      align-items: center;
      text-align: center;
      justify-content: center;
      padding: 2rem;
      width: 100%;
      height: auto;
      font-style: italic;
      border-radius: 50px;
      transition: all 0.3s ease-in;

      & p {
        display: flex;
        flex-wrap: wrap;
        margin: 0;
        width: 100%;
        text-align: center;
        justify-content: center;
        align-items: center;
        font-size: var(--font-size-m);
        color: var(--placeholder-color);
        line-height: 1.5;
        animation: blink 3s ease infinite;

      }
    }
    &.assistant {
      display: flex;
      flex-direction: column;
      align-self: flex-start;
      color: var(--text-color);
      height: auto;
      // background: var(--bg-gradient-r);
      margin-left: 1rem;
      width: fit-content;

      transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    }
    &.options {
      align-self: flex-end;
      background-color: transparent;
      padding: 0;
      margin-right: 20px;
      max-width: 80%;
      box-shadow: none;
      font-style: italic;
      font-size: 30px;
      font-weight: bold;
    }
    &.user {
      display: flex;
      flex-direction: column;
      align-self: flex-end;
      color: var(--text-color);
      background-color: var(--secondary-color);
      border-radius: var(--radius-m);
      height: auto;
      max-width: 600px;
      min-width: 200px;
      font-weight: 500;
      // background: var(--bg-color);
      border: {
        // top: 1px solid var(--primary-color);
        // left: 1px solid red;
      }
      // box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);

      
      transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

    }
    
  }
  .selector-row {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    position: absolute;
    bottom: 10px;
    right: 2rem;
    gap: 20px;

    width: auto;
    /* background-color: black; */
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-bottom: 20px;

    &button {
      padding: 12px;
      width: 100%;
      height: 100%;
      font-size: 14px;
      /* font-family: 'Roboto', sans-serif; */
      font-weight: 100;
      color: #000;
      background: linear-gradient(45deg, rgba(255, 255, 255, 0.8) 0%, rgba(128, 128, 128, 0.8) 100%);
      border: 1px solid #ddd;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: left;
      word-wrap: break-word;
      font-size: calc(10px + 1vmin);
      line-height: 1.5;
      &:hover {
        background-color: #e0e0e0;
        transform: translateY(-2px);
      }
    }
  }
  .option-description {
    display: block;
    margin-bottom: 5px;
  }
  .option-id {
    display: block;
    font-size: 0.8em;
    color: #666;
  }

  .role {
    font-weight: bolder;
    align-self: center;
    justify-content: center;
    height: 100%;
  }

.thread-actions {
  display: flex;
  flex-direction: row;
  width: 100%;
  margin-bottom: 0.5rem;
  border-radius: var(--radius-l);
}



.chat-header {
    height: 3rem;
    margin-left: 0;
    position: relative;
    // background: var(--primary-color);
    // border-top-left-radius: var(--radius-m);
    // border-top-right-radius: var(--radius-m);
    top: 0 !important;
    left: 0;
    right: 0;
    width: 100%;
    padding: 0.5rem;
    color: var(--text-color);
    text-align: left;
    align-items: center;
    transition: background-color 0.2s;
    // border-radius: var(--radius-m);
    display: flex;
    // gap: 2rem;
    flex-direction: row;
    justify-content: space-between;
    transition: all 0.2s ease;
    z-index: 2000;
    backdrop-filter: blur(10px);
    & h3 {
      margin: 0;
      font-weight: 300;
      font-size: var(--font-size-sm);    
      font-weight: 600;
    line-height: 1.4;
    &.active {
      // background: var(--primary-color) !important;
      color: var(--tertiary-color);
      font-size: var(--font-size-m);
      
    }
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      
    }
  }

  .drawer-tab {
    display: flex;
    align-items: center;
    justify-content: space-between;
  
    width: auto !important;
    padding: 0 1rem;
    position: relative;
    // padding: 0.5rem 1rem;
    height: 100%;
    border: none;
    border-radius: 2rem;
    background: var(--secondary-color);
    color: var(--placeholder-color);
    cursor: pointer;
    transition: all 0.2s ease-in-out;

    }


    &.active {
      background: var(--primary-color) !important;
      color: var(--tertiary-color);
      font-size: var(--font-size-s);
      width: fit-content;
      flex: 1;
      justify-content: center;
    }


  }


.drawer-header {
    width:300px;
      margin-left: 1rem;
      margin-right: 4rem;
      height: 30px;
      // padding: 0.5rem 0.5rem;
      border: none;
      cursor: pointer;
      color: var(--text-color);
      text-align: left;
      display: flex;
      align-items: center;
      transition: background-color 0.2s;
      // border-radius: var(--radius-m);
      display: flex;
      flex-direction: row;
      position: absolute;
      // background: var(--bg-gradient-r);
      backdrop-filter: blur(10px);
      margin-bottom: 0;
      left: 2rem;
      right: 0;
      bottom: 3rem;
      // border-radius: var(--radius-l);
  }


  .drawer-tab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: auto !important;
    padding: 0 1rem;
    position: relative;
    // padding: 0.5rem 1rem;
    height: 100%;
    border: none;
    border-radius: 2rem;
    background: var(--secondary-color);
    color: var(--placeholder-color);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    & h3 {
      margin: 0;
      font-weight: 300;
      font-size: var(--font-size-sm);    
      font-weight: 600;
    line-height: 1.4;
    &.active {
      background: var(--primary-color) !important;
      color: var(--tertiary-color);
      font-size: var(--font-size-xs);
      
    }
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      
    }
    }


    &.active {
      background: var(--secondary-color) !important;
      color: var(--tertiary-color);
      font-size: var(--font-size-s);
      width: fit-content;
      flex: 1;
      justify-content: center;
    }


  }
  .thread-filtered-results {
    margin-top: 0;
    margin-bottom: 1rem;
    position: relative;
  }
  .drawer-toolbar {
    width:auto;
      margin-left: 0;
      position: absolute;
      margin-bottom: 0;
      height: 30px;
      padding: 0.75rem 1rem;
      // border-bottom: 2px solid var(--secondary-color);
      cursor: pointer;
      color: var(--text-color);
      backdrop-filter: blur(10px);
      z-index: 1;
      text-align: left;
      align-items: center;
      justify-content: left;
      gap: 3rem;
      transition: background-color 0.2s;
      // border-radius: var(--radius-m);
      display: flex;
      flex-direction: row;
      left: 0;
      right: 0;
      bottom: 6rem;

    & input {
      width: 100%;
    };
  }

.drawer-input {
  display: flex;
  flex-direction: row;
  align-items: center;
  // padding: 0.75rem 0;
  width: 200px;
  gap: 0.5rem;
  border-radius: var(--radius-m);
  height: auto;
  width: fit-content;
  color: var(--bg-color);
  transition: all 0.3s ease;

  &:hover {
    background-color: var(--secondary-color);
    }



  & button {
    border-radius: var(--radius-m);
    width: auto;
    border: none;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.3s ease;
    justify-content: center !important;
    z-index: 2000;
    // &:hover{
    //   // background: var(--secondary-color);
    //   // box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
    //   // transform: translateY(-10px);

    // }
  }

    & input {
      padding: 0.5rem;
      border: none;
      border-radius: var(--radius-m);
      padding-left: 1rem;
      outline: none;
      margin-left: 0;
      margin-right: 0;
      width: auto;
      color: var(--text-color);
      transition: all 0.3s ease;
      &::placeholder {
        color: var(--placeholder-color);
      }
      
      &:focus {
        background-color: var(--secondary-color);

        &::placeholder {
          color: var(--placeholder-color);
          
        }
      }
    }
}



.thread-group {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--spacing-md);
  backdrop-filter: blur(20px);
  // border-radius: 10px;
  scrollbar-width:1px;
    scrollbar-color: #c8c8c8 transparent;
    scroll-behavior: smooth;
    // backdrop-filter: blur(8px);

}

.thread-group-header {
    width: 100%;
    padding: 0.5rem 1rem;
    background: transparent;
    
    border: none;
    cursor: pointer;
    color: var(--text-color);
    text-align: left;
    display: flex;
    align-items: center;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
    transition: 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);  
    user-select: none;
      &:hover {
        background-color: var(--primary-color);
        font-weight: 800;
      }

    //   &:active {
    //     background-color: red;
    // }
  }
// .thread-group-header:hover {
 
//         // transform: scale(0.9);   
//         // letter-spacing: 4px;
//         // width: calc(100% - 40px);
//         // z-index: 10;
//         // border-bottom-right-radius: 19px;
//         // border-left: 40px solid rgb(169, 189, 209);
//         // border-top: 4px solid rgb(129, 160, 190);
//         // border-right: 1px solid black;
//         // border-bottom: 20px solid rgb(80, 80, 80);
//   }


  .group-icon {
    display: flex;
    justify-content: center;

  }
  .group-header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem;
  }

  .group-title {
    font-weight: 400;
    font-size: 1rem;
    color: var(--placeholder-color);
    margin-right: 1rem;

  }



  .group-title-active {
    font-weight: 800;
    font-size: 1.1rem;
    color: var(--text-color);
    margin-bottom: 1rem;
    margin-right: 1rem;
  }

  .user-header {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  user-select: none;
}

  .message-header {
    display: flex;
    flex-direction: row;
    margin-left: 0;
    justify-content: flex-start;
    align-items: center;
    width: 100% ;
    gap: 1rem;
  }

  .message-time {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--placeholder-color);
    
  }

  .message-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    color: var(--placeholder-color);
    font-weight: 200;
    
  }




  .thinking-animation {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: left;
    margin-top: 10px;

    span {
      width: 40px;
      height: 40px;
      margin: 0 5px;
      padding: 10px;
      background-color: transparent;
      animation: bounce 1s infinite ease-in-out both;

      &:nth-child(1) {
        animation-delay: -0.32s;
      }

      &:nth-child(2) {
        animation-delay: -0.16s;
      }
    }
  }
  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-color);

    
      :global(svg) {
        color: var(--primary-color);
        stroke: var(--primary-color);
        fill: var(--tertiary-color);
      }
  }


  

  .highlight {
    background-color: rgba(255, 255, 0, 0.3);
    border-radius: 3px;
    padding: 0 2px;
    font-weight: bold;
  }




  .drag-handle {
    width: 100%;
    height: 20px;
    background-color: transparent;
    border: none;
    cursor: ns-resize;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #888;
  }

  .btn-col-left {
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: fixed;
    left: 0;
    top: 60px;
    height: 94%;
    bottom: 1rem;
    width: auto;
    align-items: left;
    justify-content: flex-end;
    z-index: 10;
    border-radius: 1rem;
    padding: 0.5rem;
    transition: all 0.3s ease-in;
}

.btn-col-left:hover {
  backdrop-filter: blur(10px);
}

.input-row {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: flex-start;
  width: 100%;
  position: relative;

}
.btn-row-right {
  display: flex;
  flex-direction: column;
  height: auto;
  transition: all 0.3s ease;
  z-index: 1000;
  & span {
    height: 100%;
    width: 100%;
    padding: 4px;
    justify-content: center;
    align-items: center;
    background-color: var(--primary-color);
    border-radius: 50%;
    transition: all 0.3s ease;
    &:hover {
      background-color: var(--tertiary-color);
      box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
    }
  }
  &.expanded {
    opacity: 1;
    bottom: 140px;
    gap: 1rem;
    right: 2rem;
    display: flex;

    & > * {
      display: flex;
    }
  }
  & > *:not(:last-child) {
    display: none;
  }

  &:hover {
    opacity: 1;
  }
  }

  .btn-mode {
    position: relative;
    bottom: 200px;
    right: 0;
  }

  .btn-send {
    position: relative;
    bottom: 20px;
    right: 0;
    border: 1px solid rgba(53, 63, 63, 0.5);   
  }

  .btn-upload {
    position: relative;
    margin-bottom: 20px;
    right: 0;
    border: 1px solid rgba(53, 63, 63, 0.5);   
  }

  textarea {
    display: flex;
    flex-direction: column;
    /* font-family: 'Merriweather', serif; */
    width: auto;
    min-height: 80px;
    max-height: 50% !important;
    /* min-height: 60px; Set a minimum height */
    /* max-height: 1200px; Set a maximum height */
    // padding: 1rem;
    text-justify: center;
    justify-content: center;
    resize: none;
    font-size: 24px;
    letter-spacing: 1.4px;
    border: 1px solid rgba(53, 63, 63, 0.5);   
    // border-radius: 20px;
    /* background-color: #2e3838; */
    // background-color: #020101;
    color: #818380;
    line-height: 1.4;
    height: auto;
    text-justify: center;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
    overflow: scroll;
    scrollbar-width:none;
    scrollbar-color: #21201d transparent;
    vertical-align: middle; /* Align text vertically */
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

    &:focus {
      /* margin-right: 5rem; */
      outline: none;
      // border: 2px solid #000000;
      transform: translateY(0) rotate(0deg); 
      font-size: 30px;
      padding: 2rem;
      /* height: 400px; */
      display: flex;
      /* min-height: 200px; */
      
    }
  }

  .auth-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }





.message-count {
  color: var(--placeholder-color);
}

.chat-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-m);
  top: 0;
  backdrop-filter: blur(10px);
  // background: var(--primary-color);
  bottom: 0;
  height: 88vh;
  user-select: none;
  position: absolute;
  width: auto;
  left: 0;
  right: 0;

  & h3 {
    user-select: none;
  }
}


.chat-placeholder img {
  width: 100%;
  transform: translateX(25%) translateY(-20%);
}


.message-time {
  font-size: 0.8em;
  color: #888;
  width: auto;
  position: relative;
  // margin-top: 5px;
  right: auto;
}

  .selector-lable {
  color: var(--text-color);
  opacity: 0.5;
  display: inline;
  font-size: var(--font-size-sm);
  font-style: italic;;
  font-weight: normal;
  width: 100%;
  user-select: none;
  // margin-left: 0.5rem;
}





  .landing-footer {
    display: flex;
    flex-direction: row;
    width: 98%;
    margin-left: 1%;
  }




// .thread-name {
//   display: flex;
//   flex-direction: row;
//   justify-content: left;
//   align-items: center;
//   gap: 1rem;

// }

/// Thread styles
// .thread-info {
//   display: flex;
//   flex-direction: column;
//   width: auto;
//   height: auto !important;
//   flex-wrap: nowrap;
//   position: relative;
//   transition: all 0.3s ease;
//   z-index: 1000;
//   margin: {
//     left: 0;
//     right: 25%;
//   }
//   overflow: {
//     x: hidden;
//     y: hidden;
//   }
//   color: white;
//   left: auto;

//   &.minimized {
//     max-height: 50px;
//     overflow: hidden;

//     & h1 {
//       font-size: 1em;
//       margin: 0;
//       padding: 10px 0;
//       color: var(--text-color);
//       &:hover {
//         cursor:text;
//         color: rgb(113, 249, 243);
//       }
//     }
//   }


//   & input {
//     background-color: var(--secondary-color);
//     border-bottom: 1px solid rgb(134, 134, 134);
//     width: auto;
//     border-radius: var(--radius-l);
//     position: relative;
//   }


// }
  
  .thread-stats {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    // align-items: center;    
    /* position: absolute; */
    /* right: 2rem; */
    gap: 40px;
    /* width: 100%; */
    font-size: 0.9em;
    color: #666;
    font-size: 20px;
    margin-bottom: 10px;
  }

  .card-title {
    font-weight: 300;
    font-size: var( --font-size-s);
    margin-bottom: 0.25rem;
    text-align: left;
    
  }


  .card-title.project {
    font-weight: 300;
    font-size: var(--font-size-sm);
    display: flex;
    width: auto;

  }

  .card-static {
    display: flex;
    flex-direction: column;
    position: relative;
    align-items: flex-start;
    justify-content: flex-start;
    width: 100%;
    line-height: 1.2;
    margin-left: 2rem;
  }
  .card-time {
    font-size: var(--font-size-xs);
    display: flex;
  }



  button.action-btn {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    color: transparent;
    width: auto;
    transition: all 0.1s ease;
    &.badge {
      padding: 0.5rem;
      gap: 0.5rem;
      height: 100%;
      display: flex;
      justify-content: center;
      border-radius: var(--radius-s);
      background: var(--bg-gradient-r);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      user-select: none;
      transition: all 0.2s ease;

    }
    &:hover {
      color: var(--tertiary-color);

    &.delete {
      &:hover {
        color: red;
      }
    }
    }
  }



  .project-name-input {
    width: 200px;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
  }


  
  .drawer-list {
    display: flex;
    flex-direction: column;
    width:100%;
    margin-left: 0;
    margin-right: 0;
    margin-top: 0;
    margin-bottom: 8rem;
    top: 0;
    height: auto;
    // backdrop-filter: blur(20px);
    border-radius: 10px;
    overflow-y: scroll;
    overflow-x: hidden;
    scrollbar-width:1px;
    scrollbar-color: var(--text-color) transparent;
    scroll-behavior: smooth;

  }
  .drawer {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  background: var(--bg-gradient-right);
  // z-index: 11;
  overflow: {
    x: hidden;
    y: auto;
  }
  position: relative;
  top: 0;
  bottom: 0;
  margin-left: 0;
  gap: 1px;
  height: 100%;
  width: 400px;
  transition: all 0.3s ease-in-out;
  scrollbar: {
    width: 1px;
    color: #c8c8c8 transparent;
  }
  scroll-behavior: smooth;

  &.hidden {
    display: none;
    transform: translateX(-100%);
  }

  & button {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    background-color: transparent;
    border: none;
    cursor: pointer;
    color: #fff;
    transition: all 0.3s ease-in;
    font-family: var(--font-family);
    width: 100%;

    &.selected {
      backdrop-filter: blur(8px);
      font-weight: bold;
      animation: pulsate 0.5s 0.5s initial;
    }
  }

  }


  .thread-count {
      color: var(--text-secondary);
      font-size: 0.9em;
      color: var(--placeholder-color);
    &.active {
      color: var(--text-secondary);
      color: var(--text-color);
    }
  }
  .thread-message {
    font-size: var(--font-size-xs);
    color: var(--placeholder-color);
  }

  .cards {
    margin-bottom: 4rem;
    background: var(--primary-color);
    border-top-right-radius: var(--radius-l);
    border-bottom-right-radius: var(--radius-l);
    

    // box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

  }


  .card-container {
    display: flex;
    flex-direction: row;
    position: relative;
    width: 100% !important;
    border-top-right-radius: var(--radius-m);
    border-bottom-right-radius: var(--radius-m);

    margin-right: 1rem;
    padding: 0;
    cursor: pointer;
    background: var(--bg-gradient-left);

  }
  button.card-container {
    display: flex;
    flex-direction: column;
    position: relative;
    flex-grow: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-xs);
    // background-color: var(--bg-color);
    width: auto;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.1s ease-in-out;
    &:hover {
      box-shadow: none;
      background: var(--secondary-color) !important;

        // background: rgba(226, 226, 226, 0.2);  /* Very subtle white for the glass effect */
        transform: translateX(-1rem);
        opacity: 1;
        visibility: visible;
        // box-shadow: -5px -1px 5px 4px rgba(255, 255, 255, 0.2);
      }
      &.selected {
        background: var(--primary-color) !important;
      }

  }

  .card {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: flex-end;
    width: 100%;
    height: 100%;
    position: relative;
    // backdrop-filter: blur(8px);
    // background: var(--bg-gradient-left);
    // border-bottom: 5px solid var(--bg-color);
    // border-top: 1px solid var(--bg-color);
    // border-left: 5px solid var(--bg-color);
    // border-right: 1px solid var(--bg-color);
    transition: all 0.3s ease;

    // &.active {
    //   border-left: 3px solid var(--primary-color);
    // }


    
  }

  span.icon:hover .card-actions {
    transform: translateX(0);
    opacity: 1;
    visibility: visible;
    backdrop-filter: blur(10px);
  }

  span.icon .card-actions {
    width: auto;
    height: 36px;
    position: absolute;
    right: 1rem;
    gap: 0.5rem;
    z-index: 1000;

  }

  .card-actions {
    position: absolute;
    display: flex;
    flex-direction: row;
    right: 0;
    gap: 1rem;
    height: 100%;
    display: flex;
    gap: 0.5rem;
    transform: translateX(100%);
    width: auto;
    opacity: 0;
    transition: all 0.2s ease;
    visibility: hidden;
  }

  .card-container:hover .card-actions {
    transform: translateX(0);
    opacity: 1;
    visibility: visible;
  }
  .thread-toggle {
    color: var(--text-color);
    background: var(--bg-gradient-right);
    font-size: 16px;
    border: none;
    cursor: pointer;
    border-radius: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 50px;
    height: 50px;
    padding: 0.5rem;
    transition: all 0.3s ease-in-out;
    overflow: hidden;
    user-select: none;
  &:hover {
    box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
  }
  }



  .message-actions {
    opacity: 0;
    transition: opacity 0.3s ease;
  }



  .quote-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-left: 10px;
  }

  .quoted-message {
    background-color: rgba(0, 0, 0, 0.1);
    border-left: 3px solid #888;
    padding: 5px 10px;
    margin-bottom: 5px;
    font-size: 0.9em;
    display: flex;
    align-items: center;
  }

  .quoted-message span {
    margin-left: 5px;
  }

  .typing::after {
    content: '▋';
    display: inline-block;
    vertical-align: bottom;
    animation: blink 0.7s infinite;
  }



.btn {
  background-color: transparent;
  height: 50px;
  width: 50px;
  display: flexbox;
  justify-content: center;
  align-items: center;
  border-radius: var(--radius-l);
  box-shadow: 2px -4px 20px 1px rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  border: none;
  &:hover {
    transform: translateY(-10px);
    background: var(--bg-gradient-left);

  }

  &.send-btn {
    background-color: var(--tertiary-color);
  }

}

  .scroll-bottom-btn {
    position: fixed;
    bottom: 12rem !important;
    right: 2rem;
    background-color: #21201d;
    color: white;
    border: 1px solid rgba(53, 63, 63, 0.5);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.3s;
    z-index: 100;
    align-self: flex-end;
    margin-right: 0;
    margin-bottom: 0;

    &:hover {
      background-color: #000000;

    }
  }


  .delete-card-container {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s, transform 0.3s;

  &:hover {
    opacity: 1;
    visibility: visible;
    box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
  }
}




.date-divider {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: relative;
  width: 200px;
  padding: 0.5rem 1rem;
  margin: {
    top: 2rem;
    bottom: 1rem;
    left: calc(50% - 100px);

  }
  gap: 2rem;
  cursor: pointer;
  border-bottom: 1px solid var(--secondary-color);
  backdrop-filter: blur(100px);
  background: var(--placeholder-color);
  transition: all ease 0.15s;
  color: var(--text-color);
  user-select: none;
  border-radius: var(--radius-m);

  &:hover {
    transform: translateY(-5px) rotate(0deg);
    background: var(--bg-gradient-left);
    color: var(--tertiary-color);
  }

  &.bottom {
    display: flex;
    justify-content: center;
    align-items: center;
    background: none;
    border: 0;
    padding: 0;
    backdrop-filter: none;
    border: {
      top: none;
      bottom: none;
      bottom-left-radius: 30px;
      bottom-right-radius: 30px;
    }
    cursor: pointer;
  }
}
  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }



  .illustration {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 90%;
    height: auto;
    left: 0%;
    top: 60%;
    transform: translateY(-50%);
    opacity: 0.025;
    // z-index: 1;
    pointer-events: none;
    backdrop-filter: blur(20px);
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-top-right-radius: 50px;
    border-bottom-right-radius: 50px;
    color: white;
    z-index: 4000;
    margin-bottom: 2rem;
    backdrop-filter: blur(20px);
    border-radius: var(--radius-l);
  }

  .spinner {
    border: 4px solid var(--text-color);
    border-top: 4px solid var(--tertiary-color);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
  }

  .spinner2 {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 60px;
        height: 60px;
        color: var(--tertiary-color);
        border: 5px dashed #363f3f;
        border-radius: 50%;
        position: relative;
        /* background-color: yellow; */
        animation: nonlinearSpin 4.2s infinite;
        animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
        &.naming {
    background: var(--bg-gradient);
    border-radius: var(--radius-m);
  }
    }

    .bot-icon {
        width: 50%;
        height: 50%;
        color: var(--primary-color);

    }
    





  .section-header-content {
    display: flex;
    align-items: center;
    width: 100%;
    h3 {
      margin-right: .5rem;
    }
  }




  .section-content2 {
    width: 100%;
    overflow: hidden;
    padding: 0.5rem 1rem;
    // background: var(--bg-gradient-left);
    // border-radius: var(--radius-m);
  }


  .section-content {
    width: 100%;
    display: flex;
    justify-content: right;
      bottom: 10rem;
    margin-right: 0;
    right: 2rem;
    left: 0;
    height: auto;
    position: absolute;
    overflow: hidden;
    // padding: 0.5rem 1rem;
    scrollbar-width:1px;
      scrollbar-color: var(--primary-color) transparent;
      scroll-behavior: smooth;
    // background: var(--bg-gradient-left);
    // border-radius: var(--radius-m);
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    transition: color 0.2s ease;
    color: var(--placeholder-color);
      
      &.active {
        color: var(--tertiary-color);
      }

      &:hover {
        color: var(--tertiary-color);
      }
    }
  
  .ai-selector {
    display: flex;
    flex-direction: row;
    justify-content:flex-start;
    padding-left: 3rem;
    width: 100%;
  }

  .tooltip {
    position: absolute;
    left: 0;
    margin-left: 18px;
    margin-top: 50px;
    font-size: 0.7rem;
    white-space: nowrap;
    background-color: var(--secondary-color);
    backdrop-filter: blur(80px);
    border: 1px solid var(--secondary-color);
      font-weight: 100;
      animation: glowy 0.5s 0.5s initial;    
    padding: 4px 8px;
    border-radius: var(--radius-s);
    z-index: 2000;
    transition: all 0.2s ease ;
  }


  .create-confirm {
    margin-left: 0.5rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .create-confirm:not(:disabled):hover {
    opacity: 1;
  }

  
  @media (max-width: 1000px) {

    .chat-container {
      top: 3rem;
    }
    
    .thread-filtered-results {
      margin-bottom: 5rem;
    }
    .chat-content {
      width: 100%;
      margin-left: 0;
    }

    .chat-messages {
      width: auto;
      margin-right: 0;
      right: 0;
      
    }

    .drawer-header {
      width:auto;

      margin-bottom: 4rem;
      left: 0;
      right: 0;
      margin-right: 0;
      margin-left: 0;
      display: flex;
      position: absolute;
      height: 30px;
      padding: 0.75rem 1rem;
      border: none;
      cursor: pointer;
      color: var(--text-color);
      text-align: left;
      display: flex;
      align-items: center;
      transition: background-color 0.2s;
      // border-radius: var(--radius-m);
      display: flex;
      flex-direction: row;
      // background: var(--bg-gradient-r);
      z-index: 3000;

      // border-radius: var(--radius-l);
    }
    .drawer-toolbar {
      width:auto;

      margin-bottom: 4rem;
      left: 0;
      right: 0;
      margin-right: 0;
      margin-left: 0;     
      display: flex;
      position: absolute;
      height: 30px;
      padding: 0.75rem 1rem;
      border: none;
      cursor: pointer;
      color: var(--text-color);
      text-align: left;
      display: flex;
      align-items: center;
      transition: background-color 0.2s;
      // border-radius: var(--radius-m);
      display: flex;
      flex-direction: row;
      // background: var(--bg-gradient-r);
      z-index: 3000;
    }
    .card {
      margin-left: 0;
      width: 100%;
    }
      .thread-info input  {
        background-color: var(--secondary-color);
        border-bottom: 1px solid rgb(134, 134, 134);
        width: auto;
        margin-left: 1rem;
        padding: 1rem;
        font-size: 24px;
        border-radius: var(--radius-l);
      }

    .drawer {
      top: 0;
      margin-left: 0;
      margin-right: 0;
      width: 100%;
      height: 100%;
      align-items: left;
      justify-content: center;
      // margin-bottom: 4rem;
      transform: translateX(-100%);
      transition: transform 0.3s ease-in-out;
      /* z-index: 1000; */
    }

    .section-content {
      width: 94%;
      padding: 0;
      left: 1rem;
      margin-bottom: 2rem;
      z-index: 0;
      background: transparent;
    }

    .card-title {
      font-size: 1.5rem;
      font-style: bold;
    }


    .thread-group-header {
      font-size: 1rem;
    }

    .combo-input {
      width: 100% !important;

    }

    .ai-selector {
      width: 100%;
      align-items: center;
      gap: 1rem;
      justify-content: flex-end;
      margin-right: 2rem;
      right: 0;
      padding: 0;
      position: relative;
    }

    .group-title {
      font-size: 1.2rem;
      font-style: bold;

    }

    .group-title-active {
      font-size: 1.5rem;
      
    }

    .thread-group {
      padding: 0.5rem;
      margin-left: 0;
    }

    .drawer-visible .drawer {
      transform: translateX(0);
    }

    .drawer-visible .chat-container {
      display: none;
    }




    h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 16px;
      padding: 10px;
      border-radius: 5px;
    }
  .drawer-container {
      /* background-color: red; */
      width: auto;
      margin-right: 2rem;
      

    }
  .drawer {
      width: 100%;
      padding: 0;

    }
    


    .drawer-visible .thread-toggle {
      left: 10px;
    }

  .input-container {
    bottom: 2rem;
    width: auto !important;
    margin-left: 200px;
    right: 0;
    gap: 0;
    // left:1rem !important;
    margin-left: 0 !important;
    margin-right: 0;
    padding: 0 0 0 0 !important;
    // box-shadow: -0 -1px 100px 4px rgba(255, 255, 255, 0.2);
    box-shadow: none;
    z-index: 4000 !important;
    &     textarea {
      font-size: 1.5rem;
      border: none;
      box-shadow: none;
      position: relative; 
      left: 0;
      border-top-left-radius: 0;

    }

  }

  // .input-container textarea {
  //   box-shadow: none;
  //   border: none !important;
  //   // font-size: 2rem !important;
  //   padding-bottom: 0;
  //   margin-left: 0;
  //   width: auto;
  //   margin-right: 0;
  //   background: auto !important;
    
  // }

    .input-container textarea:focus {
      border: none;
      color: white;
      animation: pulse 10.5s infinite alternate;
      box-shadow: none;
      display: flex;
      // background: var(--bg-gradient-left) !important;
          // box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);

      // background: black !important; 
      padding: 2rem;
      margin-left: 0;
      margin-right: 0;
      height: auto;
      box-shadow: none !important;
      
  }

  }



@media (max-width: 1000px) {
  .btn-col-left {
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: fixed;
    left: 0;
    top: 0;
    height: 90%;
    width: auto;
    align-items: left;
    justify-content: flex-end;
    z-index: 10;
    border-radius: 1rem;
    padding: 0.5rem;
    transition: all 0.3s ease-in;

}

.drawer-list {
  height: 100%;
}

  


.btn-col-left:hover {
  width: 96%;
}
  .scroll-bottom-btn {
    bottom: 200px;
  }

  .thread-toggle {
    bottom: 120px;
  }

  // .chat-messages {
  // }

  // .drawer-visible .chat-messages {
    
  // }




//   button.add  {
//     border-radius: 15px;
//     padding: 5px 10px;
//     font-size: 12px;
//     cursor: pointer;
//     transition: all ease 0.3s;
//     width: 94%;
//     height: 40px;
//     display: flex;
//     justify-content: center;
//     align-items: center;
//     margin-left: 3.5rem;
//     background-color: var(--tertiary-color);

// }

  // .input-container {
  //   margin-bottom: 0;
  //   width: 98%;
  //   padding: 0 0 1rem 3rem;
  // }

  //   .input-container textarea:focus {
  //     border: 1px solid rgb(54, 54, 54);
  //     background-color: rgb(0, 0, 0);
  //     color: white;
  //     font-size: 20px;
  //     animation: pulse 10.5s infinite alternate;
  //     display: flex;
  //     z-index: 1000;
  // }

 
  
    .date-divider {
      margin-right: 2rem;
    }

    .message.assistant  {
    width: 100%;    /* border: 1px solid black; */

    }
}
@media (max-width: 1900px) {

  .thread-info {
  display: flex;
  flex-direction: column;
  width: auto;
  height: auto !important;
  flex-wrap: nowrap;
  position: relative;
  transition: all 0.3s ease;
  z-index: 1000;
  margin: {
    left: 0;
    right: 0;
  }
  overflow: {
    x: hidden;
    y: hidden;
  }
  color: white;
  left: auto;

  &.minimized {
    max-height: 50px;
    overflow: hidden;

    & h1 {
      font-size: 1em;
      margin: 0;
      padding: 10px 0;
      color: var(--text-color);
      &:hover {
        cursor:text;
        color: rgb(113, 249, 243);
      }
    }
  }


  & input {
    background-color: var(--secondary-color);
    border-bottom: 1px solid rgb(134, 134, 134);
    width: auto;
    border-radius: var(--radius-l);
    position: relative;
  }


}

.input-container {
  width: auto;
  margin-left: 4rem;
  margin-right: 1rem;
}
  

.drawer-visible {
  .chat-container {
    right: 0;
    margin-right: 0;
    width: auto;
    left: 400px;
    margin-left: 1rem;

  }
    &.input-container {
      left: 1rem;
      margin-left: 400px;
    margin-right: 0;
    width: auto; 
      & textarea {
        margin-left: 0;
      }
    } 
  }

  .chat-content {
      width: 100%;
      margin-left: 0;
    }

  .chat-messages {
    border: none;
    background: none;
    width: auto !important;
    position: absolute;
    left: 0rem;
    right: 0;
    top: 1rem;
    bottom: 6rem;
    margin-top: 0 !important;
    margin-right: 1rem;
    margin-left: 0 !important;
    margin-bottom: 0;
    
  }

  .drawer-visible .chat-messages {
    margin-left: 0 !important;
    bottom: 0;
    left: 0;
    right:0;
    top: 2rem;
    width: auto;
  }




  
  .drawer-visible .chat-placeholder {
    right: 0;
    width: 100%;
    left: 0;
    margin-left: 0;
    height: 84vh;
}




.chat-placeholder img {
  width: 150%;
  transform: translateX(2%) translateY(-20%);
  
}

}


@media (max-width: 450px) {


  .drawer-container {
    margin-right: 0;
    margin-left: 0;
    right: 0;
    left: 0;
    width: 100%;
    
  }


  .chat-container {
    padding: 0;
    top: 3rem;
  }
  



  .drawer-list {
    margin-top: 0 !important;
    top: 0 !important;
    

  }

  .drawer {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    overflow-x: hidden;
    overflow-y: auto;
    position: relative;
    // padding: 20px 10px;
    // border-top-left-radius: 50px;
    // background-color: var(--bg-color);
    top: 0;
    gap: 1px;
    // left: 64px;
    height: 100%;
    width: auto;
    // height: 86%;
    // background: var(bg-gradient-r);
    // border-radius: var(--radius-l);
    transition: all 0.3s ease-in-out;
    scrollbar-width:1px;
    scrollbar-color: #c8c8c8 transparent;
    scroll-behavior: smooth;
  }

  // .drawer {
  //   display: flex;
  //   flex-direction: column;
  //   justify-content: flex-start;
  //   align-items: center;
  //   overflow-x: hidden;
  //   overflow-y: auto;
  //   position: relative;
  //   // padding: 20px 10px;
  //   // border-top-left-radius: 50px;
  //   // background-color: var(--bg-color);
  //   top: 0;
  //   gap: 1px;
  //   // left: 64px;
  //   height: 90%;
  //   width: auto;
  //   // height: 86%;
  //   // background: var(bg-gradient-r);
  //   // border-radius: var(--radius-l);
  //   transition: all 0.3s ease-in-out;
  //   scrollbar-width:1px;
  //   scrollbar-color: #c8c8c8 transparent;
  //   scroll-behavior: smooth;
  // }
  .input-container {
    width: auto;
    left: 0rem;
    right: 0;
    bottom: 1rem;
  }

  .input-container textarea {
    font-size: 1.5rem;
    padding: 1rem;
  }

    .input-container textarea:focus {

      background: transparent !important;
      color: white;
      font-size: 20px;
      animation: pulse 10.5s infinite alternate;
      display: flex;
      z-index: 1000;
      box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);

  }


  // .drawer-header:hover {
  //   // background-color: var(--hover-color);
  // }

  .section-header-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .drawer-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .section-content {
    width: 100%;
    overflow: hidden;
    padding: 0;
    margin-left: 0;
    // background: var(--bg-gradient-left);
    // border-radius: var(--radius-m);
  }

  .icon {
    display: flex;
    align-items: center;
  }

  .thread-actions {
  display: flex;
  flex-direction: row;
  width: auto;
  height: 50px;
  background: var(--bg-gradient-left);
  margin-bottom: 0.5rem;
  margin-left: 2rem;
  margin-right: 2rem;
  border-radius: var(--radius-l);
}




.drawer-input {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  // padding: var(--spacing-sm);
  border-radius: var(--radius-m);
  height: var(--spacing-xl);
  width: auto;
  height: auto;
  z-index: 2000;



  input {
    background: transparent;
    border: none;
    color: var(--text-color);
    width: 100%;
    outline: none;

    &::placeholder {
      color: var(--placeholder-color);
    }
  }
}




}





</style>

