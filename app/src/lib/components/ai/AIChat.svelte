<script lang="ts">
  import {  currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
  import { onMount, afterUpdate, createEventDispatcher, onDestroy, tick } from 'svelte';
  import { get, writable, derived } from 'svelte/store';
  import { fade, fly, scale, slide } from 'svelte/transition';
  import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
  import { elasticOut, cubicIn, cubicOut } from 'svelte/easing';
  import { Send, Paperclip, Bot, Menu, Reply, Smile, Plus, X, FilePenLine, Save, Check, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Edit2, Pen, Trash, MessageCirclePlus, Search, Trash2, Users, Brain, Command, Calendar, ArrowLeft, ListTree, Box, PackagePlus, MessageCircleMore, RefreshCcw, CalendarClock, MessageSquareText, Bookmark, BookmarkMinus, BookmarkX, BookmarkCheckIcon, Quote, Filter, SquarePlay, Play, PlugZap, ZapOff, Link, Unlink, MessageSquare, MessagesSquare, TrashIcon, PlusCircle, BotIcon, Braces} from 'lucide-svelte';
  import { fetchAIResponse, handleStartPromptClick, generateScenarios, generateTasks as generateTasksAPI, createAIAgent, generateGuidance } from '$lib/clients/aiClient';
  import Headmaster from '$lib/assets/illustrations/headmaster2.png';
  import { apiKey } from '$lib/stores/apiKeyStore';
  import { pocketbaseUrl } from '$lib/pocketbase';
  import { messagesStore} from '$lib/stores/messagesStore';
  import { getRandomPrompts } from '$lib/constants/startPrompts';
	import ProjectCard from '$lib/components/common/cards/ProjectCard.svelte';
	import MsgBookmarks from '$lib/components/features/MsgBookmarks.svelte';
	import horizon100 from '$lib/assets/horizon100.svg';
  import ThreadCollaborators from '$lib/components/containers/ThreadCollaborators.svelte'
  import { updateAIAgent, ensureAuthenticated, deleteThread } from '$lib/pocketbase';
  // import PromptCatalog from './PromptCatalog.svelte';
    import PromptCatalog from './PromptInput.svelte';
    import { pendingSuggestion } from '$lib/stores/suggestionStore';

  import type { ExpandedSections, ThreadGroup, MessageState, PromptState, UIState, AIModel, ChatMessage, InternalChatMessage, Scenario, ThreadStoreState, Projects, Task, Attachment, Guidance, RoleType, PromptType, NetworkData, AIAgent, Network, Threads, Messages } from '$lib/types/types';
  import { projectStore } from '$lib/stores/projectStore';
  import { fetchProjects, resetProject, fetchThreadsForProject, updateProject, removeThreadFromProject, addThreadToProject} from '$lib/clients/projectClient';
  import { fetchMessagesForBookmark, fetchMessagesForThread, resetThread, createThread, loadThreads, threadListVisibility, updateThread, addMessageToThread } from '$lib/clients/threadsClient';
  import { threadsStore, ThreadSortOption, showThreadList } from '$lib/stores/threadsStore';
  import { t } from '$lib/stores/translationStore';
  import { promptStore } from '$lib/stores/promptStore';
  import { modelStore } from '$lib/stores/modelStore';
  import { defaultModel, availableModels } from '$lib/constants/models';
  import Reactions from '$lib/components/common/chat/Reactions.svelte';
  import { messageCountsStore, messageCounts, getCountColor} from '$lib/stores/messageCountStore';
  import { availablePrompts, getPrompt} from '$lib/constants/prompts';
  import ModelSelector from '$lib/components/ai/ModelSelector.svelte';
  import { processMarkdown, enhanceCodeBlocks } from '$lib/scripts/markdownProcessor';
	import { DateInput, DatePicker, localeFromDateFnsLocale } from 'date-picker-svelte'
	import { hy } from 'date-fns/locale'
  import { isTextareaFocused, handleTextareaFocus, handleTextareaBlur, handleImmediateTextareaBlur, adjustFontSize, resetTextareaHeight  } from '$lib/stores/textareaFocusStore';
  import { formatDate, formatContent, formatContentSync, getRelativeTime } from '$lib/utils/formatters';
  import { providers, type ProviderType } from '$lib/constants/providers';
	import ReferenceSelector from '$lib/components/features/ReferenceSelector.svelte';
  import { currentCite, availableCites, type Cite } from '$lib/stores/citeStore';
  import MessageProcessor from '$lib/contents/MessageProcessor.svelte';
	import AgentPicker from '$lib/components/overlays/AgentPicker.svelte';
  import RecursiveMessage from '$lib/components/containers/RecursiveMessage.svelte';
  import { prepareReplyContext } from '$lib/utils/handleReplyMessage';
	import SysPromptSelector from './SysPromptSelector.svelte';

  interface UserProfile {
    id: string;
    name: string;
    avatarUrl: string;
  }
  type MessageContent = string | Scenario[] | Task[] | AIAgent | NetworkData;
  
  let documentClickListener: ((e: MouseEvent) => void) | null = null;

  export let message: InternalChatMessage;
  export let seedPrompt: string = '';
  export let additionalPrompt: string = '';
  export let aiModel: AIModel = defaultModel;
  export let userId: string;
  export let attachment: File | null = null;
  export let promptType: PromptType = 'NORMAL';
  export let threadId: string | null = null;
  export let initialMessageId: string | null = null;
  // export let showThreadList = true;
  export let namingThread = true;

  let projectSubscriptionInitialized = false;
  let activeSelection = '';
  let messageProcessor;
  let isTypingInProgress = false;
  $: isTypingInProgress = chatMessages.some(msg => msg.isTyping);
  let observer: MutationObserver | null = null;
  let isUserScrolling = false;
let userScrollPosition = 0;
let scrollThreshold = 100;
let isAtBottom = true;

  let textareaElement: HTMLTextAreaElement | null = null;
  let showAgentPicker = false;
  let isUpdatingThreadName = false;
  let activeReplyMenu: {
    elementId: string;
    position: { x: number; y: number };
} | null = null;
let replyText = '';
  let lastLoadedProjectId: string | null = null;
  let isLoadingThreads = false;
  let isLoadingProject = false;
  let modelInitialized = false;
  let userProfileCache: Map<string, UserProfile | null> = new Map();
  let messageSubscription: any = null;
	let date = new Date()
	let locale = localeFromDateFnsLocale(hy)
  // let deg = 0;
  // Chat-related state
  let isUpdatingModel = false;
  let showTextModal = false;
  let textTooLong = false;
  const MAX_VISIBLE_CHARS = 200;

  let messages: Messages[] = [];
  let chatMessages: InternalChatMessage[] = [];
  let userInput: string = '';
  // Auth state
  let isAuthenticated = false;
  let name: string = 'You';
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
  let isThreadsLoaded: boolean;
  let isThreadListVisible = true;
  let isProjectListVisible = false;
  // UI state
  let isLoading = false;
  let isExpanded = false;
  let bookmarkId = '';
  
  // let isLoading: boolean = false;
  // let isTextareaFocused = false;
  let isSubmissionAreaActive = false;
  let isFocused = false;
  let hideTimeout: ReturnType<typeof setTimeout>;
  let showSysPrompt = false;
  let showPromptCatalog = false;
  let showModelSelector = false;
  let showCollaborators = false;

  let showBookmarks = false;
  let showCites = false;
  let thinkingPhrase: string = '';
  let thinkingMessageId: string | null = null;
  let typingMessageId: string | null = null;
  let isLoadingMessages = false;
  let initialLoadComplete = false;
  let defaultTextareaHeight = '60px'; 
  let selected: Date = date || new Date(); 
  let showNetworkVisualization: boolean = false;
  let isDragging = false;
  let startY: number;
  let scrollTopStart: number;
  let currentPage = 1;
  let searchQuery = '';
  let currentPlaceholder = getRandomQuestions();
  let currentManualPlaceholder = $t('chat.manualPlaceholder');
  let quotedMessage: Messages | null = null;
  let expandedDates = new Set<string>();
  let isMinimized = false;
  let lastScrollTop = 0;
  // let expandedGroups: Set<string> = new Set();
  let isCleaningUp = false;
  let selectedPromptLabel = '';
  let selectedSysPromptLabel = '';
  let selectedModelLabel = '';
  let scrollPercentage = 0;
  let threadCount = 0;
  let messageCount = 0;
  let tagCount = 0;
  let timerCount: number = 0;
  let lastActive: Date | null = null;
  let createHovered = false;
  let searchHovered = false;
    // Message state
  let chatMessagesDiv: HTMLDivElement;
  let messageIdCounter: number = 0;
  let lastMessageCount = 0;
  let latestMessageId: string | null = null;
  // Prompt state
  let promptSuggestions = getRandomPrompts(3);
  let isProcessingPromptClick = false;
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
  let previousProjectId: string | null = null; 

  let isEditingProjectName = false;
  let newProjectName = '';
  let editingProjectId: string | null = null;
  let editedProjectName = '';
  let isCreatingProject = false;
  let filteredProjects: Projects[] = [];
  let showSortOptions = false;
  let showUserFilter = false;
  let selectedSystemPrompt: string | null = null;
  let hiddenReplies: Set<string> = new Set();
    let userPromptData = null;
    let isLoadingPrompt = true;
    

  const unsubscribeFromModel = modelStore.subscribe(state => {
  // Skip if we're already in the middle of an update
  if (isUpdatingModel) return;
  
  isUpdatingModel = true;
  try {
    if (state.selectedModel) {
      // Only update if the model has actually changed
      if (!aiModel || aiModel.id !== state.selectedModel.id) {
        aiModel = state.selectedModel;
        selectedModelLabel = aiModel.name || '';
        console.log('Model updated from store:', aiModel);
      }
    } else if (!aiModel && $currentUser && modelInitialized) {
      console.log('No model in store despite initialization, using default');
      aiModel = defaultModel;
      selectedModelLabel = aiModel.name || '';
    }
  } finally {
    isUpdatingModel = false;
  }
});


export const expandedSections = writable<ExpandedSections>({
  prompts: false,
  sysprompts: false,
  models: false,
  bookmarks: false,
  cites: false,
  collaborators: false,
});
const dispatch = createEventDispatcher();
// const expandedGroups = writable<ExpandedGroups>({});

const isMobileScreen = () => window.innerWidth < 1000;
export const focusOnMount = (node: HTMLElement) => {
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
  updated: new Date().toISOString(),
  provider: 'openai',
	collectionId: '',
	collectionName: '',
};

const sourceUrls: Record<Cite, string> = {
    wiki: 'https://en.wikipedia.org/wiki/',
    quora: 'https://www.quora.com/search?q=',
    x: 'https://twitter.com/search?q=',
    google: 'https://www.google.com/search?q=',
    reddit: 'https://www.reddit.com/search/?q=',
  };

const isAiActive = writable(true);

const onTextareaFocus = () => {
  handleTextareaFocus();
  showPromptCatalog = false;
  showSysPrompt = false;
  showModelSelector = false;
  showBookmarks = false;
  showCites = false;
  showCollaborators = false;
  threadListVisibility.set(false);

  currentPlaceholder = getRandomQuote();
};

const onTextareaBlur = () => {
  handleTextareaBlur();
};

async function fetchPromptFromAPI(promptId) {
    if (!promptId) return null;
    
    try {
      // Use API endpoint instead of direct PocketBase access
      const response = await fetch(`/api/prompts/${promptId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch prompt: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching prompt from API:', error);
      return null;
    }
  }
  
  // Function to load the prompt immediately
  async function loadUserPrompt() {
    isLoadingPrompt = true;
    
    if ($currentUser?.prompt_preference) {
      userPromptData = await fetchPromptFromAPI($currentUser.prompt_preference);
      console.log('Loaded prompt data:', userPromptData);
    }
    
    isLoadingPrompt = false;
  }

function handleModelSelection(event: CustomEvent<AIModel>) {
  const selectedModel = event.detail;
  console.log('Model selected:', selectedModel);
  
  // Update the aiModel with complete provider information
  aiModel = {
    ...selectedModel,
    provider: selectedModel.provider || 'openai'
  };
  
  selectedModelLabel = aiModel.name || '';
  
  // Close model selector
  expandedSections.update(sections => ({
    ...sections,
    models: false
  }));
}
function isReplyHidden(messageId) {
  const repliesContainer = document.querySelector(`.replies-to-${messageId}`);
  return repliesContainer ? repliesContainer.classList.contains('hidden') : true;
}
function handleTextSelection() {
    const selection = window.getSelection();
    activeSelection = selection?.toString().trim() || '';
  }
  function handleSearchChange(event?: Event) {
    // If called with an event, get the value from the event target
    if (event) {
        const target = event.target as HTMLInputElement;
        searchQuery = target.value;
    }
    // Otherwise, use the current searchQuery value
    
    console.log('Search query changed:', searchQuery);
    
    // Update the threads store with the new search query
    threadsStore.setSearchQuery(searchQuery);
}
function toggleAiActive() {
  isAiActive.update(value => !value);
}
// Message handling functions
  function cancelEditing() {
    editingProjectId = null;
    editedProjectName = '';
  }


function addMessage(
 role: RoleType,
 content: string | Scenario[] | Task[], 
 parentMsgId: string | null = null,
 model: string = 'default',
): InternalChatMessage {
 messageIdCounter++;
 let messageContent = typeof content === 'string' ? content : JSON.stringify(content);
 
 if (role === 'assistant') {
   const user = get(currentUser);
   let promptParts = [];
   
   if (user?.sysprompt_preference) {
     if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(user.sysprompt_preference)) {
       promptParts.push(`System: ${user.sysprompt_preference}`);
     } else {
       promptParts.push('System: Custom');
     }
   }
   
   if (user?.prompt_preference && Array.isArray(user.prompt_preference) && user.prompt_preference.length > 0) {
     promptParts.push('User: Custom');
   }
   
   if (promptParts.length > 0) {
     messageContent = `[Prompts: ${promptParts.join(', ')}]\n${messageContent}`;
   }
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
   prompt_type: null,
   prompt_input: null,
   model: selectedModelLabel || model,
   reactions: {
     upvote: 0,
     downvote: 0,
     bookmark: [],
     highlight: [],
     question: 0
   }
 };
}
export async function handleSendMessage(message: string = userInput) {
  if (!message.trim() && chatMessages.length === 0 && !attachment) return;
  ensureAuthenticated();

  try {
    userInput = '';
    if (textareaElement) {
      resetTextareaHeight(textareaElement);
      textareaElement.blur();
      handleImmediateTextareaBlur();
    }

    if (!currentThreadId) {
      console.log('No current thread ID - creating a new thread');
      const newThread = await handleCreateNewThread();
      if (!newThread || !newThread.id) {
        console.error('Failed to create a new thread');
        return;
      }
    }

    // Ensure valid model
    if (!aiModel || !aiModel.api_type) {
      const modelState = get(modelStore);
      if (modelState.selectedModel) {
        aiModel = modelState.selectedModel;
      } else {
        const availableKeys = get(apiKey);
        const providersWithKeys = Object.keys(availableKeys).filter(p => !!availableKeys[p]);
        const validProvider = providersWithKeys.length > 0 ? providersWithKeys[0] : 'deepseek';
        aiModel = availableModels.find(m => m.provider === validProvider) || defaultModel;
        
        if ($currentUser) {
          modelStore.setSelectedModel($currentUser.id, aiModel).catch(err => {
            console.warn('Could not save fallback model:', err);
          });
        }
      }
    }
    
    if (!aiModel.provider) {
      aiModel.provider = 'deepseek';
    }

    const currentMessage = message.trim();
    const tempUserMsgId = `temp-user-${Date.now()}`;
    
    const userMessageUI = addMessage('user', currentMessage, quotedMessage?.id ?? null, aiModel.id);
    userMessageUI.tempId = tempUserMsgId;
    chatMessages = [...chatMessages, userMessageUI];

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
      prompt_type: promptType,
      tempId: tempUserMsgId 
    }, currentThreadId);

    chatMessages = chatMessages.map(msg => 
      (msg.tempId === tempUserMsgId) 
        ? { ...msg, id: userMessage.id, tempId: undefined }
        : msg
    );

    quotedMessage = null;

    if ($isAiActive) {
      const thinkingMessage = addMessage('thinking', getRandomThinkingPhrase());
      thinkingMessageId = thinkingMessage.id;
      chatMessages = [...chatMessages, thinkingMessage];

      const messagesToSend = chatMessages
        .filter(({ role, content }) => role && content && role !== 'thinking')
        .map(({ role, content }) => ({
          role,
          content: content.toString(),
          model: aiModel.api_type,
        }));

      const aiResponse = await fetchAIResponse(messagesToSend, aiModel, userId, attachment);
      
      chatMessages = chatMessages.filter(msg => msg.id !== String(thinkingMessageId));

      const tempAssistantMsgId = `temp-assistant-${Date.now()}`;
      
      // Fetch prompt input for assistant message
      const user = get(currentUser);
      let promptInput = null;
      
      if (user?.prompt_preference) {
          let promptId: string | null = null;
          
          if (Array.isArray(user.prompt_preference) && user.prompt_preference.length > 0) {
              promptId = user.prompt_preference[0];
          } else if (typeof user.prompt_preference === 'string') {
              promptId = user.prompt_preference;
          }
          
          if (promptId) {
              try {
                  const response = await fetch(`/api/prompts/${promptId}`);
                  console.log('Prompt fetch response status:', response.status);
                  console.log('Prompt fetch response ok:', response.ok);
                  
                  if (response.ok) {
                      const promptData = await response.json();
                      console.log('Prompt fetch data:', promptData);
                      promptInput = promptData.data?.prompt || promptData.prompt; 
                      console.log('Set prompt_input to:', promptInput);
                  } else {
                      console.log('Prompt fetch failed with status:', response.status);
                  }
              } catch (error) {
                  console.error('Error fetching user prompt:', error);
              }
          }
      }
      
      const assistantMessage = await messagesStore.saveMessage({
        text: aiResponse,
        type: 'robot',
        thread: currentThreadId,
        parent_msg: userMessage.id,
        prompt_type: promptType,
        prompt_input: promptInput,
        model: aiModel.api_type,
        tempId: tempAssistantMsgId
      }, currentThreadId);

      const newAssistantMessage = addMessage('assistant', '', userMessage.id);
      newAssistantMessage.tempId = tempAssistantMsgId;
      newAssistantMessage.serverId = assistantMessage.id;
      chatMessages = [...chatMessages, newAssistantMessage];
      typingMessageId = newAssistantMessage.id;

      await typeMessage(aiResponse);
      
      chatMessages = chatMessages.map(msg => 
        (msg.tempId === tempAssistantMsgId)
          ? { 
              ...msg, 
              id: assistantMessage.id,
              content: aiResponse, 
              text: aiResponse, 
              isTyping: false,
              tempId: undefined 
            }
          : msg
      );
    }

    await handleThreadNameUpdate(currentThreadId);

  } catch (error) {
    handleError(error);
  } finally {
    cleanup();
  }
}

async function replyToMessage(replyText: string, parentMessageId: string) {
    if (!replyText.trim()) return;
    ensureAuthenticated();
    
    try {
      if (!currentThreadId) {
        console.log('No current thread ID - creating a new thread');
        const newThread = await handleCreateNewThread();
        if (!newThread || !newThread.id) {
          console.error('Failed to create a new thread');
          return;
        }
      }
      
      if (!currentThreadId) {
        console.error('Still no current thread ID after attempt to create one');
        return;
      }
      
      // Ensure we have a valid model
      if (!aiModel || !aiModel.api_type) {
        console.log('No valid model selected, using fallback');
        // Use same fallback logic you have in handleSendMessage
        // (Including this logic would make this example too long)
      }
      
      // Add the user reply message to UI
      const userMessageUI = addMessage('user', replyText, parentMessageId, aiModel.id);
      chatMessages = [...chatMessages, userMessageUI];
      
      // Save the message to the database
      const userMessage = await messagesStore.saveMessage({
        text: replyText,
        type: 'human',
        thread: currentThreadId,
        parent_msg: parentMessageId,
        prompt_type: promptType
      }, currentThreadId);
      
      if ($isAiActive) {
        // Show thinking message
        const thinkingMessage = addMessage('thinking', getRandomThinkingPhrase(), userMessageUI.id);
        thinkingMessageId = thinkingMessage.id;
        chatMessages = [...chatMessages, thinkingMessage];
        
        // Prepare the context for this reply
        const { messagesToSend } = prepareReplyContext(
          replyText,
          parentMessageId,
          chatMessages,
          aiModel,
          promptType
        );
        
        const aiResponse = await fetchAIResponse(messagesToSend, aiModel, userId, attachment);
        
        chatMessages = chatMessages.filter(msg => msg.id !== String(thinkingMessageId));
        
        const assistantMessage = await messagesStore.saveMessage({
          text: aiResponse,
          type: 'robot',
          thread: currentThreadId,
          parent_msg: userMessage.id,
          prompt_type: promptType,
          model: aiModel.api_type,
        }, currentThreadId);
        
        // Add the AI response to UI
        const newAssistantMessage = addMessage('assistant', '', userMessage.id);
        chatMessages = [...chatMessages, newAssistantMessage];
        typingMessageId = newAssistantMessage.id;
        
        // Type out the message
        await typeMessage(aiResponse);
      }
      
      // Update thread name if needed
      await handleThreadNameUpdate(currentThreadId);
      
    } catch (error) {
      handleError(error);
    }
  }
  async function typeMessage(message: string) {
  const typingSpeed = 1;
  isTypingInProgress = true;
  
  // Find the typing message to make sure it exists
  const typingMessage = chatMessages.find(msg => msg.id === String(typingMessageId));
  if (!typingMessage) {
    console.error("Typing message not found:", typingMessageId);
    isTypingInProgress = false;
    return;
  }
  
  try {
    // Split message into chunks for better performance
    const messageLength = message.length;
    const chunkSize = Math.max(10, Math.floor(messageLength / 20));
    
    for (let i = chunkSize; i <= messageLength; i += chunkSize) {
      const typedMessage = message.slice(0, i);
      
      // Update message in the chatMessages array
      chatMessages = chatMessages.map(msg => 
        msg.id === String(typingMessageId) 
          ? { ...msg, content: typedMessage, text: typedMessage, isTyping: true }
          : msg
      );
      
      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, typingSpeed * chunkSize));
    }
    
    // Final update to complete the message
    chatMessages = chatMessages.map(msg => 
      msg.id === String(typingMessageId) 
        ? { 
            ...msg, 
            content: message, 
            text: message, 
            isTyping: false,
            // If the message has a serverId, use it as the ID
            id: msg.serverId || msg.id,
            serverId: undefined,
            tempId: undefined
          }
        : msg
    );
  } catch (error) {
    console.error('Error typing message:', error);
    
    // Make sure to update the message even if there's an error
    chatMessages = chatMessages.map(msg => 
      msg.id === String(typingMessageId) 
        ? { 
            ...msg, 
            content: message, 
            text: message, 
            isTyping: false,
            id: msg.serverId || msg.id,
            serverId: undefined,
            tempId: undefined
          }
        : msg
    );
  } finally {
    isTypingInProgress = false;
    
    // Scroll to the bottom after typing is complete
    if (chatMessagesDiv) {
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }
  }
}

  function processMessageContentWithReplyable(content: string, messageId: string): string {
  if (!content || typeof content !== 'string') return content || '';
  
  // Create a temporary element to process the content
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  // Add data attributes to elements that can be replied to
  const replyableElements = tempDiv.querySelectorAll('p, li, ul, ol, blockquote, pre, code, strong, em');
  replyableElements.forEach(el => {
    if (!el.id) {
      el.id = `replyable-${Math.random().toString(36).slice(2, 10)}`;
    }
    el.setAttribute('data-parent-msg', messageId);
    el.classList.add('replyable');
  });
  
  return tempDiv.innerHTML;
}
//   function getLastMessage(): Messages | null {
//     if (messages && messages.length > 0) {
//       return messages[messages.length - 1];
//     }
//     return null;
//   }

//   function getTotalMessages(): number {
//     return messages.length;
//   }
//   function mapMessageToInternal(message: Messages): InternalChatMessage {
//   const content = formatContentSync(
//     message.text,
//     message.prompt_type as PromptType || 'NORMAL',
//     message.type === 'human' ? 'user' : 'assistant'
//   );

//   return {
//     id: message.id,
//     content,
//     text: message.text,
//     role: message.type === 'human' ? 'user' : 'assistant' as RoleType,
//     collectionId: message.collectionId,
//     collectionName: message.collectionName,
//     parent_msg: message.parent_msg,
//     reactions: message.reactions,
//     prompt_type: message.prompt_type as PromptType || 'NORMAL',
//     model: message.model,
//     thread: message.thread,
//     isTyping: false,
//     isHighlighted: false,
//     user: message.user,
//     created: message.created,
//     updated: message.updated
//   };
// }


function handleReplyableClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const selection = window.getSelection();

  if (target.classList.contains('replyable') && 
      (!selection || selection.toString().length === 0)) {
    event.stopPropagation();
    
    // Close menu if clicking the same element
    if (activeReplyMenu && activeReplyMenu.elementId === target.id) {
      activeReplyMenu = null;
      return;
    }
    
    // Position the menu near the clicked element
    const rect = target.getBoundingClientRect();
    const position = {
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY
    };
    
    activeReplyMenu = {
      elementId: target.id,
      position
    };
    
    // Reset reply text
    replyText = '';
  } else if (!target.closest('.reply-menu')) {
    // Close menu if clicking outside
    activeReplyMenu = null;
  }
}
function handleReplyableDoubleClick(event: MouseEvent) {
  // Allow text selection on double-click without showing menu
  const target = event.target as HTMLElement;
  if (target.classList.contains('replyable')) {
    event.stopPropagation();
    return;
  }
}

// async function submitReply(elementId: string, text: string = '') {
//   try {
//     const element = document.getElementById(elementId);
//     if (!element) return;
    
//     const parentMsgId = element.getAttribute('data-parent-msg');
//     if (!parentMsgId) return;
    
//     // Find the parent message in the chat messages
//     const parentMessage = chatMessages.find(msg => msg.id === parentMsgId);
//     if (!parentMessage) return;
    
//     // Use the parent message's thread ID
//     const threadId = parentMessage.thread || currentThreadId;
    
//     // Get quoted element content
//     const quotedText = element.textContent?.trim() || '';
    
//     // Format the message content to include the quoted text
//     let messageContent = '';
//       if (text) {
//         // Format quoted text as a markdown blockquote
//         const formattedQuote = quotedText
//           .split('\n')
//           .map(line => `> ${line}`)
//           .join('\n');
        
//         messageContent = `${formattedQuote}\n\n${text}`;
//       } else {
//         // If no text was provided (re-prompt), just use the quoted text
//         messageContent = `Re-prompt: "${quotedText}"`;
//       }
    
//     // Close the menu
//     activeReplyMenu = null;
    
//     // Create a temporary UI message
//     const userMessageUI = addMessage('user', messageContent, parentMsgId, aiModel.id);
//     chatMessages = [...chatMessages, userMessageUI];
    
//     // Save the message using the messagesStore's saveMessage method
//     const userMessage = await messagesStore.saveMessage({
//       text: messageContent,
//       type: 'human',
//       thread: threadId, // Use the thread ID from the parent message
//       parent_msg: parentMsgId, // Set parent message ID
//       prompt_type: promptType
//     }, threadId); // Pass thread ID as second parameter
    
//     // Check if AI should respond
//     if ($isAiActive) {
//       // Show thinking indicator
//       const thinkingMessage = addMessage('thinking', getRandomThinkingPhrase(), parentMsgId);
//       thinkingMessageId = thinkingMessage.id;
//       chatMessages = [...chatMessages, thinkingMessage];
      
//       // Get context messages for this thread
//       const contextMessages = chatMessages
//         .filter(msg => msg.thread === threadId || msg.id === parentMsgId || msg.parent_msg === parentMsgId)
//         .filter(({ role, content }) => role && content)
//         .map(({ role, content }) => ({
//           role,
//           content: role === 'user' && promptType 
//             ? `[Using ${promptType} prompt]\n${content.toString()}`
//             : content.toString(),
//           model: aiModel.api_type,
//         }));
      
//       if (contextMessages.length === 0) {
//         throw new Error('No valid messages to send');
//       }
      
//       // Add prompt type if needed
//       if (promptType) {
//         contextMessages.unshift({
//           role: 'system',
//           content: `You are responding using the ${promptType} prompt. Please format your response accordingly.`,
//           model: aiModel.api_type,
//         });
//       }
      
//       // Fetch AI response
//       const aiResponse = await fetchAIResponse(contextMessages, aiModel, userId);
      
//       // Remove thinking message
//       chatMessages = chatMessages.filter(msg => msg.id !== String(thinkingMessageId));
      
//       // Save AI response
//       const assistantMessage = await messagesStore.saveMessage({
//         text: aiResponse,
//         type: 'robot',
//         thread: threadId,
//         parent_msg: userMessage.id,
//         prompt_type: promptType,
//         model: aiModel.api_type,
//       }, threadId);
      
//       // Add assistant message to UI
//       const newAssistantMessage = addMessage('assistant', '', userMessage.id);
//       chatMessages = [...chatMessages, newAssistantMessage];
//       typingMessageId = newAssistantMessage.id;
      
//       // Type the message
//       await typeMessage(aiResponse);
//     }
//   } catch (error) {
//     console.error("Message handling error:", error);
//     // Handle error (show notification, etc.)
//   }
// }

function toggleReplies(messageId) {
  console.log(`[toggleReplies] Starting to toggle replies for message ID: ${messageId}`);
  
  try {
    // Find the replies container for this message
    const repliesContainer = document.querySelector(`.replies-to-${messageId}`);
    
    if (!repliesContainer) {
      console.warn(`[toggleReplies] No replies container found for message ID: ${messageId} - this might be expected if there are no replies`);
      // Still try to update the toggle button state if it exists
      updateToggleButtonState(messageId, true); // Assume hidden state if no container
      return;
    }
    
    // Toggle the 'hidden' class on the replies container
    const isHidden = repliesContainer.classList.toggle('hidden');
    console.log(`[toggleReplies] Toggled visibility. Now hidden: ${isHidden}`);
    
    // Update toggle button state
    updateToggleButtonState(messageId, isHidden);
    
    // If we're showing messages and have a chat div to scroll
    if (!isHidden && chatMessagesDiv) {
      setTimeout(() => {
        try {
          const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
          if (messageElement) {
            const containerRect = chatMessagesDiv.getBoundingClientRect();
            const elementRect = messageElement.getBoundingClientRect();
            const scrollPosition = elementRect.top - containerRect.top + chatMessagesDiv.scrollTop;
            
            chatMessagesDiv.scrollTo({
              top: scrollPosition - 20,
              behavior: 'smooth'
            });
          }
        } catch (scrollError) {
          console.error(`[toggleReplies] Error during scroll:`, scrollError);
        }
      }, 100);
    }
  } catch (mainError) {
    console.error(`[toggleReplies] Critical error:`, mainError);
  }
}

// Helper function to update toggle button state
function updateToggleButtonState(messageId, isHidden) {
  try {
    const toggleButton = document.querySelector(
      `[data-message-id="${messageId}"] .toggle-replies-btn .toggle-icon, 
       .reply-content .toggle-replies-btn[data-parent-id="${messageId}"] .toggle-icon`
    );
    
    if (toggleButton) {
      toggleButton.textContent = isHidden ? '+' : '-';
    }
  } catch (error) {
    console.error(`[updateToggleButtonState] Error:`, error);
  }
}

  export async function loadProjectThreads(projectId?: string): Promise<void> {
    // If no project ID is provided, we're loading all threads for the user
    const isLoadingAllThreads = !projectId;
    
    // Prevent duplicate loading in quick succession
    if (isLoadingThreads) {
        console.log(isLoadingAllThreads 
            ? 'Already loading all threads, skipping request' 
            : `Already loading threads, skipping request for project ${projectId}`);
        return;
    }

    // Check if we're reloading the same project/all threads
    if (!isLoadingAllThreads && projectId === lastLoadedProjectId && get(threadsStore).project_id === projectId) {
        console.log(`Project ${projectId} threads were recently loaded, skipping duplicate request`);
        return;
    }
    
    if (isLoadingAllThreads && lastLoadedProjectId === null && get(threadsStore).project_id === null) {
        console.log('All threads were recently loaded, skipping duplicate request');
        return;
    }

    isLoadingThreads = true;
    lastLoadedProjectId = projectId || null;
    
    console.log(isLoadingAllThreads 
        ? 'Loading all threads for user' 
        : `Loading threads for project ${projectId}`);

    // Reset thread loading state
    threadsStore.update(state => ({
        ...state,
        threads: [],
        searchedThreads: [],
        isThreadsLoaded: false,
        loadingError: null
    }));

    try {
        let fetchedThreads: any[] = [];
        
        if (isLoadingAllThreads) {
            // Extract threads from all projects
            const projects = get(projectStore).threads || [];
            console.log(`Extracting threads from ${projects.length} projects`);
            
            // Get threads that are already in the threadsStore
            const existingThreads = get(threadsStore).threads || [];
            
            // Collect all unique threads from all projects
            const allThreadsMap = new Map();
            
            // First add existing threads from threadsStore if any
            if (existingThreads.length > 0) {
                console.log(`Using ${existingThreads.length} existing threads from threadsStore`);
                existingThreads.forEach(thread => {
                    if (thread.id) {
                        allThreadsMap.set(thread.id, thread);
                    }
                });
            }
            
            // Then check each project for threads
            for (const project of projects) {
                // Try to fetch project threads
                try {
                    if (project.id) {
                        const projectThreads = await fetchThreadsForProject(project.id);
                        if (projectThreads && projectThreads.length > 0) {
                            console.log(`Found ${projectThreads.length} threads for project ${project.id}`);
                            projectThreads.forEach(thread => {
                                allThreadsMap.set(thread.id, {
                                    ...thread,
                                    project_id: project.id
                                });
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`Could not fetch threads for project ${project.id}:`, err);
                }
            }
            
            // Convert map to array
            fetchedThreads = Array.from(allThreadsMap.values());
            console.log(`Collected ${fetchedThreads.length} threads in total`);
        } else {
            // Get threads for a specific project
            fetchedThreads = await fetchThreadsForProject(projectId) || [];
            console.log(`Fetched ${fetchedThreads.length} threads for project ${projectId}`);
        }

        if (!Array.isArray(fetchedThreads)) {
            throw new Error('Unexpected threads response format');
        }

        // Ensure each thread has the project_id set correctly
        const validatedThreads = fetchedThreads.map(thread => ({
            ...thread,
            project_id: thread.project_id || thread.project || projectId || null
        }));

        threadsStore.update(state => {
            // Apply the current search query if it exists
            let filteredThreads = validatedThreads;
            if (state.searchQuery) {
                filteredThreads = validatedThreads.filter(thread => 
                    thread.name?.toLowerCase().includes(state.searchQuery.toLowerCase())
                );
            }
            
            return {
                ...state,
                threads: validatedThreads, // Store all threads
                searchedThreads: filteredThreads, // Store filtered threads
                isThreadsLoaded: true,
                showThreadList: true,
                currentProjectId: projectId || null  // Set to null when loading all threads
            };
        });

        const logMessage = isLoadingAllThreads
            ? `Updated threadsStore with ${validatedThreads.length} threads for user`
            : `Updated threadsStore with ${validatedThreads.length} threads for project ${projectId}`;
        console.log(logMessage);
    } catch (error) {
        console.error(isLoadingAllThreads 
            ? 'Error loading all threads:' 
            : `Error loading project threads:`, error);
        
        threadsStore.update(state => ({
            ...state,
            loadingError: error instanceof Error ? error.message : 'Failed to load threads',
            isThreadsLoaded: true // Prevent infinite loading
        }));
    } finally {
        // Reset loading state after a delay to prevent immediate reloading
        setTimeout(() => {
            isLoadingThreads = false;
        }, 500); // 500ms cooldown before allowing another load
    }
}
async function getUserProfile(userId: string): Promise<UserProfile | null> {
  // Check if already in cache
  if (userProfileCache.has(userId)) {
    return userProfileCache.get(userId) || null;
  }
  
  try {
    // Use your API endpoint instead of direct PocketBase access
    const response = await fetch(`/api/verify/users/${userId}/public`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      userProfileCache.set(userId, null);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success || !data.user) {
      userProfileCache.set(userId, null);
      return null;
    }
    
    const userData = data.user;
    
    // Create profile object from user data
    const profile: UserProfile = {
      id: userData.id,
      name: userData.name || userData.name || 'User',
      avatarUrl: userData.avatar ? `${pocketbaseUrl}/api/files/users/${userData.id}/${userData.avatar}` : null
    };
    
    // Store in cache
    userProfileCache.set(userId, profile);
    return profile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    userProfileCache.set(userId, null);
    return null;
  }
}

async function preloadUserProfiles() {
  const userIds = new Set<string>();
  
  chatMessages.forEach(message => {
    if (message.type === 'human' && message.user) {
      userIds.add(message.user);
    }
  });
  
  const fetchPromises = Array.from(userIds).map(userId => getUserProfile(userId));
  await Promise.all(fetchPromises);
}

function handleRealTimeMessage(newMessage) {
  const existingIndex = chatMessages.findIndex(msg => msg.id === newMessage.id);
  
  if (existingIndex >= 0) {
    const updatedMessages = [...chatMessages];
    updatedMessages[existingIndex] = { ...updatedMessages[existingIndex], ...newMessage };
    chatMessages = updatedMessages; 
  } else {
    chatMessages = [...chatMessages, newMessage];
  }
}

function dedupeChatMessages() {
  const uniqueMessages = new Map();
  
  chatMessages.forEach(msg => {
    uniqueMessages.set(msg.id, msg);
  });
  
  chatMessages = Array.from(uniqueMessages.values());
}

function handleMessageUpdate(data) {
  if (data && data.record) {
    // Add the new message
    chatMessages = [...chatMessages, data.record];
    
    // Then deduplicate
    dedupeChatMessages();
  }
}

function getProviderDetails(modelString: string): { icon: string, name: string } {
    if (modelString === 'default') {
      return { icon: '', name: 'Default' };
    }
    
    const providerName = modelString.split('-')[0] as ProviderType;
    if (providers[providerName]) {
      return {
        icon: providers[providerName].icon,
        name: modelString.split('-').slice(1).join('-')
      };
    }
    
    return { icon: '', name: modelString };
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

function getRandomGreeting() {
		const quotes = $t('extras.greetings');
		return quotes[Math.floor(Math.random() * quotes.length)];
	}
  function getRandomQuestions() {
		const quotes = $t('extras.questions');
		return quotes[Math.floor(Math.random() * quotes.length)];
	}

  function getRandomQuote() {
		const quotes = $t('extras.quotes');
		return quotes[Math.floor(Math.random() * quotes.length)];
	}

function handleClickOutside() {
  window.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.btn-ai')) {
      expandedSections.set({
        prompts: false,
        sysprompts: false,
        models: false,
        bookmarks: false,
        cites: false,
        collaborators: false,
      });
    }
  });
  showSortOptions = false;
  showUserFilter = false;
}

function toggleSortOption() {
    threadsStore.toggleSortOption();
  }
  
  // Set specific sort option
  function setSortOption(sortOption: ThreadSortOption) {
    threadsStore.setSortOption(sortOption);
    showSortOptions = false;
  
}
$: threads = $threadsStore.searchedThreads;

  function toggleUserSelection(userId: string) {
    threadsStore.toggleUserSelection(userId);
  }
  
  // Clear all selected users
  function clearSelectedUsers() {
    threadsStore.clearSelectedUsers();
  }
  function getRandomThinkingPhrase(): string {
    const thinkingPhrases = $t('extras.thinking');
    if (!thinkingPhrases?.length) {
      return 'Thinking...';
    }
    return thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
  }
  /*
   * function drag(event: MouseEvent) {
   *   if (isDragging) {
   *     const deltaY = startY - event.clientY;
   *     chatMessagesDiv.scrollTop = scrollTopStart + deltaY;
   *   }
   * }
   * function stopDrag() {
   *   isDragging = false;
   *   document.removeEventListener('mousemove', drag);
   *   document.removeEventListener('mouseup', stopDrag);
   * }
   */
   function updateAvatarUrl() {
  if ($currentUser && $currentUser.avatar) {
    avatarUrl = `${pocketbaseUrl}/api/files/users/${$currentUser.id}/${$currentUser.avatar}`;
  }
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
    // Create a new state with all sections closed
    const newSections: ExpandedSections = {
      prompts: false,
      sysprompts: false,
      models: false,
      bookmarks: false,
      cites: false,
      collaborators: false,
    };
    
    // If the section was previously closed, open it
    if (!sections[section]) {
      newSections[section] = true;
      
      // Remove any existing click listener
      if (documentClickListener) {
        window.removeEventListener('click', documentClickListener);
      }
      
      // Create a new click listener
      documentClickListener = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Check if the click was outside the section content and toggle buttons
        if (!target.closest('.btn-ai') && !target.closest('.section-content') && !target.closest('.section-content-bookmark')) {
          expandedSections.set({
            prompts: false,
            models: false,
            bookmarks: false,
            cites: false,
            collaborators: false,
          });
          
          // Clean up the listener after closing panels
          if (documentClickListener) {
            window.removeEventListener('click', documentClickListener);
            documentClickListener = null;
          }
        }
      };
      
      // Add the listener after a small delay to avoid immediate triggering
      setTimeout(() => {
        window.addEventListener('click', documentClickListener!);
      }, 0);
    } else {
      // If we're closing all sections, remove the document click listener
      if (documentClickListener) {
        window.removeEventListener('click', documentClickListener);
        documentClickListener = null;
      }
    }
    
    return newSections;
  });
}
  /*
   * ASYNC
   * Message handling functions
   */

   async function handleThreadNameUpdate(threadId: string) {
  try {
    const currentMessages = await messagesStore.fetchMessages(threadId);
    if (currentMessages?.length > 0) {
      const robotMessages = currentMessages.filter(m => m.type === 'robot');
      if (robotMessages.length === 1) {
        // Store current thread state before updates
        const currentState = get(threadsStore);
        
        // Set naming state
        threadsStore.update(state => ({
          ...state,
          namingThreadId: threadId,
          isNaming: true
        }));

        try {
          // Get the thread from the store before attempting to update
          const threadToUpdate = currentState.threads.find(t => t.id === threadId);
          
          if (!threadToUpdate) {
            // If thread isn't in the store, fetch it from the API
            try {
              const response = await fetch(`/api/keys/threads/${threadId}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${get(currentUser)?.token || ''}`
                }
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data.thread) {
                  threadsStore.update(state => ({
                    ...state,
                    threads: [data.thread, ...state.threads.filter(t => t.id !== threadId)]
                  }));
                }
              }
            } catch (fetchError) {
              console.error("Failed to fetch thread:", fetchError);
            }
          }
          
          await updateThreadNameIfNeeded(threadId, currentMessages, aiModel, userId);
          
          threadsStore.update(state => ({
            ...state,
            currentThreadId: threadId
          }));
        } finally {
          threadsStore.update(state => ({
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
    threadsStore.update(state => ({
      ...state,
      namingThreadId: null,
      isNaming: false
    }));
  }
}

function getThreadedReplies(parentId, allMessages, depth = 0) {
  let result = [];
  
  // Get direct replies to this parent
  const directReplies = allMessages.filter(msg => msg.parent_msg === parentId);
  
  // Add each direct reply and its nested replies
  directReplies.forEach(reply => {
    // Add the current reply with its depth
    result.push({ ...reply, depth });
    
    // Recursively add all replies to this reply
    const nestedReplies = getThreadedReplies(reply.id, allMessages, depth + 1);
    result = [...result, ...nestedReplies];
  });
  
  return result;
}

function resetTextarea() {
  userInput = '';
  
  // Ensure DOM updates before resetting height
  setTimeout(() => {
    resetTextareaHeight(textareaElement);
  }, 0);
}

// Make sure to handle cases when clearing message and sending
$: if (userInput === '' && textareaElement) {
  resetTextareaHeight(textareaElement);
}


// Thread management functions

async function handleLoadThread(threadId: string) {
  try {
    isLoadingMessages = true;
    
    threadsStore.update(state => ({
      ...state,
      showThreadList: true
    }));

    // Ensure user is authenticated
    await ensureAuthenticated();
    const currentUserId = $currentUser?.id;
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    // Fetch thread through API endpoint
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

    const thread = threadData.thread;
    console.log('Thread loaded:', thread);

    // Get project access
    let hasProjectAccess = false;
    if (thread.project) {
      const projectId = typeof thread.project === 'string' ? thread.project : thread.project.id;
      
      try {
        const projectResponse = await fetch(`/api/projects/${projectId}/threads`, {
          method: 'GET',
          credentials: 'include'
        });

        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          if (projectData.success) {
            const project = projectData.data;
            hasProjectAccess = project.owner === currentUserId || 
              (project.collaborators && 
                (Array.isArray(project.collaborators) ? 
                  project.collaborators.includes(currentUserId) : 
                  project.collaborators.split(',').includes(currentUserId)));
          }
        }
      } catch (err) {
        console.error('Error fetching project:', err);
      }
    }

    // Verify thread ownership/access
    const isCreator = thread.user === currentUserId;
    const isOp = thread.op === currentUserId || 
                (thread.expand?.op && thread.expand.op.id === currentUserId);
    
    // Check if user is a member
    const isMember = thread.members && (
      (typeof thread.members === 'string' && thread.members.includes(currentUserId)) ||
      (Array.isArray(thread.members) && thread.members.some(m => 
        typeof m === 'string' ? m === currentUserId : m.id === currentUserId
      ))
    );

    // Allow access if user is creator, op, member, or has project access
    if (!isCreator && !isOp && !isMember && !hasProjectAccess) {
      console.error('Access denied to thread');
      throw new Error('Unauthorized thread access');
    }

    // Update stores
    await threadsStore.setCurrentThread(threadId);
    
    // Handle project context
    if (thread.project) {
      const projectId = typeof thread.project === 'string' ? thread.project : thread.project.id;
      await projectStore.setCurrentProject(projectId);
      
      try {
        const projectThreadsResponse = await fetch(`/api/projects/${projectId}/threads`, {
          method: 'GET',
          credentials: 'include'
        });

        if (projectThreadsResponse.ok) {
          const projectThreadsData = await projectThreadsResponse.json();
          if (projectThreadsData.success) {
            threadsStore.update(state => ({
              ...state,
              threads: projectThreadsData.threads
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching project threads:', err);
      }
    }

    // Update local state
    currentThreadId = thread.id;
    currentThread = thread as Threads;

    // Fetch messages with real-time updates
    try {
      const messages = await messagesStore.fetchMessages(threadId);
      
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
        prompt_type: msg.prompt_type as PromptType,
        prompt_input: msg.prompt_input,
        model: msg.model,
        collectionId: msg.collectionId || 'defaultCollectionId',
        collectionName: msg.collectionName || 'defaultCollectionName',
      }));
      
      // Set up a subscription to message store changes
      messagesStore.subscribe(state => {
        if (currentThreadId === threadId) {
          chatMessages = state.messages.map(msg => ({
            role: msg.type === 'human' ? 'user' : 'assistant',
            content: msg.text,
            id: msg.id,
            isTyping: false,
            text: msg.text,
            user: msg.user,
            created: msg.created,
            updated: msg.updated,
            parent_msg: msg.parent_msg,
            prompt_type: msg.prompt_type as PromptType || null,
            prompt_input: msg.prompt_input,
            model: msg.model,
            collectionId: msg.collectionId || 'defaultCollectionId',
            collectionName: msg.collectionName || 'defaultCollectionName',
          }));
        }
      });
    } catch (err) {
      console.error('Error loading messages:', err);
    }
    showSysPrompt = false;
    showPromptCatalog = false;
    showModelSelector = false;
    showBookmarks = false;
    showCollaborators = false;
    showCites = false;
    return thread;
  } catch (error) {
    console.error(`Error loading thread ${threadId}:`, error);
    if (error.message && error.message.includes('Unauthorized')) {
      await threadsStore.setCurrentThread(null);
      chatMessages = [];
      currentThreadId = null;
      currentThread = null;
    }
    return null;
  } finally {
    isLoadingMessages = false;
  }
}
async function handleCreateNewThread(message = '') {
 if (isCreatingThread) return null;
 
 try {
   isCreatingThread = true;
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
   };

   if (currentProjectId) {
     threadData.project = currentProjectId;
     threadData.project_id = currentProjectId;
   }

   console.log('Attempting to create thread with data:', threadData);
   
   let newThread;
   
   try {
     const response = await fetch('/api/threads', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${user.token}`
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
   
   currentThreadId = newThread.id;
   showSysPrompt = false;
   showPromptCatalog = false;
   showModelSelector = false;
   showBookmarks = false;
   showCites = false;
   showCollaborators = false;

   threadsStore.update(state => ({
     ...state,
     currentThreadId: newThread.id,
     threads: [newThread, ...state.threads]
   }));
   threadListVisibility.set(false);

   await handleLoadThread(newThread.id);
   
   if (message) {
     await handleSendMessage(message);
   }
   
   return newThread;
 } catch (error) {
   console.error('Error in handleCreateNewThread:', error);
   showNotification({
     message: 'Failed to create a new conversation',
     type: 'error',
     duration: 5000
   });
   return null;
 } finally {
   isCreatingThread = false;
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


  async function handleStartPromptSelection(promptText: string) {
  if (isProcessingPromptClick) return;
  
  try {
    isProcessingPromptClick = true;
    
    // Use the existing handleSendMessage function
    await handleSendMessage(promptText);
    
    // Refresh prompts after processing
    promptSuggestions = getRandomPrompts(3);
    
  } catch (error) {
    handleError(error);
  } finally {
    isProcessingPromptClick = false;
  }
}
function refreshPromptSuggestions() {
  promptSuggestions = getRandomPrompts(3);
}

  async function submitThreadNameChange() {
  if (currentThreadId && editedThreadName.trim() !== '') {
    try {
      isUpdatingThreadName = true;
      isEditingThreadName = false;
      
      console.log("Starting thread name update. Current name:", currentThread?.name, "New name:", editedThreadName.trim());
      
      // Update thread in PocketBase
      const updatedThread = await threadsStore.updateThread(currentThreadId, { 
        name: editedThreadName.trim() 
      });
      
      // Force a refresh of the threads array from the store
      threads = [...$threadsStore.threads];
      
      // currentThread will now be updated via the reactive statement that derives it from threads
      
      // Prevent auto-naming for this thread
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`thread_${currentThreadId}_manual_name`, 'true');
        window.localStorage.setItem(`thread_${currentThreadId}_name_timestamp`, Date.now().toString());
      }
      
    } catch (error) {
      console.error("Error updating thread name:", error);
    } finally {
      isUpdatingThreadName = false;
    }
  } else {
    isEditingThreadName = false;
  }
}
  


function getAvatarUrl(user: any): string {
	  if (!user) return '';
	  
	  // If avatarUrl is already provided (e.g., from social login)
	  if (user.avatarUrl) return user.avatarUrl;
	  
	  // For PocketBase avatars
	  if (user.avatar) {
		return `${pocketbaseUrl}/api/files/${user.collectionId || 'users'}/${user.id}/${user.avatar}`;
	  }
	  
	  // Fallback - no avatar
	  return '';
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

  function startEditingThreadName() {
  // Check if current user is the owner before allowing edits
  const isOwner = currentThread?.user === userId || currentThread?.op === userId;
  
  if (!isOwner) {
    console.log("Only the thread owner can edit the thread name");
    return; // Don't allow editing
  }
  
  isEditingThreadName = true;
  editedThreadName = currentThread?.name || '';
  
  threadsStore.update(state => ({
    ...state,
    isEditingThreadName: true,
    editedThreadName: currentThread?.name || ''
  }));
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


function enhanceWithCitations() {
    const messageElements = document.querySelectorAll('.chat-messages .message p');
    
    messageElements.forEach(element => {
      const html = element.innerHTML;
      
      // Process content to identify important terms (simple approach)
      // For a real implementation, you might want to use NLP or more sophisticated methods
      const processed = html.replace(
        /(<strong>.*?<\/strong>)|(\b[A-Z][a-z]{2,}\b)/g, 
        (match, strongTag, word) => {
          // If already in a strong tag, leave it alone
          if (strongTag) return strongTag;
          // Otherwise wrap the term in a strong tag
          return `<strong>${word}</strong>`;
        }
      );
      
      // Only update if changes were made
      if (processed !== html) {
        element.innerHTML = processed;
      }
    });
    
    // Add event listeners to strong elements
    const strongElements = document.querySelectorAll('.chat-messages .message p strong');
    
    strongElements.forEach(el => {
      const strongEl = el as HTMLElement;
      
      // Remove any existing event listeners
      const clone = strongEl.cloneNode(true);
      if (strongEl.parentNode) {
        strongEl.parentNode.replaceChild(clone, strongEl);
      }
      
      const newEl = clone as HTMLElement;
      
      // Add hover effect
      newEl.addEventListener('mouseenter', () => {
        newEl.style.cursor = 'pointer';
        newEl.style.textDecoration = 'underline';
        const text = newEl.textContent || '';
        newEl.title = `Search for "${text}" on ${$currentCite}`;
      });
      
      newEl.addEventListener('mouseleave', () => {
        newEl.style.textDecoration = 'none';
      });
      
      // Add click handler to open citation
      newEl.addEventListener('click', () => {
        const text = newEl.textContent || '';
        if (text) {
          const url = `${sourceUrls[$currentCite]}${encodeURIComponent(text)}`;
          window.open(url, '_blank');
        }
      });
    });
  }
  function setupReplyableHandlers() {
  document.querySelectorAll('.replyable').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      
      if (activeReplyMenu && activeReplyMenu.elementId === target.id) {
        activeReplyMenu = null;
        return;
      }
      
      const rect = target.getBoundingClientRect();
      const position = {
        x: Math.min(rect.left + window.scrollX, window.innerWidth - 300), // Ensure menu doesn't go off-screen
        y: Math.min(rect.bottom + window.scrollY, window.innerHeight - 200)
      };
      
      activeReplyMenu = {
        elementId: target.id,
        position
      };
      
      // Reset reply text
      replyText = '';
    });
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (activeReplyMenu && !(e.target as HTMLElement).closest('.reply-menu') && 
        !(e.target as HTMLElement).classList.contains('replyable')) {
      activeReplyMenu = null;
    }
  });
}

$: isLoading = $threadsStore.isLoading;
  $: isUpdating = $threadsStore.isUpdating;
  $: error = $threadsStore.error;
$: {
  const storeState = $threadsStore;
  if (storeState) {
    threads = storeState.threads;
    currentThreadId = storeState.currentThreadId;
    
    // Update currentThread when the store changes
    if (currentThreadId && storeState.threads) {
      const threadFromStore = storeState.threads.find(t => t.id === currentThreadId);
      if (threadFromStore && !isEditingThreadName) {
        currentThread = threadFromStore;
      }
    }
    
    messages = storeState.messages;
    updateStatus = storeState.updateStatus;
    
    if (!isEditingThreadName) {
      isEditingThreadName = storeState.isEditingThreadName;
      editedThreadName = storeState.editedThreadName;
    }
    
    namingThreadId = storeState.namingThreadId;
  }
}
// $: {
//   if (namingThreadId) {
//     if (currentThreadId === namingThreadId) {
//       currentThread = threads?.find(t => t.id === currentThreadId) || null;
//       if (currentThread) {
//         threadsStore.update(state => ({
//           ...state,
//           isEditingThreadName: false,
//           namingThreadId: null
//         }));
//       }
//     }
//   }
// }
$: {
  if (namingThreadId) {
    if (currentThreadId === namingThreadId) {
      // Check if manual naming was recently done
      const manuallyNamed = typeof window !== 'undefined' && 
        window.localStorage.getItem(`thread_${currentThreadId}_manual_name`) === 'true';
      
      const timestamp = typeof window !== 'undefined' && 
        window.localStorage.getItem(`thread_${currentThreadId}_name_timestamp`);
      
      const isRecent = timestamp && (Date.now() - parseInt(timestamp)) < 10000; // 10 seconds
      
      // Skip auto-naming if manually named recently
      if (manuallyNamed && isRecent) {
        console.log("Skipping auto-naming because thread was manually named recently");
        threadsStore.update(state => ({
          ...state,
          namingThreadId: null
        }));
      } else {
        // Only do this if not manually named
        currentThread = threads?.find(t => t.id === currentThreadId) || null;
        if (currentThread) {
          threadsStore.update(state => ({
            ...state,
            namingThreadId: null
          }));
        }
      }
    }
  }
}
$: {
    if ($threadsStore.threads) {
        // Get current project ID from either threadsStore or projectStore
        const currentProjectId = $threadsStore.project_id || $projectStore.currentProjectId;
        
        // First filter by project ID
        const projectThreads = currentProjectId
            ? $threadsStore.threads.filter(thread => thread.project_id === currentProjectId)
            : $threadsStore.threads;
        
        // Then apply search filter
        threads = searchQuery
            ? projectThreads.filter(thread => 
                thread.name?.toLowerCase().includes(searchQuery.toLowerCase()))
            : projectThreads;
        
        console.log(`Filtered to ${threads.length} threads for project ${currentProjectId || 'none'} with search "${searchQuery}"`);
    }
}

// Reactive statement to update search query in store
$: {
    if (searchQuery !== undefined) {
        threadsStore.setSearchQuery(searchQuery);
    }
}
$: isThreadListVisible = $showThreadList;
$: sortOptionInfo = threadsStore.sortOptionInfo;
$: allSortOptions = threadsStore.allSortOptions;
$: searchedThreads = threadsStore.searchedThreads;
$: selectedUserIds = threadsStore.selectedUserIds;
$: availableUsers = threadsStore.availableUsers;

projectStore.subscribe((state) => {
  if (!projectSubscriptionInitialized) {
    projectSubscriptionInitialized = true;
    currentProjectId = state.currentProjectId;
    isEditingProjectName = state.isEditingProjectName;
    editedProjectName = state.editedProjectdName;
    return;
  }
  
  const newProjectId = state.currentProjectId;
  const projectChanged = newProjectId !== previousProjectId;
  
  previousProjectId = newProjectId;
  currentProjectId = newProjectId;
  
  if (projectChanged) {
    isLoadingProject = true;
    console.log(`Project changed to ${newProjectId || 'none'}`);
    
    // Clear current threads first to avoid showing incorrect data
    threads = [];
    
    // Always load threads for the new project
    loadThreads(newProjectId)
      .then(() => {
        console.log(`Successfully loaded threads for project ${newProjectId || 'none'}`);
        // Force update threads from store after loading
        if ($threadsStore.threads) {
          threads = $threadsStore.threads.filter(thread => 
            (newProjectId ? thread.project_id === newProjectId : true) &&
            (!searchQuery || thread.name?.toLowerCase().includes(searchQuery.toLowerCase()))
          );
        }
      })
      .catch(err => console.error('Error loading threads:', err))
      .finally(() => isLoadingProject = false);
  }
  
  isEditingProjectName = state.isEditingProjectName;
  editedProjectName = state.editedProjectdName;
});
// $: {
//   if ($threadsStore.threads) {
//     // Update local threads array whenever store changes
//     threads = $threadsStore.threads.filter(thread => {
//       // Apply any filters you need here
//       if (searchQuery) {
//         return thread.name.toLowerCase().includes(searchQuery.toLowerCase());
//       }
//       return true;
//     });
//   }
// }
$: {
  if ($threadsStore.threads) {
    // Only update if we're not displaying non-project threads
    if ($projectStore.currentProjectId || threads.length === 0) {
      threads = $threadsStore.threads.filter(thread => {
        // Apply any filters you need here
        if (searchQuery) {
          return thread.name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      });
    }
  }
}
$: currentThread = threads?.find(t => t.id === currentThreadId) || null;  
// $: selectedPromptLabel = $promptStore ? availablePrompts.find(option => option.value === $promptStore)?.label || '' : '';
$: selectedIcon = $promptStore ? availablePrompts.find(option => option.value === $promptStore)?.icon : null;  
$: selectedModelName = $modelStore?.selectedModel?.name || '';  
// $: promptType = $promptStore;
$: {
  if ($expandedSections.models) {
    showModelSelector = true;
    showSysPrompt = false;
    showPromptCatalog = false;
    showBookmarks = false;
    showCites = false;
    showCollaborators = false;
  } else if ($expandedSections.collaborators) {
    showCollaborators = true;
    showSysPrompt = false;
    showPromptCatalog = false;
    showModelSelector = false;
    showBookmarks = false;
    showCites = false;
  } else if ($expandedSections.sysprompts) {
    showSysPrompt = true;
    showPromptCatalog = false;
    showModelSelector = false;
    showBookmarks = false;
    showCites = false;
    showCollaborators = false;
  } else if ($expandedSections.prompts) {
    showPromptCatalog = true;
    showSysPrompt = false;
    showModelSelector = false;
    showBookmarks = false;
    showCites = false;
    showCollaborators = false;
  } else if ($expandedSections.cites) {
    showPromptCatalog = false;
    showSysPrompt = false;
    showModelSelector = false;
    showBookmarks = false;
    showCites = true;
    showCollaborators = false;
  } else if ($expandedSections.bookmarks) {
    showPromptCatalog = false;
    showSysPrompt = false;
    showModelSelector = false;
    showBookmarks = true;
    showCites = false;
    showCollaborators = false;
  } else {
    showModelSelector = false;
    showSysPrompt = false;
    showPromptCatalog = false;
    showBookmarks = false;
    showCites = false;
    showCollaborators = false;
  }
}
$: if (seedPrompt && !hasSentSeedPrompt) {
   console.log("Processing seed prompt:", seedPrompt);
   hasSentSeedPrompt = true;
   handleSendMessage(seedPrompt);
}
$: {
  threadsStore.setSearchQuery(searchQuery);
}
$: bookmarkedMessages = derived([currentUser, messagesStore], ([$currentUser, $messages]) => {
    if ($currentUser && $currentUser.bookmarks && $messages) {
        return $messages.filter(message => $currentUser.bookmarks.includes(message.id));
    } else {
        return [];
    }
});      
$: orderedGroupedThreads = groupThreadsByDate(filteredThreads || []);
$: console.log("isLoading changed:", isLoading);
$: if ($currentUser?.avatar) {
   updateAvatarUrl();
}
$: if (date) {
        messagesStore.setSelectedDate(date.toISOString());
    }
// $: {
//     if (currentThread?.name) {
//         orderedGroupedThreads = groupThreadsByDate(
//             $threadsStore.threads.map(thread => 
//                 thread.id === currentThread?.id 
//                     ? { ...thread, name: currentThread.name }
//                     : thread
//             )
//         );
//     }
// }
$: if (chatMessages && chatMessages.length > 0) {
  dedupeChatMessages();
  preloadUserProfiles();
}
$: if ($isTextareaFocused && $showThreadList) {
  threadListVisibility.set(false);
}
onMount(async () => {
  try {
    console.log('onMount initiated');
    document.addEventListener('click', handleReplyableClick);
  
    isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.error('User is not logged in. Please log in.');
      showAuth = true;
      return;
    }
    
    if ($currentUser && $currentUser.id) {
      console.log('Current user:', $currentUser);
      updateAvatarUrl();
      name = $currentUser.name || $currentUser.email;
      loadUserPrompt();

    }
    
    if ($currentUser && $currentUser.id && !modelInitialized) {
      console.log('Initializing models for user:', $currentUser.id);
      
      try {
        await modelStore.initialize($currentUser.id);
        modelInitialized = true;
        refreshPromptSuggestions();
        
      } catch (error) {
        console.error('Error initializing models:', error);
        
        if (!aiModel || !aiModel.api_type) {
          await apiKey.loadKeys();
          const availableKeys = get(apiKey);
          const providersWithKeys = Object.keys(availableKeys)
            .filter(p => !!availableKeys[p]);
          
          const validProvider = 
            providersWithKeys.length > 0 ? 
            providersWithKeys[0] as ProviderType : 
            'deepseek';
          
          aiModel = availableModels.find(m => m.provider === validProvider) || defaultModel;
          console.log('Using fallback model after initialization error:', aiModel);
        }
      }
    }
    
    console.log('Loading initial thread data...');
    const currentProjectId = get(projectStore).currentProjectId;
    
    if (get(projectStore).threads.length === 0) {
      console.log('Loading projects first...');
      await projectStore.loadProjects();
      const suggestion = get(pendingSuggestion);
      if (suggestion) {
        handleSendMessage(suggestion);
        pendingSuggestion.set(null);
      }
    }
    
    if (currentProjectId) {
      console.log(`Project ${currentProjectId} selected, loading threads`);
      await loadThreads(currentProjectId);
    } else {
      console.log('No project selected, loading unassigned threads');
      await loadThreads(null);
    }
    
    if (currentThreadId) {
      await preloadUserProfiles();
      
      if (chatMessagesDiv) {
        enhanceCodeBlocks(chatMessagesDiv);
      }
    }
    
    if (textareaElement) {
      const adjustTextareaHeight = () => {
        console.log('Adjusting textarea height');
        if (!textareaElement) return;
        textareaElement.style.height = 'auto';
        textareaElement.style.height = `${textareaElement.scrollHeight}px`;
      };
      textareaElement.addEventListener('input', adjustTextareaHeight);
    }
    
    // Create MutationObserver to watch for changes to the chat messages
    if (chatMessagesDiv) {
      observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            if (chatMessagesDiv) { 
              const messageContents = chatMessagesDiv.querySelectorAll('.message-content:not([data-processed="true"])');
              messageContents.forEach(content => {
                enhanceCodeBlocks(content);
                content.setAttribute('data-processed', 'true');
              });
            }
            isTypingInProgress = chatMessages.some(msg => msg.isTyping);
            
            if (chatMessagesDiv) {
              const { scrollTop, scrollHeight, clientHeight } = chatMessagesDiv;
              const scrollBottom = scrollTop + clientHeight;
              if (scrollHeight - scrollBottom < 100) {
                chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
              }
            }
          }
        });
      });
      
      observer.observe(chatMessagesDiv, {
        childList: true,
        subtree: true
      });
    }
  } catch (error) {
    console.error('Error during onMount:', error);
  }
  
  // Modified typeMessage function - add this outside onMount but update your existing one
  return () => {
  document.removeEventListener('click', handleReplyableClick);
  if (observer) {
    observer.disconnect();
  }
  unsubscribe();
};
});


afterUpdate(() => {
  // Setup reply handlers
  if (!isTypingInProgress) {
    setTimeout(() => {
      setupReplyableHandlers();
    }, 100);
  }
  
  // Handle scrolling behavior when messages are added
if (chatMessagesDiv && chatMessages.length > lastMessageCount) {
    // Check if the last message is from the user
    const lastMessage = chatMessages[chatMessages.length - 1];
    const isUserMessage = lastMessage && lastMessage.role === 'user';
    
    
    lastMessageCount = chatMessages.length;
  }
});


onDestroy(() => {
  messagesStore.cleanup();
  unsubscribeFromModel();

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

// Lifecycle hooks
// onMount(() => {
// 		const interval = setInterval(() => {
// 			deg += 2;
// 			if (deg >= 360) deg = 0;
// 			document.body.style.setProperty('--deg', deg);
// 		}, 60);
// 		return () => clearInterval(interval);
// 	});

</script>

{#if $currentUser}

<div class="chat-interface" in:fly="{{ y: -200, duration: 300 }}" out:fade="{{ duration: 200 }}">
  {#if showAgentPicker}
  <!-- <AgentPicker 
    on:close={() => showAgentPicker = false}
  /> -->
{/if}
  <div class="chat-container" 
    transition:fly="{{ x: 300, duration: 300 }}" 
    class:drawer-visible={$showThreadList}
  >
  
  <img src={Headmaster} alt="Notes illustration" class="illustration" />

    {#if $showThreadList }

      <div class="drawer" transition:fly="{{ x: -300, duration: 300 }}">
        <div class="drawer-list" in:fly={{duration: 200}} out:fade={{duration: 200}}>
          <div class="drawer-toolbar" in:fade={{duration: 200}} out:fade={{duration: 200}}>
            <button 
              class="add"
              on:click={async () => {
                if (isCreatingThread) return;
                try {
                  const newThread = await handleCreateNewThread();
                  if (newThread?.id) {
                    showPromptCatalog = false;
                    showSysPrompt = false;
                    showModelSelector = false;
                    showBookmarks = false;
                    showCites = false;
                    showCollaborators = false;
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
            <!-- <button 
              class="toolbar-button"
              class:active={showSortOptions}
              on:click={() => showSortOptions = !showSortOptions}
              aria-label="Sort threads"
              title={$sortOptionInfo.label}
            >
              <svelte:component this={$sortOptionInfo.icon} size={18} />
              <span class="button-label">{$sortOptionInfo.label}</span>
            </button>
            <button 
              class="toolbar-button"
              class:active={showUserFilter || $selectedUserIds.size > 0}
              on:click={() => showUserFilter = !showUserFilter}
              aria-label="Filter by users"
              title="Filter by users"
            >
              <Filter size={18} />
              {#if $selectedUserIds.size > 0}
                <span class="filter-badge">{$selectedUserIds.size}</span>
              {/if}
            </button> -->
            <div class="drawer-input">
              <button 
                class="toolbar-button" 
                class:active={isExpanded} 
                on:click={() => {
                  isExpanded = !isExpanded;
                }}
                on:mouseenter={() => searchHovered = true}
                on:mouseleave={() => searchHovered = false}
              >
                  <Search />
                  <!-- {#if searchHovered && !isExpanded}
                    <span class="filter-badge" in:fade>
                      search
                    </span>
                  {/if} -->
              </button>
              {#if isExpanded}

              <input
                transition:slide={{ duration: 300 }}
                type="text"
                bind:value={searchQuery}
                placeholder="Search..."
                on:input={handleSearchChange}
                on:blur={() => {
                  if (!searchQuery) {
                    isExpanded = false;
                  }
                }}
                use:focusOnMount
              />
              {/if}
            </div>
          </div>
          {#if showSortOptions}
            <div 
              class="dropdown sort-dropdown"
              transition:fade={{ duration: 150 }}
            >
              {#each $allSortOptions as option}
                <button 
                  class="dropdown-item"
                  class:selected={$sortOptionInfo.value === option.value}
                  on:click={() => setSortOption(option.value)}
                >
                  <svelte:component this={option.icon} />
                  <span>{option.label}</span>
                  {#if $sortOptionInfo.value === option.value}
                    <Check  class="check-icon" />
                    
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
          {#if showUserFilter}
            <div 
              class="dropdown user-dropdown"
              transition:fade={{ duration: 150 }}
            >
              <div class="dropdown-header">
                <h3>Filter by Users</h3>
                {#if $selectedUserIds.size > 0}
                  <button 
                    class="clear-button"
                    on:click={clearSelectedUsers}
                  >
                    Clear all
                  </button>
                {/if}
              </div>
              
              {#if $availableUsers.length === 0}
                <div class="no-users">No users found</div>
              {:else}
                {#each $availableUsers as user}
                  <button 
                    class="dropdown-item"
                    class:selected={$selectedUserIds.has(user.id)}
                    on:click={() => toggleUserSelection(user.id)}
                  >
                    <span>{user.name}</span>
                    {#if $selectedUserIds.has(user.id)}
                      <Check size={16} class="check-icon" />
                    {/if}
                  </button>
                {/each}
              {/if}
            </div>
          {/if}
          {#if isLoadingProject}
            <div class="spinner-container">
              <div class="spinner"></div>
            </div>
            {:else}
          <div class="thread-filtered-results" transition:slide={{duration: 200}}>
            <!-- <div class="debug-info" style="font-size: 10px; color: gray; padding: 4px;">
              <p>Total threads: {$threadsStore.threads?.length || 0}</p>
              <p>Filtered threads: {threads.length || 0}</p>
              <p>Search query: "{searchQuery || 'None'}"</p>
            </div>
             -->
             {#if isLoadingThreads}
             <div class="spinner-container">
               <div class="spinner"></div>
             </div>
           {/if}

              {#if threads.length === 0}
              <div class="empty-state">
                <!-- No threads. Select or create project first. -->
              </div>
              {:else}
              {#each threads as thread (thread.id)}
              <button 
                class="card-container"
                class:selected={currentThreadId === thread.id}
                on:click={() => handleLoadThread(thread.id)}
              >
                <div class="card" 
                  class:active={currentThreadId === thread.id}
                  in:fade
                >
                  <div class="card-static">
                    <span class="card-title">
                      <!-- Get the most up-to-date thread name -->
                      {thread.id === currentThreadId && currentThread ? 
                        currentThread.name || 'Unnamed Thread' : 
                        thread.name || 'Unnamed Thread'}
                    </span>
                    <span class="card-time">
                      {#if thread.updated && !isNaN(new Date(thread.updated).getTime())}
                        {getRelativeTime(new Date(thread.updated))}
                      {:else}
                        {thread.created ? getRelativeTime(new Date(thread.created)) : 'No date available'}
                      {/if}
                    </span>
                    
                    <div class="card-actions" transition:fade={{duration: 300}}>
                      <button 
                        class="action-btn delete"
                        on:click|stopPropagation={(e) => handleDeleteThread(e, thread.id)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                </div>
              </button>
            {/each}
              {/if}

          </div>
          {/if}
        </div>
      </div>
    {/if}

    <div class="chat-container" in:fly="{{ x: 200, duration: 1000 }}" out:fade="{{ duration: 200 }}">

      <div class="chat-content" class:drawer-visible={$showThreadList} in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}" bind:this={chatMessagesDiv}>
        
        <!-- {#if isLoadingMessages}
          <div class="spinner-overlay">
            <div class="spinner"></div>
            <p>{$t('chat.loading')}</p>
          </div>
        {/if} -->
        <div class="chat-header" class:minimized={isMinimized} transition:slide={{duration: 300, easing: cubicOut}}>
          {#if currentThread}
            <div class="chat-header-thread">
              <!-- <button class="btn-back" on:click={goBack}>
                <ArrowLeft />
              </button> -->
              <!-- {#if isEditingThreadName}
              <input class="thread-name"
                transition:fade={{duration: 300, easing: cubicOut}}
                bind:value={editedThreadName}
                on:keydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitThreadNameChange();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    isEditingThreadName = false;
                    threadsStore.update(state => ({
                      ...state,
                      isEditingThreadName: false
                    }));
                  }
                }}
                on:blur={() => {
                  // Only submit changes if there's actual content
                  if (editedThreadName.trim() !== '') {
                    submitThreadNameChange();
                  } else {
                    isEditingThreadName = false;
                    threadsStore.update(state => ({
                      ...state,
                      isEditingThreadName: false
                    }));
                  }
                }}
                autofocus
              />
                <span class="save-button" on:click={submitThreadNameChange}>
                  <Save />
                </span>
              {:else} -->
              <!-- <span class="icon">
                  /
              </span> -->
              <!-- <div class="drawer-tab">

                <span class="icon">
                  <h3>
                    /
                  </h3>
                </span>
              </div> -->
              {#if currentThread && (currentThread.user === userId || currentThread.op === userId)}
              {#if isUpdatingThreadName}
                <div class="spinner-container">
                  <div class="spinner"></div>
                </div>
              {:else}
                <span on:click={startEditingThreadName}>
                  <div class="icon" in:fade>
                  <!-- <Quote/> -->
                  </div>
                  <h3>
                    {currentThread?.name || '(untitled)'}
                  </h3>
                </span>
              {/if}
            {:else}
              <!-- Read-only thread name for non-owners -->
              <h3>
                {currentThread?.name || '(untitled)'}
              </h3>
            {/if}
  


              <!-- {/if} -->
              {#if !isMinimized}
              {/if}
            </div>

          {:else}
            <div class="chat-placeholder"
              class:drawer-visible={$showThreadList}
            >     
              <div class="container-row">

                    <div class="dashboard-scroll"
                    class:drawer-visible={$showThreadList}
                    >
                      {#if $projectStore.currentProjectId}
                      <ProjectCard projectId={$projectStore.currentProjectId} {handleSendMessage} />
                      {:else}
                        {#if $isTextareaFocused}
                          <!-- Hide greeting when textarea is focused -->
                        {:else}
                          <span class="start" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                            <!-- <img src={horizon100} alt="Horizon100" class="logo" /> -->
                            <h3 in:slide={{duration: 200}} out:slide={{duration: 200}}>
                              {getRandomGreeting()} {name},                    
                            </h3>
                            <p>
                              {getRandomQuestions()}  
                            </p>
                          </span>
                          <span class="prompts">
                            {#each promptSuggestions as prompt}
                              <span 
                                class="prompt" 
                                on:click={() => handleStartPromptSelection(prompt)}
                                on:keydown={(e) => e.key === 'Enter' && handleStartPromptSelection(prompt)}
                                role="button"
                                tabindex="0"
                              >
                                {prompt}
                              </span>
                            {/each}
                          </span>
                          


                        {/if}
                      {/if}
                    </div>

                  

                  <div class="input-container-start" class:drawer-visible={$showThreadList} transition:slide={{duration: 100, easing: cubicOut}}>
                    <div class="ai-selector">
                      <!-- {#if $expandedSections.cites}
                      <div class="section-content" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                        <ReferenceSelector 
                          selectedText={activeSelection}
                          on:select={(e) => {
                            // Handle the cite selection if needed
                            console.log('Cite selected:', e.detail);
                          }}
                        />
                      </div>
                    {/if} -->

                    {#if $expandedSections.sysprompts}
                      <div class="section-content-sysprompts" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                        <SysPromptSelector 
                          on:select={(event) => {
                            expandedSections.update(sections => ({
                              ...sections,
                              prompts: false
                            }));
                            showSysPrompt = !showSysPrompt;
                            console.log('Parent received selection from catalog:', event.detail);
                          }}
                        />
                      </div>
                    {/if}
                      {#if $expandedSections.prompts}
                        <div class="section-content" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                          <PromptCatalog 
                            on:select={(event) => {
                              expandedSections.update(sections => ({
                                ...sections,
                                prompts: false
                              }));
                              showPromptCatalog = !showPromptCatalog;
                              console.log('Parent received selection from catalog:', event.detail);
                            }}
                          />
                        </div>
                      {/if}
                      {#if $expandedSections.models}
                        <div class="section-content" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                          <ModelSelector
                          provider="yourDefaultProvider"
                          on:select={(event) => {
                            handleModelSelection(event);
                            showModelSelector = !showModelSelector;
                            console.log('Parent received selection from catalog:', event.detail);
                          }}
                        />
                        </div>
                      {/if}
                      {#if $expandedSections.bookmarks}
                        <div class="section-content-bookmark" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                          <MsgBookmarks on:loadThread={(event) => handleLoadThread(event.detail.threadId)} />
                        </div>
                    {/if}
                    </div>
                    <div class="combo-input" in:fly={{ x: 200, duration: 300 }} out:fade={{ duration: 200 }}>
                      {#if userInput.length > MAX_VISIBLE_CHARS && !isTextareaFocused}
                        <div class="text-preview-container">
                          <button class="text-preview-btn" on:click={() => showTextModal = true}>
                            View/Edit Text ({userInput.length} chars)
                          </button>
                          <button class="text-trash-btn" on:click={() => userInput = ''}>
                            <TrashIcon size={16} />
                          </button>
                        </div>
                      {:else}
                        <textarea 
                          bind:this={textareaElement}
                          bind:value={userInput}
                          class:quote-placeholder={isTextareaFocused}
                          on:input={(e) => {
                            adjustFontSize(e.target);
                            textTooLong = e.target.value.length > MAX_VISIBLE_CHARS;
                          }}
                          on:keydown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              !isLoading && handleSendMessage();
                            }
                          }}      
                          on:focus={onTextareaFocus}
                          on:blur={() => {
                            onTextareaBlur();
                            textTooLong = userInput.length > MAX_VISIBLE_CHARS;
                          }}
                          placeholder={currentPlaceholder}
                          disabled={isLoading}
                          rows="1"
                        />
                      {/if}
                      
                      {#if $isTextareaFocused}
        
                      <div class="btn-row"
                        transition:slide
                      >
                        <div class="submission" class:visible={isTextareaFocused} >
                          {#if isTextareaFocused}
                          <!-- <span 
                            class="btn"
                            transition:slide
                            on:click={() => toggleSection('cites')}
                            >
                            <span class="icon">
                              {#if $expandedSections.cites}
                              <Unlink/>
                              {:else}
                              <Link />
                              {/if}
                            </span>
                          </span> -->
                            <span 
                              class="btn"
                              transition:slide
                              on:click={() => toggleSection('bookmarks')}
                              >
                              <span class="icon">
                                {#if $expandedSections.models}
                                <BookmarkCheckIcon/>
                                {:else}
                                <Bookmark />
                                {/if}
                              </span>
                            </span>
                            <!-- <span class="btn" 
                              transition:slide
                            >
                              <Paperclip />
                            </span> -->
                            <span 
                              class="btn"
                              transition:slide
                              on:click={() => toggleSection('prompts')}
                            >
                              <span class="icon">
                                {#if $expandedSections.prompts}
                                <Braces size={30} />
                                {:else}
                                <Braces size={20} />
                                {/if}
                              </span>
                              {#if selectedPromptLabel}
                                {#if selectedIcon}
                                    <svelte:component this={selectedIcon} color="var(--text-color)" />
                                {/if}
                              {/if}
                            </span>
                            <span 
                            class="btn model"
                            transition:slide
                            on:click={() => toggleSection('sysprompts')}
                          >
                          <span class="icon">
                            {#if $expandedSections.sysprompts}
                              <Command size={24} />
                            {:else}
                              <Command size={20} />
                            {/if}
                          </span>
                          
                          <div class="label-container">
                            {#if $currentUser?.sysprompt_preference}
                              {#if $currentUser.sysprompt_preference === 'NORMAL'}
                                <span class="prompt-label">Normal</span>
                              {:else if $currentUser.sysprompt_preference === 'CONCISE'}
                                <span class="prompt-label">Concise</span>
                              {:else if $currentUser.sysprompt_preference === 'CRITICAL'}
                                <span class="prompt-label">Critical</span>
                              {:else if $currentUser.sysprompt_preference === 'INTERVIEW'}
                                <span class="prompt-label">Interview</span>
                              {:else}
                                <span class="prompt-label">{$currentUser.sysprompt_preference}</span>
                              {/if}
                            {/if}
                          </div>
                        </span>
                            <span 
                              class="btn model"
                              transition:slide
                              on:click={() => toggleSection('models')}
                              >
                              <span class="icon">
                                {#if $expandedSections.models}
                                <Brain />
                                {:else}
                                <Brain/>
                                {/if}
                                {#if selectedModelLabel}
                                <p class="selector-lable">{selectedModelLabel}</p>
                              {/if}
                              </span>
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
                      {:else}
                      {/if}
                    </div>

                  </div>   

              </div>
            </div>
          {/if}
        </div>
        {#if currentThread}
        {#if !isTypingInProgress}
        <MessageProcessor messages={chatMessages} />
      {/if}

          <div class="chat-messages" bind:this={chatMessagesDiv} 
              transition:fly="{{ x: -300, duration: 300 }}">
              {#if isLoadingMessages}
              <div class="spinner-overlay">
                <div class="spinner"></div>
                <p>{$t('chat.loading')}</p>
              </div>
              {:else}
              {#each groupMessagesByDate(chatMessages) as { date, messages }}
              <div class="date-divider">
                {formatDate(date)}
              </div>
              
              {#each messages as message (message.id)}
              {#if !message.parent_msg || !chatMessages.some(m => m.id === message.parent_msg)}
                <RecursiveMessage
                  message={message}
                  allMessages={chatMessages}
                  {userId}
                  {currentUser}
                  name={name}
                  getUserProfile={getUserProfile}
                  getAvatarUrl={getAvatarUrl}
                  processMessageContentWithReplyable={processMessageContentWithReplyable}
                  latestMessageId={latestMessageId}
                  toggleReplies={toggleReplies}
                  hiddenReplies={hiddenReplies}
                  sendMessage={replyToMessage}
                  aiModel={aiModel}
                  promptType={promptType}
                  
                />
              {/if}
            {/each}
            {/each}
            {/if}

                          <!-- style="transform: translateY({scrollPercentage * 0.5}%);" -->
          </div>

          <div class="input-container" class:drawer-visible={$showThreadList} transition:slide={{duration: 100, easing: cubicOut}}>
            {#if $isAiActive}
            <div class="ai-selector">

              <!-- {#if $expandedSections.cites}
              <div class="section-content" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                <ReferenceSelector 
                  selectedText={activeSelection}
                  on:select={(event) => {
                    showCites = false;
                    console.log('Parent received selection from catalog:', event.detail);
                  }}
                />
              </div>
              {/if} -->
              {#if $expandedSections.collaborators}
              <div class="section-content" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                <ThreadCollaborators threadId={$threadsStore.currentThreadId}
                    on:select={(event) => {
                      expandedSections.update(sections => ({
                        ...sections,
                        prompts: false
                      }));
                      showCollaborators = !showCollaborators;
                      console.log('Parent received selection from catalog:', event.detail);
                    }}
                  />
              </div>
            {/if}
              {#if $expandedSections.sysprompts}
                <div class="section-content-sysprompts" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                  <SysPromptSelector 
                    on:select={(event) => {
                      expandedSections.update(sections => ({
                        ...sections,
                        prompts: false
                      }));
                      showSysPrompt = !showSysPrompt;
                      console.log('Parent received selection from catalog:', event.detail);
                    }}
                  />
                </div>
              {/if}
              {#if $expandedSections.prompts}
                <div class="section-content" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                  <PromptCatalog 
                    on:select={(event) => {
                      expandedSections.update(sections => ({
                        ...sections,
                        prompts: false
                      }));
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
              {#if $expandedSections.bookmarks}
                <div class="section-content-bookmark" in:slide={{duration: 200}} out:slide={{duration: 200}}>
                  <MsgBookmarks/>
                </div>
              {/if}
            </div>
            <div class="combo-input" in:fly={{ x: 200, duration: 300 }} out:fade={{ duration: 200 }}>
              {#if userInput.length > MAX_VISIBLE_CHARS && !isTextareaFocused}
                <div class="text-preview-container">
                  <button class="text-preview-btn" on:click={() => showTextModal = true}>
                    View/Edit Text ({userInput.length} chars)
                  </button>
                  <button class="text-trash-btn" on:click={() => userInput = ''}>
                    <TrashIcon size={16} />
                  </button>
                </div>
              {:else}
                <textarea 
                  bind:this={textareaElement}
                  bind:value={userInput}
                  class:quote-placeholder={isTextareaFocused}
                  on:input={(e) => {
                    adjustFontSize(e.target);
                    textTooLong = e.target.value.length > MAX_VISIBLE_CHARS;
                  }}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      !isLoading && handleSendMessage();
                    }
                  }}      
                  on:focus={onTextareaFocus}
                  on:blur={() => {
                    onTextareaBlur();
                    textTooLong = userInput.length > MAX_VISIBLE_CHARS;
                  }}
                  placeholder={currentPlaceholder}
                  disabled={isLoading}
                  rows="1"
                />
              {/if}
              
              {#if $isTextareaFocused}

              <div class="btn-row"
                transition:slide
              >
                <div class="submission" class:visible={isTextareaFocused} >
                  {#if isTextareaFocused}
                  <!-- <span 
                    class="btn"
                    transition:slide
                    on:click={() => toggleSection('cites')}
                    >
                    <span class="icon">
                      {#if $expandedSections.cites}
                      <Unlink/>
                      {:else}
                      <Link />
                      {/if}
                    </span>
                  </span> -->
                  {#if $threadsStore.currentThreadId}
                  <span 
                    class="btn" 
                    on:mouseenter={() => createHovered = true}
                    on:mouseleave={() => createHovered = false}
                    on:click={toggleAiActive}
                  >
                    {#if $isAiActive}
                      <PlugZap size="20"/>
                      {#if createHovered}
                        <span class="tooltip" in:fade>
                          {$t('tooltip.pauseAi')}
                        </span>
                      {/if}
                    {:else}
                      <ZapOff size="20"/>
                      {#if createHovered}
                        <span class="tooltip" in:fade>
                          {$t('tooltip.playAi')}
                        </span>
                      {/if}
                    {/if}
                  </span>
                  <span 
                  class="btn"
                  transition:slide
                  on:click={() => toggleSection('collaborators')}
                >
                  <span class="icon">
                    {#if $expandedSections.collaborators}
                      <Users size={30} />
                    {:else}
                      <Users size={20} />
                    {/if}
                  </span>
                  
                </span>
              
                  <!-- <button class="toggle-btn collaborators" on:click={() => toggleSection('collaborators')}
                    >
                    
                    <ThreadCollaborators threadId={$threadsStore.currentThreadId} />
              
                  </button> -->
                  <!-- <button 
                  class="toggle-btn"
                  on:click={() => showAgentPicker = !showAgentPicker}
                >
                  <BotIcon/>
                </button> -->
              
                {/if}
                    <span 
                      class="btn"
                      transition:slide
                      on:click={() => toggleSection('bookmarks')}
                      >
                      <span class="icon">
                        {#if $expandedSections.models}
                        <BookmarkCheckIcon/>
                        {:else}
                        <Bookmark />
                        {/if}
                      </span>
                    </span>
                    <!-- <span class="btn" 
                      transition:slide
                    >
                      <Paperclip />
                    </span> -->
                    <span 
                    class="btn"
                    transition:slide
                    on:click={() => toggleSection('prompts')}
                  >
                    <span class="icon">
                      {#if $expandedSections.prompts}
                      <Braces size={30} />
                      {:else}
                      <Braces size={20} />
                      {/if}
                    </span>
                    {#if selectedPromptLabel}
                      {#if selectedIcon}
                          <svelte:component this={selectedIcon} color="var(--text-color)" />
                      {/if}
                    {/if}
                  </span>
                  <span 
                  class="btn model"
                  transition:slide
                  on:click={() => toggleSection('sysprompts')}
                >
                  <span class="icon">
                    {#if $expandedSections.sysprompts}
                      <Command size={30} />
                    {:else}
                      <Command size={20} />
                    {/if}
                  </span>
                  
                  {#if $currentUser?.sysprompt_preference}
                    {#each availablePrompts as prompt}
                      {#if prompt.value === $currentUser.sysprompt_preference}
                      <p class="selector-lable"> {prompt.label}
                      </p>
                      {/if}
                    {/each}
                  {/if}
                </span>
                    <span 
                      class="btn model"
                      transition:slide
                      on:click={() => toggleSection('models')}
                      >
                      <span class="icon">
                        {#if $expandedSections.models}
                        <Brain />
                        {:else}
                        <Brain/>
                        {/if}
                        {#if selectedModelLabel}
                        <p class="selector-lable">{selectedModelLabel}</p>
                      {/if}
                      </span>
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
              {:else}
              {/if}
            </div>
          {/if}

          {#if !$isAiActive}
          <div class="combo-input-human" in:fly={{ x: 200, duration: 300 }} out:fade={{ duration: 200 }}>
            <textarea 
              bind:this={textareaElement}
              bind:value={userInput}
              class:quote-placeholder={isTextareaFocused}
              on:input={(e) => adjustFontSize(e.target)}
              on:keydown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  !isLoading && handleSendMessage();
                }
              }}      
              on:focus={onTextareaFocus}
              on:blur={onTextareaBlur}
              placeholder={currentManualPlaceholder}
              disabled={isLoading}
              rows="1"
            />
            <div class="btn-row"
              transition:slide
            >
              <div class="submission" class:visible={isTextareaFocused} >
                {#if isTextareaFocused}
                {#if $threadsStore.currentThreadId}
                <button 
                  class="toggle-btn response" 
                  on:mouseenter={() => createHovered = true}
                  on:mouseleave={() => createHovered = false}
                  on:click={toggleAiActive}
                >
                  {#if $isAiActive}
                    <PlugZap size="20"/>
                    {#if createHovered}
                      <span class="tooltip" in:fade>
                        {$t('tooltip.pauseAi')}
                      </span>
                    {/if}
                  {:else}
                    <ZapOff size="20"/>
                    {#if createHovered}
                      <span class="tooltip" in:fade>
                        {$t('tooltip.playAi')}
                      </span>
                    {/if}
                  {/if}
                </button>
                <!-- <span 
                class="btn"
                transition:slide
                on:click={() => toggleSection('collaborators')}
              >
                <span class="icon">
                  {#if $expandedSections.collaborators}
                    <Users size={30} />
                  {:else}
                    <Users size={20} />
                  {/if}
                </span>
                
              </span> -->
            
                <!-- <button class="toggle-btn collaborators" on:click={() => toggleSection('collaborators')}
                  >
                  
                  <ThreadCollaborators threadId={$threadsStore.currentThreadId} />
            
                </button> -->
                <!-- <button 
                class="toggle-btn"
                on:click={() => showAgentPicker = !showAgentPicker}
              >
                <BotIcon/>
              </button> -->
            
              {/if}
                  <!-- <span 
                    class="btn"
                    transition:slide
                    on:click={() => toggleSection('bookmarks')}
                    >
                    <span class="icon">
                      {#if $expandedSections.models}
                      <BookmarkCheckIcon/>
                      {:else}
                      <Bookmark />
                      {/if}
                    </span>
                  </span> -->
                  <span class="btn" 
                    transition:slide
                  >
                    <Paperclip />
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
          {/if}


          </div>
        {/if}
      </div>
    </div>
  </div>  
</div>
{:else}
  <p>User is not authenticated</p>
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
  .language-undefined {
  }

  table {
  margin-top: 2rem;
  margin-bottom: 2rem;
  background: var(--primary-color);
  border-radius: 2rem;
  overflow: hidden; /* Better than `auto` for rounded corners */
  border-collapse: separate; /* Needed for `border-radius` on tables */
  border-spacing: 0; /* Removes default cell spacing */
  width: 100%; /* Ensures table respects padding */
}



  th {
    // background: var(--bg-gradient-r);
    background: var(--primary-color) !important;
    text-align: left;
    font-weight: 800;
    font-size: auto;
    line-break: strict;
    color: var(--text-color);
    padding-inline-start: 1rem !important;

    border: {
      bottom: 1px solid var(--bg-color);
      right: 1px solid var(--bg-color);
    }
    // font-style: italic;
    padding: 2rem;
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
      // background: var(--bg-gradient-left);
    }
  }

  td {
    padding: 1rem;
    padding-inline-start: 1rem !important;

    border: {
      bottom: 1px solid var(--secondary-color);
      right: 1px solid var(--secondary-color);
    }
    &:first-child {
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      font-style: normal;
    }
    &:last-child {
      border: {
        right: none;
        left: none;
      }
    }
  }

  tr {
    line-height: 2;
    td {
    }
    &:last-of-type td {
      border-bottom: none;
    }
    &:nth-child(even) {
      background: var(--primary-color) !important;
    }
    &:hover {
      background: var(--bg-gradient-right);
    }
  }

  // List styles

  ul {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0;
    margin-left: 0;
    padding-inline-start: 2rem;
    margin-top: 0;
    max-width: 500px;
  list-style-type: none;
    li li {
      background: var(--bg-color);
      border: none !important;
      padding: 1rem;
    }
    li {
      padding: 1rem;
      margin-top: 0;
      margin-bottom: 0;
      transition: all 0.3s ease;
      border-left: 10px solid var(--line-color) !important;
      border: 1px solid var(--line-color);
      backdrop-filter: blur(10px);
      &:hover {
        background: var(--primary-color);
        // transform: translateX(1rem);
        cursor: pointer;
      }

    }

  }

  li {
    margin: 0;
    transform: all;
    margin: {
      block-start: 1.5rem;
      block-end: 1rem;
    }
    letter-spacing: 0.1rem;
    // border-radius: var(--radius-m);
    border-radius: 0.5rem;
    li {
      margin-inline-start: 1.5rem;
      padding-inline-start: 0;
      border-left: 10px solid var(--tertiary-color);

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
    // list-style-position: outside;
    // padding: 1rem;
    padding-inline-start: 1rem;
    margin: 1rem 0;
    // border: 1px solid var(--secondary-color);
    border-radius: 2rem;
    gap: 1rem;
    transition: all 0.3s ease;



    p {
      list-style-type:lower-alpha !important;

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
      position: relative;
      // padding: 1rem;
      margin: 0;
      // padding: 2rem;
      padding-inline-start: 1rem;
      font-size: 1.1rem;
      letter-spacing: 0.2rem;
      // line-height: 2;
      // border-top: 1px solid var(--placeholder-color);
      // border-bottom: 1px solid var(--placeholder-color);
      list-style-type:lower-alpha !important;

      // background: var(--bg-gradient-r);
      border-radius: 0;
      // border-top-left-radius: 2rem;
      // border-bottom-left-radius: 2rem;

      transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
      // border-bottom: 3px solid var(--bg-color);
      // border-bottom: 1px solid var(--placeholder-color);
      & strong {
        display: inline-block;
        width: auto !important;
      }
      &:hover {
      // transform: translateX(1rem);
      // background: var(--bg-color)
    }
      &:first-child {
        
      }
      &:nth-child(even) {
        
    }
      &:last-child {
        border-bottom: none;

      }
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
        // margin-top: 1rem;
        // margin-bottom: 0.5rem;
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
        // font-weight: 800;
        // background: var(--bg-color);
        // color: var(--tertiary-color);
        transition: all 0.3s ease;
        color: var(--text-color);
        border-radius: 1rem;
        // display: block;
        margin-bottom: 1em;

        &:hover {
          // background: var(--tertiary-color);
          // color: var(--text-color);
          // padding: 1rem;
          // font-size: 1.5rem;
          // border-radius: 2rem;
          
        }

      }
      strong + p, b + p {
    display: block;
    margin-top: 1em;
}

//       .message.assistant div div {
//   // Code block styling
//   margin: 0;
//   padding: 0;
//   // padding-inline-start: 1rem !important;
//   // border-top: 1px solid var(--secondary-color);
//   // border-bottom: 1px solid var(--secondary-color);
//       border: none !important;
//   border-radius: 1rem !important;
//   overflow-x: auto;
//   display: flex;
//   flex-direction: column;

//   &:hover {
//     // background: var(--bg-color);
//   }
// }

p div {
  display: flex !important;
  width: auto;
  flex-direction: column;
}

  // Code styles
//   .message.assistant div div pre {
//   // Code block styling
//   margin: 0;
//   padding: 1rem;
//   border-radius: 1rem !important;
//   // padding-inline-start: 1rem !important;
//   background-color: var(--primary-color) !important;
//   overflow-x: auto;
//   margin-top: 1rem !important;

// }
  pre {
    background: var(--bg-color) !important;
    border-radius: 1rem !important;
    margin-left: 1rem !important;
    margin-top: 1rem !important;
          white-space: pre-wrap;
      overflow-wrap: break-word;
      word-wrap: break-word;
    
  }
  pre.language-json {
    margin: 0;
    padding: 0;
    background: none;
  }
  pre code {
    padding: 1rem !important;
    margin-top: 1rem;
    color: var(--text-color);
    max-width: 800px !important;
    display: flex;
    font-size: 1rem;
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
      height: auto;
      font-size: 1rem;
      border-radius: 25px;
      background-color: transparent;
      justify-content: center;
      color: #818380;
      border: none;
      transition: all ease-in 0.3s;
      outline: none;

      &.thread-name {
        justify-content: center;
        font-size: 1.5rem;
      }

      
    }

//     :global(.depth-1) {
//   margin-left: 1.5rem !important;
//   max-width: calc(80% - 1.5rem) !important;
// }

// :global(.depth-2) {
//   margin-left: 3rem !important;
//   max-width: calc(80% - 3rem) !important;
// }

// :global(.depth-3), :global(.depth-4), :global(.depth-5) {
//   margin-left: 4rem !important;
//   max-width: calc(80% - 4rem) !important;
// }

// :global(.replies-container) {
//   margin-left: 1rem !important;
//   margin-top: 0.5rem !important;
//   border-left: 2px solid var(--reply-border, #ddd) !important;
//   padding-left: 0.75rem !important;
// }
  span.header-btns {
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 4rem;
      z-index: 5000;
      bottom: 2rem;
      margin-left: 2rem;
      width: auto;
      margin-right: 0;
    }
    .btn {

      display: flex;
      justify-content: center;
      align-items: center;
      // box-shadow: 2px -4px 20px 1px rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
      border: none;
      width: auto;
      &.model {
        width: auto;
        width: auto !important;
        p.selector-lable {
          display: none;
        }
        &:hover {
          width: 10rem !important;
          transform: translateX(-75%);
          p.selector-lable {
          display: flex;
        }
        }

        

      }

      &.send-btn {
        background-color: var(--tertiary-color);
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        &:hover {
        cursor: pointer;
        transform: scale(1.3);
        background: var(--bg-gradient-left);
      }
      }

    }



  span {
    display: flex;
    justify-content: left;
    align-items: center;
    color: var(--text-color);


    &.btn {
      display: flex;
      width: auto;
      border-radius: 50%;
      padding: 0.5rem;
      width: 2rem;
      height: 2rem;
      transition: all 0.3s ease;
      border: none;

      &:hover {
        cursor: pointer;
        transform: scale(1.3);
        background: var(--bg-gradient-left);
      }
    }

    &.start {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: auto !important;
      width: auto;
      margin-bottom: 0 !important;
      max-width: 800px;
      gap: 0.5rem;
      margin: 0;

      position: relative;
      transition: all 0.3s ease;
      & p {
        font-size: 1.5rem;
      }
      &:hover {
        animation: shake 2.8s ease;

      }
      & h3 {
        font-size: 2rem;
        display: flex;
        width: auto;
        max-width: 800px;
        justify-content: center !important;
        align-items: center !important;
        padding: 0 !important;
      }

      & img.logo {
        width: 3rem;
        height: 3rem;

        margin-top: auto;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    }

    &.icon {
      transition: all 0.2s ease-in-out;
      gap: 0.5rem;
      height: 36px;

      & 
      
      &.active {
        color: var(--bg-color) !important;
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
    &.model {
      display: flex;
      box-shadow:rgba(128, 128, 128, 0.8);
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      border-radius: 1rem;
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
  span.hero {
    display: flex;
    height: auto;
    width: auto;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
    position: relative;
    width: 100%;
    top: 0rem;
    margin-bottom: 1rem;
    gap: 0;
    & h3 {
      text-align: center;
      margin: 0;
      font-size: 2rem;

    }
    & p {
      text-align: right;
      font-style: italic; 
      margin: 0;
      
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
    .toggle-btn {
    &.header {
      background-color: red !important;
      width: 500px
    }
  }
    &.play {
      background: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 3rem;
      height: 3rem;
    }
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

    @keyframes shake {
      0%, 100% {
        transform: translateX(0);
      }
      10%, 30%, 50%, 70%, 90% {
        transform: translateX(-2px);
      }
      20%, 40%, 60%, 80% {
        transform: translateX(2px);
      }
      100% {
        transform: translateX(0);
      }
    }

    @keyframes scaleEffect {
      0% {
          transform: scale(1);
      }
      50% {
          transform: scale(1.5);
      }
      100% {
          transform: scale(1);
      }
  }

  @keyframes pulse {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(0.5);
    }
    100% {
        transform: scale(1);
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



  @keyframes blink-slow {
    0%, 100% { 
      opacity: 0.2; 
    }
    50% { 
      opacity: 0.7; 
    }
  }
}

// .project-section {}
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
  .logo-container {
		display: none;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		height: auto;
    width: auto;
		position: relative;
    margin-left: auto;
		margin-right: auto;
    margin-top: 1rem;
		user-select: none;
    gap: 1rem;
    h2 {
      height: auto;
      font-size: 3rem;
    }
	}
	.logo {
		width: 60px;
		height: 60px;
		padding: 0;
	}


  .chat-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    position: fixed;
    transition: all 0.3s ease-in-out;
    overflow-y: hidden;
    overflow-x: hidden;
    // /* left: 20%; */
    width: 100%;
    // background: rgba(0, 0, 0, 0.2);
    top: 0;
    left: 0;
    right: 1rem;
    padding: 0;
    padding-top: 0;
    height: 100vh;
    margin-top: 0;
    margin-left: 0;
  }


  .chat-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    // background: var(--bg-gradient);
    justify-content: flex-start;
    // align-items: center;
    width: 60vw;
    margin-left: 20vw;
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
    background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 60%);
    transition: all ease 0.3s;
  }

  .btn-row {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: auto;
    gap: 2rem;
    width: 3rem !important;
    margin-right: 1rem;
    margin-bottom: 0.5rem;
    // z-index: 8000;
    // background: var(--bg-gradient-r);
  }
  .submission {
    display: flex;
    flex-direction: column;
    gap: 1rem !important;
    margin: 0;
    padding: 0;
    width: 3rem !important;
    height: auto;
    justify-content: center;
    align-self: flex-end;
    // padding: 0.5rem;
    transition: all 0.3s ease;
  }

  .visible.submission {
    // backdrop-filter: blur(4px);
      z-index: 7000;

  }

  .avatar-container {
    width: 48px;
    height: 48px;
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
    & .btn-row {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    height: auto;
    // z-index: 8000;
    // background: var(--bg-gradient-r);
  }
  & .dashboard-scroll {
    justify-content: flex-start;
    align-items: flex-end;
    width: 100%;
    margin-bottom: 0;
  }
  & .prompts {
    display: flex;
    align-items: flex-end;
    & span.prompt {
      font-size: 0.7rem;
    }
  }
  & span.start {
    align-items: flex-end;
    & h3 {
      font-size: 1.2rem;
    }
    & p {
      font-size: 1rem;
      text-align: right;
    }


  }
  & .submission {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    height: auto;
    justify-content: flex-end;
    align-self: center;
    // padding: 0.5rem;
    transition: all 0.3s ease;
  }

    & .chat-content {
      margin-left:0;
      top: 0;
      margin-top: 0;
      
      width: 100%;
    }
    & .chat-container {
      right: 0;
      margin-right: 0;
      width: auto;
      left: 400px;
      
    }
    & .chat-header {
      right: 0;
      margin-right: 0;
      width: auto;
      left: 0;
    }
    & .chat-header-thread {
      margin-left: 0;
      left: 0;
      letter-spacing: 0;
      justify-content: center !important;
    }
    & .thread-info {
      margin-left: 0;
      margin-right: 0;
    }
  }

	.illustration {
		position: absolute;
		width: 95%;
		height: auto;
		left: 5%;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0.015;
		z-index: 0;
		pointer-events: none;
	}

  .casual-input {
    background: var(--bg-color);
    width: 100%;
    display: flex;
    position: relative;
    bottom: auto;
    top: 0;
    height: 200px;
  }
  .input-container {
    display: flex;
    flex-direction: column;
    position: relative;
    flex-grow: 0;
    width: calc(100%);    
    margin-top: 0;
    height: auto;
    right: 0;
    bottom:0;
    margin-bottom: 0;
      border: 1px solid var(--line-color);
    transition: all 0.2s ease;
      backdrop-filter: blur(10px);
      border-radius: 1rem;
    align-items: center;
    // backdrop-filter: blur(4px);
    justify-content: center;
    // background: var(--bg-gradient);
    z-index:7700;


    &::placeholder {
      color: var(--placeholder-color);
    }
    
    :global(svg) {
      color: var(--primary-color);
      stroke: var(--primary-color);
      fill: var(--tertiary-color);
    }
    &.combo-input {
      backdrop-filter: blur(1px);

    }

    & textarea {
      font-size: 1.5rem;
      // border: 1px solid var(--secondary-color);
      border: none;
      box-shadow: none;
      position: relative; 
      border-radius: var(--radius-m);
      backdrop-filter: blur(14px);
      // border-top-left-radius: var(--radius-m);
      // border-bottom-left-radius: var(--radius-m);
      // background-color: transparent;
      // margin-left: 7rem;
      // transition: 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);  
      // box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
      color: var(--text-color);
      // background: transparent;
      display: flex;
      // max-height: 400px;
      // backdrop-filter: blur(40 px);
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
      &:focus {
          // box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
      }
    }

  }

  .container-row {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    margin-top: 0;
    margin-bottom: 0;
    position: relative;
    justify-content: flex-end;
    align-items: center;
    // justify-content:space-between;
    transition: all 0.3s ease;
    gap: auto;

  }
  .input-container-start {
    display: flex;
    flex-direction: column;
    position: relative;

    width: calc(100%);    
    max-width: 1200px;
    margin-top: 0;
    height: auto;
    right: 0;
    bottom:auto;
    margin-bottom: 0;
    overflow-y: none;
    // backdrop-filter: blur(4px);
    justify-content: flex-end;
    align-items: center;
    // background: var(--bg-gradient);
    z-index: 1;
    transition: all 0.1s ease;

    & .combo-input {
        background: var(--primary-color);
        display: flex;
        justify-content: center;
        align-items: center;
        border: 1px solid var(--secondary-color);      
        border-radius: 2rem;
        width: 100%;
        height: auto;

    }

    &::placeholder {
      color: var(--placeholder-color);
    }
    
    :global(svg) {
      color: var(--primary-color);
      stroke: var(--primary-color);
      fill: var(--tertiary-color);
    }

    & textarea {
      border: none;
      box-shadow: none;
      background: var(--bg-color);
      margin-top: 1rem !important;
      // backdrop-filter: blur(14px);
      // margin-left: 7rem;
      // padding-left: 1rem;
      // box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
      color: var(--text-color);
      // background: transparent;
      display: flex;
      // backdrop-filter: blur(40px);
      font-size: 1.5rem;
      width: calc(100% - 2rem);
      border-radius: 2rem;
      background: transparent;
      // max-height: 400px;
      // margin-left: 2rem !important;
      // margin-right: 2rem !important;
      transition: all 0.5s ease;

      & :focus {
      color: white;
      // animation: pulse 10.5s infinite alternate;
      box-shadow: none;
      overflow-y: auto !important;
      transition: all 0.3s ease;

      display: flex;
      // background: var(--bg-gradient-left) !important;
          // box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);
          // border-top: 4px solid var(--secondary-color) !important;

      box-shadow: none !important;

      }
    }

  }



.combo-input {
  // width: 100vw;;
  border-radius: var(--radius-m);

  margin-bottom: 0;
  height: auto;
  width: 100%;
  margin-left: 0;
  bottom: auto;
  left: 0;
  display: flex;
  position: relative;
  align-items: flex-end;
  // background: var(--bg-color);
  flex-direction: row;
  // background: var(--bg-gradient);
  // backdrop-filter: blur(40px);
  transition:all 0.3s ease;

  & textarea {
    // max-height: 50vh;
    height: auto;
    width: 100%;
    margin: 1rem;
    margin-top: 0;
    margin-bottom: 0;
    z-index: 1000;
    // background: var(--bg-gradient-left);
  &:focus {
      // box-shadow: 0 20px -60px 0 var(--secondary-color, 0.11);
      // border-bottom: 1px solid var(--placeholder-color);
    // border-top-left-radius: 0;
    min-height: 300px;
    // background: var(--primary-color);
    // box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
        // margin: 2.5rem;
        margin-top: 0.5rem;
        margin-bottom: 0;
        // background: var(--primary-color);


  }
}
}
.combo-input-human {
  // width: 100vw;;
  border-radius: var(--radius-m);
  margin-bottom: 0;
  height: auto;
  width: 100%;
  margin-left: 0;
  bottom: auto;
  left: 0;
  display: flex;
  position: relative;
  background: transparent;
  flex-direction: column;
  // background: var(--bg-gradient);
  // backdrop-filter: blur(40px);
  transition:all 0.3s ease;
  & .btn-row {
    display: flex;
    flex-direction: row !important;
    justify-content: flex-end;
    margin-top: 0.5rem;
    width: calc(100% - 8rem) !important;

  }
  & span.btn {
    padding: auto;

  }
  & .submission {
    flex-direction: row;
    & .btn.send-btn {

      
    }
  }

  & textarea {
    // max-height: 50vh;
    height: 100px !important;
    border-radius: 4rem;
    margin: 1rem;
    margin-top: 0.5rem;
    margin-bottom: 0;
    padding-left: 2rem;
    font-style: normal;
    z-index: 1000;
    // background: var(--bg-color);

  &:focus {
      // box-shadow: 0 20px -60px 0 var(--secondary-color, 0.11);
      // border-bottom: 1px solid var(--placeholder-color);
    // border-top-left-radius: 0;
    min-height: 400px !important;
    // background: var(--primary-color);
    // box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
        margin: 2.5rem;
        margin-top: 0.5rem;
        margin-bottom: 0;
        // background: var(--primary-color);
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


.drawer-visible .chat-messages {
}


  .chat-messages {
    flex-grow: 0;
    overflow-y: auto;
    overflow-x: hidden;
    // background: var(--primary-color);
    /* padding: 10px; */
    display: flex;
    position: relative;
    left: 1rem;
    gap: 1rem;
    margin-bottom: 0;
    margin-top: 0;
    // left: 25%;
    padding: 0;

    padding-inline-start: 1rem;
    // backdrop-filter: blur(10px);
    flex-direction: column;
    align-items: stretch;
    height:86vh;
    overflow-x: hidden;
    overflow-y: none;
    scrollbar-width:2px;
    scrollbar-color: var(--secondary-color) transparent;
    scroll-behavior: smooth;
    // margin-bottom: 100px;
    // height: 100%;
    width: calc(100% - 4rem);
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
    width: auto;
		letter-spacing: 0.2rem;
    line-height: 1;
    transition: all 0.3s ease-in-out;

    & p {
      font-size: calc(0.5rem + 1vmin);
      margin: 0;
      display: flex;
      flex-direction: column;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-wrap: break-word;
      hyphens: auto;
      text-align: left;
      height: fit-content;
      line-height: 1.5;
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
      margin-left: 0;
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
      align-self: flex-start;
      // border: 1px solid var(--line-color);
      color: var(--text-color);
      // background-color: transparent;
      // border-bottom: 1px solid var(--line-color);
      height: auto;
      margin-right: 3.5rem;
      margin-left: 0;
      // border-top: 2px solid var(--line-color);
      border-left: 2px solid var(--line-color);
      border-bottom: 1px solid transparent;
      border-radius: 0;
      max-width: 1200px;
      width: calc(100% - 2rem);
      min-width: 200px;
      font-weight: 500;
      // background: var(--bg-color);
      border: {
        // top: 1px solid var(--primary-color);
        // left: 1px solid red;
      }
      // border-top-left-radius: 1rem!important;
      // box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
      // border-bottom-left-radius: 3rem !important;
      transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
      &:hover {
        cursor: pointer;
        // backdrop-filter: blur(30px);
        // box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
        background-color: var(--primary-color);
        // border: 1px solid var(--line-color);
        border-left: 2px solid var(--tertiary-color);
        // background: var(--primary-color) !important;

      }
      &:hidden {
        background-color: red;
      }
        &:nth-child(even) {
      }
    }
    
  }
  .message-header + p + div > div {
    // border-left: 3px solid #546e7a;
  margin-left: 0;
  padding-left: 12px;
  color: var(--text-color);
  // Styles for the grid container divs
  // This targets the div that contains your code examples
}

.message p blockquote,
.message p > blockquote {
  border-left: 3px solid #546e7a;
  margin-left: 0;
  padding-left: 12px;
  color: #b0bec5;
  font-style: italic;
}

/* Style for quoted text in user messages */
.message.user p > blockquote {
  background-color: rgba(84, 110, 122, 0.1);
  padding: 6px 12px;
  border-radius: 4px;
  margin-bottom: 8px;

}

/* Format the quoted prefix in messages */
.message p:has(> blockquote) + p,
.message p blockquote + p {
  margin-top: 8px;
}

// Target code blocks inside these nested divs
.message.assistant div div pre {
  // Code block styling
  margin: 0;
  padding: 10px;
  background-color: #f5f5f5 !important;
  border-radius: 4px;
  overflow-x: auto;
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
    height: 4rem;
    margin-left: 0;
    // margin-bottom: 160px;
    position: relative;
    // border-top-left-radius: var(--radius-m);
    // border-top-right-radius: var(--radius-m);
    top: 0rem;
    left: 0rem;
    right: 0;
    width: auto;
    z-index: 2000;
    // padding: 0.5rem;
    color: var(--text-color);
    text-align: left;
    transition: background-color 0.2s;
    // border-radius: var(--radius-m);
    display: flex;
    // gap: 2rem;
    flex-direction: row;
    transition: all 0.2s ease;
    // border-bottom: 1px solid var(--line-color);

    & h3 {
      margin: 0;
      margin-top: auto;
      font-size: var(--font-size-m);    
      text-align: left;
      font-weight: 600;
    &.active {
      // background: var(--primary-color) !important;
      color: var(--tertiary-color);
      font-size: var(--font-size-m);
      
    }
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      
    }
  }

  .chat-header-thread {
    width: 100%; 
    gap: auto;
    height: 2rem;
    padding: 0;
    font-size: 1.3rem;
    // border-bottom: 1px solid var(--placeholder-color);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    letter-spacing: 0.2rem;
    & .icon {
      color: var(--placeholder-color);
      margin-right: 0.5rem;
      display: flex;
      height: auto;
      width: auto;

    }

    & span {
      gap: 0.5rem;
    }
    h3 {
    // font-style: italic;
    letter-spacing: 0.25rem;
      font-size: calc(0.5rem + 1vmin);
      font-weight: 200;

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
      margin-left: 4rem;
      margin-right: 0;
      height: 40px;
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
      backdrop-filter: blur(100px);
      margin-bottom: 0;
      right: 0;
      top: 0;
      // border-radius: var(--radius-l);
  }


  button.drawer-tab {
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
      background: var(--primary-color);
      color: var(--tertiary-color);
      font-size: var(--font-size-xs);
      
    }
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      
    }
    }


    &.active {
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
    scrollbar-width: thin;
    scroll-behavior: smooth;
    overflow: {
    x: hidden;
    y: auto;
  }
  }

  .project-section {
    position: absolute;
    top: 3rem;
    left:0;
    right: 0;
  }

  .drawer-toolbar {
      margin-left: 0;
      position: relative;
      height: auto;
      width: calc(100%);
      // padding: 0.75rem 1rem;
      // border-top: 1px solid var(--line-color);

      // border-bottom: 2px solid var(--secondary-color);
      cursor: pointer;
      // box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
      color: var(--text-color);
      z-index: 1;
      text-align: left;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5rem;
      transition: all 0.2s ease;
      // border-radius: var(--radius-m);
      display: flex;
      flex-direction: row;
      left: 0;
      margin-right: 2rem;
      padding: 0.5rem;


    & input {
      width: 200px;
      z-index: 2;
    };
  }

  .toolbar-section {
    display: flex;
    gap: 0.5rem;
  }
  
  button.toolbar-button {
    display: flex;
    align-items: center;
    justify-content: center !important;
    color: var(--placeholder-color) !important;
    width:3rem !important;
    height: 3rem;
    border-radius: 1rem;
    background: var(--bg-color);
    border: 1px solid var(--border-color, #e2e8f0);
    cursor: pointer;
    transition: all 0.2s ease;

    
    &:hover {
      background-color: var(--secondary-color);
      color: var(--text-color) !important;
    }
    
    &.active {
      background-color: var(--secondary-color);
      color: var(--text-color) !important;
    }
  }
  
  .button-label {
    display: flex;
    color: var(--placeholder-color);
  }
  @media (min-width: 640px) {
    .button-label {
      display: inline;
    }
  }

  span.filter-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: auto;
    height: 1.25rem;
    color: white;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: bold;
  }
  
  .dropdown {

  }
  
  .user-dropdown {
    right: 0.5rem;
    left: auto;
  }
  
  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }
  
  .dropdown-header h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  .clear-button {
    background: transparent;
    border: none;
    color: var(--primary-color, #2563eb);
    font-size: 0.75rem;
    cursor: pointer;
  }
  
  .dropdown-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    gap: 0.5rem;
  }
  
  .dropdown-item:hover {
    background-color: var(--secondary-color);
  }
  
  .dropdown-item.selected {
    background-color: var(--tertiary-color);
  }
  
  .check-icon {
    margin-left: auto;
    color: var(--primary-color, #2563eb);
  }
  
  .no-users {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary, #64748b);
    font-size: 0.875rem;
  }
.drawer-input {
  display: flex;
  flex-direction: row;
  align-items: center;
  // padding: 0.75rem 0;
  border-radius: var(--radius-m);
  height: auto;
  width: auto;
  padding: 0;
  color: var(--bg-color);
  transition: all 0.3s ease;

  & button {
    border-radius: var(--radius-m);
    width: auto;
    border: none;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.3s ease;
    justify-content: center;
    z-index: 2000;
    // &:hover{
    //   // background: var(--secondary-color);
    //   // box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
    //   // transform: translateY(-10px);

    // }
  }

    & input {
      border: none;
      border-radius: 0;
      border-top-right-radius: 1rem;
      border-bottom-right-radius: 1rem;
      padding: 0.5rem;
      padding-left: 1rem;
      height: auto;
      outline: none;
      margin-right: 0;
      width: auto;
      color: var(--text-color);
      transition: all 0.3s ease;
      font-size: 1.5rem;
      &::placeholder {
        color: var(--placeholder-color);
      }
      
      &:focus {
        width: auto;
        right: 2rem;
        left: 4rem;
        z-index: 1;
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
    margin-left: -2rem;
    margin-top: -2rem;
    justify-content: flex-start;
    align-items: center;
    width: 100% ;
    gap: 1rem;

    &.assistant {
      margin-bottom: 0.5rem;
    }
  }

  .message-time {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--placeholder-color);
    
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

  textarea::placeholder {
    color: var(--placeholder-color);
    transition: all 0.3s ease;
    width: 100%;
    height: 100%;
    padding-top: 1rem !important;
    display: flex;
    text-align: center;

    font-size: 1.5rem;
    letter-spacing: 0.2rem;
  }

  textarea.quote-placeholder::placeholder {
    font-style: italic;
    color: var(--placeholder-color);
    opacity: 0.8;
    padding: 1rem;
    font-size: 0.8rem;
    display: flex;
    flex: 1;
    justify-content: center;
    align-items: flex-start;
    height: auto;
    // transform: translateY(50%);

  }


  textarea {
    display: flex;
    flex-direction: column;
    /* font-family: 'Merriweather', serif; */
    width: auto;
    min-height: 80px;
    /* min-height: 60px; Set a minimum height */
    /* max-height: 1200px; Set a maximum height */
    // padding: 1rem;
    text-justify: center;
    justify-content: center;
    resize: none;
    letter-spacing: 1.4px;
    background: transparent;
    border: 1px solid rgba(53, 63, 63, 0.5);   
    // border-radius: 20px;
    /* background-color: #2e3838; */
    // background-color: #020101;
    color: #818380;
    line-height: 1.4;
    height: auto;
    // max-height: 50vh;
    text-justify: center;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
    overflow: scroll;
    scrollbar-width:none;
    scrollbar-color: #21201d transparent;
    vertical-align: middle; /* Align text vertically */
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    margin-left: 1rem;
    margin-top: 1rem;
    &:focus {
      /* margin-right: 5rem; */
      outline: none;
      // border: 2px solid #000000;
      transform: translateY(0) rotate(0deg); 
      /* height: 400px; */
      display: flex;
      /* min-height: 200px; */
      
    }
  }

  // .auth-overlay {
  //   position: fixed;
  //   top: 0;
  //   left: 0;
  //   width: 100%;
  //   height: 100%;
  //   background-color: rgba(0, 0, 0, 0.5);
  //   display: flex;
  //   justify-content: center;
  //   align-items: center;
  //   z-index: 1000;
  // }





.message-count {
  color: var(--placeholder-color);
}

.chat-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  border-radius: var(--radius-m);
  // background: var(--primary-color);
  transition: all 0.3s ease;
  margin-left: 1rem;
  margin-right: 1rem;

  margin-top: 0;
  height: calc(100vh - 2rem);
  user-select: none;
  scrollbar-width:thin;
  scrollbar-color: var(--secondary-color) transparent;
  scroll-behavior: smooth;
  width: 100%;



  & h3 {
      font-size: 50px;
      user-select: none;

      &:hover {
      // transform: scale(1.1);
      // animation: scaleEffect 1.3s ease-in-out;
      background: none;

      }
      &:active {
        color: var(--bg-gradient-left); 
        transition: all 0.3s ease-in-out;
        transform: scale(1.3) skewX(30px);
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3); 
        filter: blur(2px);
        filter: hue-rotate(1deg) drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5));
    }
  }
  & p {
    padding: 0.5rem;
    white-space: pre-wrap;
      overflow-wrap: break-word;
      word-wrap: break-word;
      hyphens: auto;
      text-align: left;
    }
  
}


.chat-placeholder img {
  width: 100%;
  transform: translateX(25%) translateY(-20%);
}

.dashboard-items {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  transition: all 0.3s ease;
  position: relative;
  // border-top: 1px solid var(--secondary-color);
  left: 0;
  top: 3rem;
  right: 0;
  gap: 0.5rem;
  width: 100%;
  height: auto;
  overflow: none;
  margin-bottom: auto;
  margin-top: 0;
}

.dashboard-scroll {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: all 0.3s ease;
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
  // overflow-y: scroll !important;
  overflow: hidden !important;
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
  display: flex;
  margin: 0;
  padding: 0;
  font-size: 0.7rem;
  font-style: italic;;
  font-weight: normal;
  text-align: left;
  display: flex;
  user-select: none;

  // margin-left: 0.5rem;
}



p.selector-lable {
    margin: 0 !important;
    padding: 0 !important;
    width: auto;
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
    font-size: calc(0.5rem + 1vmin);

    // font-size: var( --font-size-s);
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
    margin-left: 0;
  }




  button.action-btn {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    color: transparent;
    width: 40px;
    height: 40px;
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
    justify-content: flex-start;
    width:auto;
    margin-left: 0;
    margin-right: 0;
    margin-top: 0;
    top: 0;
    margin-bottom: 2rem;
    bottom: 0;
    left: 0;
    width: 100%;
    height: fit-content;
    // backdrop-filter: blur(20px);
    border-radius: 10px;
    overflow-y: hidden;
    overflow-x: hidden;
    scrollbar-width:thin;
    scrollbar-color: var(--bg-color) transparent;
    scroll-behavior: smooth;

  }
  .drawer {
  display: flex;
  flex-direction: column;
  justify-content: auto;
  align-items: center;
  // background: var(--bg-gradient-right);
  // z-index: 11;
  overflow: {
    x: hidden;
    y: auto;
  }
  position: relative;
  top: 4rem;
  bottom: 0;
  left: 3rem;
  margin-left: 0;
  height: 100vh;
  width: calc(400px - 4rem);
  transition: all 0.3s ease-in-out;
  scrollbar: {
    width: 1px;
    color: var(--bg-color) transparent;
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
    width: fit-content;
    backdrop-filter: blur(10px);
    // background: var(--primary-color);
    border-top-right-radius: var(--radius-l);
    border-bottom-right-radius: var(--radius-l);
    

    // box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

  }


  .card-container {
    display: flex;
    flex-direction: row;
    position: relative;
    width: 100%;
    margin-left: 0;
    box-shadow: 0 1px 1px var(--secondary-color);
    min-height: 5rem;
    border-top-right-radius: var(--radius-m);
    border-bottom-right-radius: 0 !important;
    border-bottom-left-radius: var(--radius-m);
    margin-right: 0;
    padding: 0;
    cursor: pointer;
  }
  button.card-container {
    display: flex;
    flex-direction: column;
    position: relative;
    flex-grow: 1;
    padding: 1rem;
    // background-color: var(--bg-color);
    width: 100%;
    // box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.1s ease-in-out;
    &:hover {
      box-shadow: none;
      background: var(--secondary-color) !important;

        // background: rgba(226, 226, 226, 0.2);  /* Very subtle white for the glass effect */
        opacity: 1;
        visibility: visible;
        // box-shadow: -5px -1px 5px 4px rgba(255, 255, 255, 0.2);
      }
      &.selected {
        backdrop-filter: blur(30px);
        background: var(--primary-color);
        border-radius: 2rem;
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
    height: 40px;
    display: flex;
    transform: translateX(100%);
    backdrop-filter: blur(100px);
    background: var(--bg-color);
    width: auto;
    border-radius: var(--radius-m);
    opacity: 0;
    transition: all 0.2s ease;
    visibility: hidden;
  }

  .card-container:hover .card-actions {
    transform: translateX(0);
    opacity: 1;
    visibility: visible;
  }
  .card-container:hover .card-time {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
    height: auto;
  }
  .card-time {
    font-size: var(--font-size-xs);
    display: flex;
    transform: translateY(-100%);
    margin-top: 1rem;
    width: auto;
    opacity: 0;
    height: 100%;
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
    // box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
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

  .message.typing::after {
    content: '▋';
    display: inline-block;
    vertical-align: bottom;
    animation: blink 0.7s infinite;
  }




.drawer-visible .replies-container {
  max-height: 0;
  overflow: hidden;
  border: 1px solid transparent;
  padding: 0;
}




.replies-container.hidden {
  max-height: 0;
  overflow: hidden;
  border: 1px solid transparent;
  padding: 0;
  background: transparent;
  display: none;


}
.collapse-replies-btn {
  display: block;
  margin: 0.5rem 0;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  background-color: transparent;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.toggle-icon {
  margin-left: 0.25rem;
  font-size: auto;
  background: var(--primary-color);
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  border: 2px solid var(--bg-color);
}

/* Make sure hidden replies are actually hidden */
.replies-container.hidden {
  display: none;
}
.reply-message {
  display: flex;
  margin-left: 0;
  padding: 1rem;
  padding-bottom: 0rem;

  &.assistant {
    &.assistant + div {
    padding-left: 1rem; 
    margin-left: 0;


    & .reply-content {
      border: 1px solid transparent ;
      border-left: 1px solid var(--line-color);


    }
  }
}

  &.user {
    border-left: 1px solid var(--line-color);
    margin-left: 2rem;
    &.user + div {
      margin-left: 2rem;
      border-left: 1px solid var(--line-color);
  }


    & .reply-content {
      border: 1px solid transparent;
      border-left: 1px solid var(--line-color);


    }
  }



}
.reply-message[data-depth="1"] { margin-left: 20px; }
.reply-message[data-depth="2"] { margin-left: 40px; }
.reply-message[data-depth="3"] { margin-left: 60px; }
.reply-message[data-depth="4"] { margin-left: 80px; }
.reply-message[data-depth="5"] { margin-left: 100px; }

.reply-indicator {
  border-left: 2px solid var(--line-color);
  margin-right: 12px;
}

.reply-content {
  border-radius: 0;
  margin-left: 1rem;
  margin-top: 1rem;
  border-left: 1px solid var(--line-color);
  backdrop-filter: blur(30px);
  // background-color: #2a2a2a;
  // background: var(--bg-gradient-r);
  backdrop-filter: blur(8px);
  flex-grow: 1;
  padding: 8px 12px;

}



.replies-indicator {
  display: flex;
  gap: 0.5rem;
  border-radius: 1rem;
  align-items: center;
  font-size: 1.2rem;
  padding: 0.5rem;
  transition: all 0.3s ease-in-out;
  & p {
    flex-direction: row;
    justify-content: center;
    align-items: center;
    width: auto;
    gap: 0;
    // display: none;
  }
  &:hover {

    & h3 {
      display: flex;
    }
  }
}

.reply-menu {
  background-color: #2a2a2a;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 10px;
  width: 280px;
  z-index: 1000;
}

.reply-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reply-option {
  background-color: #3a3a3a;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  transition: background-color 0.2s ease;
}

.reply-option:hover {
  background-color: #4a4a4a;
}

.reply-input-container {
  display: flex;
  gap: 8px;
}

.reply-input-container textarea {
  background-color: #3a3a3a;
  border: none;
  border-radius: 6px;
  color: white;
  flex-grow: 1;
  padding: 8px;
  resize: none;
}

.send-reply {
  background-color: #1976d2;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  transition: background-color 0.2s ease;
}

.send-reply:hover {
  background-color: #1565c0;
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
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05rem;
  padding: 0.25rem 1rem;
  margin: {
    top: 0;
    bottom: 1rem;
    left: calc(50% - 100px);

  }
  gap: 2rem;
  cursor: pointer;
  background: transparent;
  transition: all ease 0.15s;
  color: var(--line-color);
  user-select: none;
  border-radius: var(--radius-m);
  z-index: 1;

  &:hover {
    background: var(--secondary-color) !important;
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



  .illustration {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    width:100%;
    height: auto;
    left: 0%;
    top: 60%;
    transform: translateY(-50%);
    opacity: 0.025;
    // z-index: 1;
    pointer-events: none;
    backdrop-filter: blur(20px);
  }
  
  .spinner-overlay {
    position: relative;
    height: 100vh !important;
    width: 100%;
    margin: 0 !important;
    padding: 0 !important;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: white;
    margin-bottom: 0;
    backdrop-filter: blur(20px) !important;
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
  .section-content-sysprompts {
    // width: calc(50% - 1rem);
    // margin-left: calc(50% - 1rem);
    width: 100% !important;

    height: auto;
    display: flex;
    margin-right: 0;
    position: relative;
    right: 0;
    justify-content: flex-end;
  }
  .section-content-collaborators {
    width: 100%;
    height: 50vh;
    overflow: hidden;
    padding: 0.5rem 1rem;
    // background: var(--bg-gradient-left);
    // border-radius: var(--radius-m);
  }

  .section-content-bookmark {
    width: 100%;
    height: 50vh;
    overflow: hidden;
    padding: 0.5rem 1rem;
    // background: var(--bg-gradient-left);
    // border-radius: var(--radius-m);
  }

  .section-content2 {
    width: 100%;
    overflow: hidden;
    padding: 0.5rem 1rem;
    // background: var(--bg-gradient-left);
    // border-radius: var(--radius-m);
  }


  .section-content {
    width: calc(100% - 2rem);
    display: flex;
    justify-content: center;
    align-items: flex-start;
      bottom:0;
      max-height: 500px;

    // margin-right: 0;

    left: 0;
    right: 0;
    height: auto;
    position: relative;
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
    justify-content:center;
    // padding-left: 3rem;
    width: 100%;
    margin-left: 0;
    z-index: 9000;
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
    .input-container-start {
      margin-top: 0;
      bottom: 0;
      // position: fixed;
    }
    .input-container-start {
    display: flex;
    flex-direction: column;
    position: relative;

    width: calc(100%);    
    max-width: 1200px;
    margin-top: 0;
    height: auto;
    right: 0;

    margin-bottom: 0;
    overflow-y: none;
    // backdrop-filter: blur(4px);
    justify-content: flex-start;
    align-items: flex-end;
    // background: var(--bg-gradient);
    z-index: 1;

    & .combo-input {
      background: transparent;
        // background: var(--primary-color);
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;
        border: 1px solid var(--secondary-color);      
        border-radius: 2rem;
        bottom: 0;
        width: calc(100% - 2rem);
        height: auto;
        padding-inline-start: 2rem;
        backdrop-filter: blur(10px);

        & textarea {
          padding-inline-start: 3.5rem;
          max-height: 200px;
          font-size: 1rem !important;
          padding: 2rem;
          &::placeholder {
            color: var(--placeholder-color);
            font-size: 0.65rem !important;
          }
          &:focus {
            padding-inline-start: 4rem;
            height: auto !important;
            padding: 0;

          }
        }

    }
  .section-content-sysprompts {
    // width: calc(50% - 1rem);
    // margin-left: calc(50% - 1rem);
    width: 100% !important;
    max-width: 1200px;
    height: auto;
    display: flex;
    margin-right: 0;
    position: relative;
    bottom: 4rem;
    right: 0;
    justify-content: flex-end;
  }
    
    :global(svg) {
      color: var(--primary-color);
      stroke: var(--primary-color);
      fill: var(--tertiary-color);
    }

    & textarea {
      border: none;
      box-shadow: none;
      transition: all 0.3s ease;
      background: var(--bg-color);
      margin-top: 0 !important;
      padding: 0;
      margin: 0;
      // backdrop-filter: blur(14px);
      // margin-left: 7rem;
      // padding-left: 1rem;
      // box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
      color: var(--text-color);
      // background: transparent;
      display: flex;
      // backdrop-filter: blur(40px);
      font-size: 1.5rem;
      width: 100%;
      border-radius: 0;
      background: transparent;
      // max-height: 400px;
      // margin-left: 2rem !important;
      // margin-right: 2rem !important;

      // & :focus {
      // color: white;
      // animation: none;
      // box-shadow: none;
      // overflow-y: auto !important;
      // transition: all 0.3s ease;
      // display: flex;
      // // background: var(--bg-gradient-left) !important;
      //     // box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);
      //     // border-top: 4px solid var(--secondary-color) !important;

      // box-shadow: none !important;

      // }
    }

  }

    .btn-row {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-top: 0;
    padding-top: 0;
    padding-bottom: 0;
    justify-content: flex-end;
    align-items: flex-end;
    gap: 0;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    height: auto;
    // z-index: 8000;
    // background: var(--bg-gradient-r);
  }
  .submission {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: auto;
    height: auto;
    justify-content: flex-end;
    align-self: flex-end;
    // padding: 0.5rem;
    transition: all 0.3s ease;
  }

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
.container-row {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    top: 0 !important;
    margin-top: 0 !important;
    width: 100% !important;
    margin-top: 0;
    margin-bottom: 0;
    // justify-content:space-between;
    transition: all 0.3s ease;
    gap: 0rem;

  }

.selector-lable {
  display: none;


}

.chat-header-thread {
  width: auto !important;
  margin-left: 0 !important;
  text-align: center;
  align-items: center !important;
  justify-content: center !important;
  left: 0;
  height: auto !important;
  margin-right: 0;
  margin-top: 0 !important;
  flex-grow: 1;
  h3 {
    line-height: 1.2;
    font-size: 0.8rem !important;
    letter-spacing: 0 !important;
    font-weight: 800 !important;
    color: var(--placeholder-color);

    display: flex;
  }
}

.chat-header {
  left: 0 !important;
  position: absolute;
  width: auto !important;
  border-bottom: none;
  // justify-content: space-between;
  // background: var(--bg-color);
  box-shadow: none;
  backdrop-filter: none;
  top: 0.5rem !important;
  padding: 0 !important;
  & .chat-header-thread {

    height: 2rem !important;
    padding: 0 !important;
  }

}


.btn-col-left:hover {
  width: 96%;
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

    .message.user {
      display: flex;
      flex-direction: column;
      align-self: center;
      color: var(--text-color);
      background-color: transparent;
      border-radius: var(--radius-m);
      height: auto;
      margin-right: 0;
      width: 100%;
      font-weight: 500;
      // background: var(--bg-color);
      border: {
        // top: 1px solid var(--primary-color);
        // left: 1px solid red;
      }
    }
    
  span.hero {
    margin-top: 0;
    top: auto;
    align-items: flex-end;
    margin-right: 2rem;
    & h3 {
      display: none;
    }
    & p {
      display: none;
    }
  }

  .dashboard-items {
    display: flex;
    flex-direction: row;
    height: auto;
    justify-content: center;
    align-items: flex-start;
    position: relative;
    // border-top: 1px solid var(--secondary-color);
    padding-inline-start: 2rem;
    left: 0;
    right: 0;
    padding: 0;
    background: red;
    gap: 1rem;
    width: 100%;
    margin-bottom: auto;
    margin-top: 0;
  }


      
    .thread-filtered-results {
      margin-bottom: 0rem;
    }
    .chat-content {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      // background: var(--bg-gradient);
      justify-content: flex-start;
      // align-items: center;
      width: calc(100%) !important;
      margin-left: 0 !important;
      height: auto;
      margin-top: 0;
      margin-right: 1rem !important;
      height: auto;
      // width: 50%;
      // margin: 0 1rem;
      // margin-left: 25%;
      // padding: 0 10px;
      overflow-y: hidden;
      overflow-x: hidden;
      background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 60%);
      transition: all ease 0.3s;
    }

    .chat-messages {
      width: auto;
      margin-right: 0;
      margin-left: 0rem;
      right: 0;
      left: 0;
      padding-inline-start: 1rem;
      top: 3rem;
      z-index: 0;
    }

    .drawer-header {
      width:auto;
      margin-bottom: 4rem;
      left: 4rem;
      right: 4rem;
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
      margin-bottom: 1rem;
      left: 0;
      right: 0;
      margin-top: 0;
      margin-right: 0;
      margin-left: 0;     
      display: flex;
      position: relative;
      height: auto;
      border: none;
      cursor: pointer;
      color: var(--text-color);
      border-bottom: 1px solid var(--line-color);
      text-align: left;
      display: flex;
      gap: auto;
      align-items: center;
      transition: background-color 0.2s;
      // border-radius: var(--radius-m);
      display: flex;
      flex-direction: row;
      // background: var(--bg-gradient-r);
      z-index: 3000;
    }
    .toolbar-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      height: 3rem;
      width: 3rem;
      padding: 0;
      border-radius: 4rem;

      border: 1px solid var(--border-color, #e2e8f0);
      cursor: pointer;
      &:hover {
        background-color: var(--secondary-color);
      }
      
      &.active {
        background-color: var(--tertiary-color);
      }
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
    .card-container {
      display: flex;
      flex-direction: row;
      position: relative;
      width: 100%;
      margin-left: 0;
      margin-right: 0;
      padding: 0;
      cursor: pointer;

      &:hover {
      box-shadow: none;
      background: var(--secondary-color) !important;

        // background: rgba(226, 226, 226, 0.2);  /* Very subtle white for the glass effect */
        opacity: 1;
        visibility: visible;
        // box-shadow: -5px -1px 5px 4px rgba(255, 255, 255, 0.2);
      }
      &.selected {
        backdrop-filter: blur(30px);
        background: var(--primary-color);
      }

  
    }
    button.card-container {
      width: 100%;
      border-radius: 1rem;
      gap: 1rem;
      padding: 1rem;      


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
      font-size: 1rem;
      font-style: bold;
    }


    .thread-group-header {
      font-size: 1rem;
    }



    .ai-selector {
      width: 100%;
      align-items: center;
      gap: 1rem;
      justify-content: flex-end;
      margin-right: 2rem;
      right: 2rem;
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





    h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 16px;
      padding: 10px;
      border-radius: 5px;
    }
  .drawer-container {
    width: auto;
      margin-right: 2rem;

    }

    .drawer-list {
  height: 100%;
  border-radius: 0;
}

  .drawer {
      width: auto;
      margin-right:0;
      margin-left: 0;
      background: var(--bg-gradient-r);
      // backdrop-filter: blur(20px);
      // backdrop-filter: blur(100px);
      // border-top: 1px solid var(--primary-color);
      // border-right: 1px solid var(--primary-color);
      padding: 0;
      z-index: 1;
      // box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
      // background-color: red !important;
      top: 2rem;
      margin-right: 0;
      left: 0.5rem;
      margin-bottom: 1rem !important;
      border-radius: 0;
      width: 100%;
      max-width: 450px;
      height: 87vh !important;
      // border-right: 1px solid var(--secondary-color);
      align-items: center;
      justify-content: center;
      // margin-bottom: 4rem;
      transform: translateX(-100%);
      transition: transform 0.3s ease-in-out;
      /* z-index: 1000; */
    }

    .drawer-visible .chat-messages {
      margin-left: calc(50% - 2rem);
    }

    .drawer-visible .drawer {
      margin-left: -1rem;
      transform: translateX(0);
      top: 3rem;
      padding-top: 0;
    }
    
    .drawer-visible .drawer-toolbar {
      border: none;
      margin: 0;

    }
    .drawer-visible .chat-container {
      display: flex;
      z-index: -1;
      left: 0 !important;
      width: 100% !important;

    }
    .drawer-visible .thread-filtered-results {
      border: 1px solid var(--line-color);
      padding: 1rem;
      margin-left: 1rem;
      margin-right: 1rem;
      border-radius: 2rem;
    }
    .drawer-visible .scroll-bottom-btn {
      display: none;

    }
    

    .drawer-visible .thread-toggle {
      left: 10px;
    }

    .input-container {
      margin-right: 0;
      margin-left: 0;
      margin-bottom: 0;
      bottom: 4rem !important;
      background: transparent;
      flex-grow: 0;
    width: 100%;    
      position: absolute;
    align-items: center;
    justify-content: flex-end;
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

  .chat-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    position: fixed;
    transition: all 0.3s ease-in-out;
    overflow-y: hidden;
    overflow-x: hidden;
    // /* left: 20%; */
    width: 100%;
    // background: rgba(0, 0, 0, 0.2);
    left: 0;
    right: 0;
    padding: 0;
    padding-top: 0;
    height: 100%;
    margin-top: 0;
    margin-left: 0;
  }


  @media (min-width: 1900px) {
  .chat-header {

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


  

.drawer-visible {
  .chat-container {
    right: 0;
    margin-right: 0;
    width: auto;
    margin-left: 0;

  }

  .chat-messages {
    margin-right: 0;
    right: 0;
  }


    // &.input-container-start {
    //   margin-left: 3rem;
    // margin-right: 0;
    // width: auto; 
    //   & textarea {
    //     border-top: 1px solid var(--primary-color) !important;
    // // max-height: 50vh;
    // margin-left: 0;
    // margin-top: 0;
    //   }
    // } 
  }

  .chat-content {
      width: auto;
      margin-right: 0;
      margin-left: 4rem;
    }








  




.chat-placeholder img {
  width: 150%;
  transform: translateX(2%) translateY(-20%);
  
}

}

@media (max-width: 1000px) {
  .chat-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  border-radius: var(--radius-m);
  // background: var(--primary-color);
  transition: all 0.3s ease;
  margin-left: 0;
  margin-right: 0;

  margin-top: 0;
  height: calc(100vh - 2rem);
  user-select: none;
  scrollbar-width:thin;
  scrollbar-color: var(--secondary-color) transparent;
  scroll-behavior: smooth;
  width: 100%;
  }
  .input-container {
    bottom: 1rem;
    overflow: none;
  }

  span.header-btns {
      display: flex;
    flex-direction: row !important;
      right: 0;
      bottom: 0;
      margin-right: 0.5rem;
      margin-top: 0;
      width: auto !important;
    }

    .toggle-btn {
      width: auto;
      padding: 0.5rem !important;
      height: auto;
    }
  .chat-header {
    height: 4rem;
    top: 3rem;
    left: 0 !important;
  }

  .chat-header-thread {
    margin-top: 1rem;
    margin-left: 10rem !important;
    margin-right: 1rem;
    justify-content: flex-end !important;
    gap: 1rem;
    backdrop-filter: blur(10px);
    & span {
      width: auto;
    }
  }
  .drawer-visible .chat-header {
    justify-content: flex-end;
    align-items: flex-end;
    display: none;
    
  }
  // .logo-container {
  //   display: flex;
  // }
  .chat-container {
    margin-left: 0;
    margin-right: 0;
    right: 0;
    width: 100%;
  }
  .chat-content {
    margin-right: 0;
  }

  // .chat-header {
  //   margin-top: 1rem;
  //   padding: 1rem;
  //   width: 90%;
  // }



  

  .drawer-visible {
    &.chat-container {
      margin-left: 0;
      left: 0;
    }
  }
}



@media (max-width: 450px) {
  
  .chat-messages {
    top: 2rem;
  }


  .message {
    p {
      font-size: 0.9rem;
      letter-spacing: 0.1rem;
      line-height:1.5;
    }
  }

  button.toolbar-button {
    display: flex;
    align-items: center;
    justify-content: center !important;
    color: var(--placeholder-color) !important;
    width:2rem !important;
    height: 2rem;
    border-radius: 1rem;
    background: var(--bg-color);
    border: 2px solid var(--line-color);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;

    
    &:hover {
      background-color: var(--secondary-color);
      color: var(--text-color) !important;
    }
    
    &.active {
      background-color: var(--secondary-color);
      color: var(--text-color) !important;
    }
  }
  
  .button-label {
    display: flex;
    color: var(--placeholder-color);
  }
  .drawer-input {
  display: flex;
  flex-direction: row;
  align-items: center;
  // padding: 0.75rem 0;
  gap: 0.5rem;
  border-radius: var(--radius-m);
  height: auto;
  width: 60px;
  color: var(--bg-color);
  transition: all 0.3s ease;



  & button {
    border-radius: var(--radius-m);
    width: auto;
    border: none;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.3s ease;
    justify-content: center;
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
      margin-left: 2rem;
      margin-right: 0;
      width: 150px;
      color: var(--text-color);
      transition: all 0.3s ease;
      font-size: 1rem;
      &::placeholder {
        color: var(--placeholder-color);
      }
      
      &:focus {
        background-color: var(--secondary-color);
        position: absolute;
        width: auto;
        right: 2rem;
        left: 4rem;
        z-index: 1;
        &::placeholder {
          color: var(--placeholder-color);
          
        }
      }
    }
}
  .card-title {
    font-weight: 300;
    font-size: 1.1rem;
    // font-size: var( --font-size-s);
    margin-bottom: 0;
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
    line-height: 1;
    margin-left: 0;
  }
  button.card-container {
    display: flex;
    flex-direction: column;
    position: relative;
    flex-grow: 1;
    padding: 0.5rem;
    // background-color: var(--bg-color);
    width: calc(100% - 1rem);
    // box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.1s ease-in-out;
    &:hover {
      box-shadow: none;
      background: var(--secondary-color) !important;

        // background: rgba(226, 226, 226, 0.2);  /* Very subtle white for the glass effect */
        opacity: 1;
        visibility: visible;
        // box-shadow: -5px -1px 5px 4px rgba(255, 255, 255, 0.2);
      }
      &.selected {
        backdrop-filter: blur(30px);
        background: var(--primary-color);
        border-radius: 2rem;
      }

  }
  button.toggle-btn {
    width: rem;
    height: 2rem;
    justify-content: center;
    align-items: center;
    &:hover {
      width: 2rem;
      height: 2rem;
    }
  }
  .chat-header {
    top: 3rem !important;
    left: 0 !important;
    height: 2rem !important;
    width: 100% !important;
    // display: none;

  }
  .chat-header-thread {
    margin-top: 0;
    margin-left: 0 !important;
    flex-direction: column;
    justify-content: center !important;
    align-items: flex-start !important;
    
    display: none !important;
    & span {
      width: auto;
    }
  }
  
  .scroll-bottom-btn {
  position: fixed;
  bottom: 10rem !important;
  right: 1rem;
  background-color: #21201d;
  color: white;
  border: 1px solid rgba(53, 63, 63, 0.5);
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s;
  z-index: 6;
  align-self: flex-end;
  padding: 0.5rem;
  margin-right: 0;
  margin-bottom: 0;
  

  &:hover {
    background-color: #000000;
  }
}

.messages {
  & p {

  }
}
  .input-container {
    margin-bottom: 0;
    margin-left: 0;
    bottom: 0;
    height: auto;
    width: 100%;
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--line-color);
    border-top-left-radius: 1rem;
    border-top-right-radius: 1rem;
    flex-grow: 0;


    & .combo-input textarea {
      padding: 0 !important;
      margin-left: 2.5rem;
      height: 2rem !important;
      border: none;

      &:focus {
        margin-left: 0;
        padding-inline-start: 2rem !important;
        font-size: 0.7rem !important;
        background: transparent !important;

      };
    }

  }
  textarea::placeholder {
    color: var(--placeholder-color);
    transition: all 0.3s ease;
    width: 100%;
    padding: 0.5rem;
    height: 3rem !important;

    line-height: 1.5;
    margin-top: auto;
    display: flex;
    text-align: left;
    font-size: 0.7rem;
    letter-spacing: 0rem;


  }

  textarea.quote-placeholder::placeholder {
    font-style: italic;
    color: var(--placeholder-color);
    opacity: 0.8;
    height: auto;

  }

  textarea {
    font-size: 0.8rem !important;
  }
  .input-container-start {
      
      bottom: 0rem;
      width: 100%;
      height: auto;

    & .combo-input {
        background: var(--primary-color);
        display: flex;
        justify-content: center;
        align-items: center;
        border: 0;
        border-top-left-radius: 2rem;
        border-top-right-radius: 2rem;    
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-top: 1px solid var(--line-color);
        width: calc(100% - 2rem) !important;
        background: var(--primary-color);
        height: auto;

        & textarea {
          height: 100px !important;
          font-size: 1rem !important;
          &:focus {
            // font-size: 1rem !important;
          }
        }

    }

    &::placeholder {
      color: var(--placeholder-color);
    }
    
    :global(svg) {
      color: var(--primary-color);
      stroke: var(--primary-color);
      fill: var(--tertiary-color);
    }

    & textarea {
      border: none;
      box-shadow: none;
      transition: all 0.3s ease;
      background: var(--bg-color);
      margin-top: 1rem !important;
      // backdrop-filter: blur(14px);
      // margin-left: 7rem;
      // padding-left: 1rem;
      // box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
      color: var(--text-color);
      // background: transparent;
      display: flex;
      // backdrop-filter: blur(40px);
      font-size: 1rem;
      width: calc(100% - 2rem);
      border-radius: 0;
      background: transparent;
      // max-height: 400px;
      // margin-left: 2rem !important;
      // margin-right: 2rem !important;

      &:focus {
      color: white;
      animation: none;
      box-shadow: none;
      overflow-y: auto !important;
      transition: all 0.3s ease;
      display: flex;
      font-size: 1rem;
      // background: var(--bg-gradient-left) !important;
          // box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);
          // border-top: 4px solid var(--secondary-color) !important;

      box-shadow: none !important;

      }
    }

  }

  

  .submission {
    gap: 0.5rem;
    margin-right: 0;
    margin-left: 2rem;
    margin-bottom: 0; 
    width: 100%; 
  }

  .drawer-container {
    margin-right: 0;
    margin-left: 0;
    right: 0;
    left: 0;
    width: 100%;
    
  }


  .chat-container {
    padding: 0;
    top: 0;
    left: 0;
  }
  
  .combo-input {
    width: 100% !important;
    padding: 0;
  }



  .drawer-list {
    margin-top: 0 !important;
    top: 0 !important;
    margin-bottom: 0;
    

  }
  .drawer-visible .dashboard-scroll {
    display: none;
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
    top: 4rem;
    bottom: 0rem;
    margin-bottom: 1rem;
    gap: 1px;
    // left: 64px;
    height: 60vh;
    width: calc(100% - 1rem);
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



  button.card-container {
  }
  .card {
    padding: 0;
  }
  .card-static {
    padding: 0;
    height: 2rem;
    overflow: hidden;
  }
  .card-title {
    font-size: 0.9rem;
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
    margin-right: 0;
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


pre.code-block {
	position: relative;
	color: var(--code-color, #d4d4d4);
	border-radius: var(--radius-m, 0.375rem);
	padding: 1rem;
	margin: 1rem 0;
	overflow-x: auto;
  
	font-family: 'Fira Code', monospace;
	font-size: 0.9rem;
	line-height: 1.5;
	tab-size: 2;

  }
  
  /* Inline code styling */

  /* Copy button styling */
  .copy-code-button {
	position: absolute;
  background: red !important;
	top: 0.5rem;
	right: 0.5rem;
	padding: 0.35rem;
	background-color: var(--button-bg, rgba(255, 255, 255, 0.1));
	border: none;
	border-radius: var(--radius-s, 0.25rem);
	color: var(--button-color, rgba(255, 255, 255, 0.6));
	cursor: pointer;
	opacity: 0;
	transition: all 0.2s ease;
	display: flex;
	align-items: center;
	justify-content: center;
  }
  
  pre.code-block:hover .copy-code-button {
	opacity: 1;
	background-color: red;
  }
  
  .copy-code-button:hover {
	background-color: var(--button-hover-bg, rgba(255, 255, 255, 0.2));
	color: var(--button-hover-color, rgba(255, 255, 255, 0.8));
  }
  
  /* JSON syntax highlighting */
  .json-key {
	color: var(--json-key-color, #9cdcfe);
  }
  
  .json-string {
	color: var(--json-string-color, #ce9178);
  }
  
  .json-number {
	color: var(--json-number-color, #b5cea8);
  }
  
  .json-boolean {
	color: var(--json-boolean-color, #569cd6);
  }
  
  .json-null {
	color: var(--json-null-color, #569cd6);
  }
  
  .json-punctuation {
	color: var(--json-punctuation-color, #d4d4d4);
  }
  
  /* Visual feedback for copy operation */
  .copy-feedback {
	position: absolute;
	top: 3rem;
	right: 1rem;
	background-color: var(--feedback-bg, rgba(0, 0, 0, 0.7));
	color: var(--feedback-color, white);
	padding: 0.3rem 0.6rem;
	border-radius: var(--radius-s, 0.25rem);
	font-size: 0.8rem;
	pointer-events: none;
	opacity: 0;
	transform: translateY(-10px);
	transition: all 0.2s ease;
  }
  
  .copy-feedback.visible {
	opacity: 1;
	transform: translateY(0);
  }

  .text-preview-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--bg-color-light);
  border-radius: var(--border-radius);
  margin-bottom: 8px;
}

.text-preview-btn {
  flex: 1;
  padding: 8px 12px;
  background: var(--primary-color-light);
  color: var(--text-color);
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.text-preview-btn:hover {
  background: var(--primary-color);
}

.text-trash-btn {
  background: transparent;
  border: none;
  color: var(--text-color-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-trash-btn:hover {
  color: var(--error-color);
  background: var(--error-color-light);
}

/* Modal Styles */
.text-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-color);
  border-radius: var(--border-radius-lg);
  width: 100%;

  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-textarea {
  flex: 1;
  padding: 16px;
  border: none;
  resize: none;
  min-height: 200px;
  font-family: inherit;
  font-size: inherit;
  background: var(--bg-color-light);
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-color-muted);
  cursor: pointer;
}

.close-btn:hover {
  color: var(--text-color);
}


</style>

