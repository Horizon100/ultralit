<script lang="ts">
  import { pb, currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
  import { onMount, afterUpdate, createEventDispatcher, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import { fade, fly, scale, slide } from 'svelte/transition';
  import { elasticOut, cubicOut } from 'svelte/easing';
  import { Send, Paperclip, Bot, Menu, Reply, Smile, Plus, X, FilePenLine, Save, Check, ChevronDown, ChevronUp, ChevronLeft, Tag, Tags, Edit2, Pen, Trash, MessageCirclePlus, Search } from 'lucide-svelte';
  import { fetchAIResponse, generateScenarios, generateTasks as generateTasksAPI, createAIAgent, determineNetworkStructure, generateSummary as generateSummaryAPI, generateGuidance, generateNetwork } from '$lib/aiClient';
  import { networkStore } from '$lib/stores/networkStore';
  import { messagesStore} from '$lib/stores/messagesStore';
  import NetworkVisualization from '$lib/components/network/NetworkVisualization.svelte';
  import { updateAIAgent, ensureAuthenticated, deleteThread, deleteTag } from '$lib/pocketbase';
  import PromptSelector from './PromptSelector.svelte';
  import PromptCatalog from './PromptCatalog.svelte';
  import type { AIModel, ChatMessage, InternalChatMessage, Scenario, Task, Attachment, Guidance, PromptType, NetworkData, AIAgent, Network, Threads, Messages } from '$lib/types';
  import { fetchThreads, fetchMessagesForThread, resetThread, fetchLastMessageForThread, createThread, updateThread, addMessageToThread } from '$lib/threadsClient';
  import { threadsStore } from '$lib/stores/threadsStore';
  import { t } from '$lib/stores/translationStore';
  import { promptStore } from '$lib/stores/promptStore';
  import Reactions from '$lib/components/common/chat/Reactions.svelte';
  import ThreadTags from '$lib/components/common/chat/ThreadTags.svelte';
  import ThreadListTags from '$lib/components/common/chat/ThreadListTags.svelte';
  import { messageCountsStore, messageCounts } from '$lib/stores/messageCountStore';

  export let seedPrompt: string = '';
  export let additionalPrompt: string = '';
  export let aiModel: AIModel;
  export let userId: string;
  export let attachment: File | null = null;
  export let promptType: PromptType = 'CASUAL_CHAT';
  export let threadId: string | null = null;
  export let initialMessageId: string | null = null;
  export let showThreadList = true;
  let isTextareaFocused = false;
  
  let threads: Threads[];
  let currentThread: Threads | null = null;
  let currentThreadId: string | null = null;  
  let searchQuery = '';
  let isTags = true; 
  let filteredThreads: Threads[] = [];

  function mapMessageToInternal(message: Messages): InternalChatMessage {
  return {
    id: message.id,
    content: message.text, // Map text to content
    text: message.text,
    role: message.type === 'human' ? 'user' : 'assistant' as RoleType, // Map type to role
    collectionId: message.collectionId,
    collectionName: message.collectionName,
    parent_msg: message.parent_msg,
    reactions: message.reactions,
    prompt_type: message.prompt_type as PromptType,
    model: message.model,
    thread: message.thread,
    isTyping: false,
    isHighlighted: false,
    user: message.user,
    created: message.created,
    updated: message.updated
  };
}


  let messages: Messages[] = [];
  let quotedMessage: Messages | null = null;
  let isEditingThreadName = false;
  let editedThreadName = '';
  let expandedDates = new Set<string>();
  let showTagSelector = false;
  let editingTagIndex: number | null = null;
  let availableTags: Tag[] = [];
  let editingTagId: string | null = null;
  let selectedTagIds = new Set();
  let isMinimized = false;
  let lastScrollTop = 0;
  let chatMessages: InternalChatMessage[] = [];
  let userInput: string = '';
  let isLoading: boolean = false;
  let hasSentSeedPrompt: boolean = false;
  let chatMessagesDiv: HTMLDivElement;
  let thinkingPhrase: string = '';
  let messageIdCounter: number = 0;
  let thinkingMessageId: string | null = null;
  let typingMessageId: string | null = null;
  let scenarios: Scenario[] = [];
  let tasks: Task[] = [];
  let attachments: Attachment[] = [];
  let currentStage: 'initial' | 'scenarios' | 'guidance' | 'tasks' | 'refinement' | 'final' | 'summary' = 'initial';
  let summary: string = '';
  let selectedScenario: Scenario | null = null;
  let selectedTask: Task | null = null;
  let networkData: any = null;
  let showNetworkVisualization: boolean = false;
  let guidance: Guidance | null = null;
  let textareaElement: HTMLTextAreaElement | null = null;
  let defaultTextareaHeight = '60px'; 
  let isAuthenticated = false;
  let showAuth = false;
  let avatarUrl: string | null = null;
  let username: string = 'You';
  let lastMessageCount = 0;
  let currentPromptType: PromptType = promptType;
  let expandedGroups: Set<string> = new Set();
  let isLoadingMessages = false;
  let initialLoadComplete = false;
  let showScrollButton = false;
  let latestMessageId: string | null = null;
  let isCleaningUp = false;
  let isDragging = false;
  let startY: number;
  let scrollTopStart: number;
  let isCreatingThread = false;
  let showPromptCatalog = false;
  let currentPage = 1;

  const dispatch = createEventDispatcher();


  $: ({ threads, currentThreadId, messages, updateStatus } = $threadsStore);

  messagesStore.subscribe(value => messages = value);

  interface ThreadStoreState {
    threads: Threads[];
    currentThreadId: string | null;
    messages: Messages[];
    updateStatus: string;
    showThreadList: boolean;
  }

  threadsStore.subscribe((state: ThreadStoreState) => {
    threads = state.threads;
    currentThreadId = state.currentThreadId;
    messages = state.messages;
    updateStatus = state.updateStatus;
    showThreadList = state.showThreadList;
  });

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

  $: currentThread = threads.find(t => t.id === currentThreadId) || null;  
  $: safeAIModel = aiModel || defaultAIModel;
  $: groupedMessages = groupMessagesByDate(messages.map(mapMessageToInternal));
  $: {
  if (groupedMessages.length > 0 && expandedDates.size === 0) {
    expandedDates = new Set([groupedMessages[0].date]);
  }
}

  function initializeExpandedDates() {
  if (groupedMessages.length > 0) {
    const latestGroup = groupedMessages[0];
    expandedDates.add(latestGroup.date);
    expandedDates = expandedDates;
  }
}



function groupMessagesByDate(messages: Messages[]): { date: string; displayDate: string; messages: Messages[]; isRecent: boolean }[] {
  const groups: { [key: string]: { messages: Messages[]; displayDate: string } } = {};
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
      displayDate = dateKey;
    }

    if (!groups[dateKey]) {
      groups[dateKey] = { messages: [], displayDate };
    }
    groups[dateKey].messages.push(message);
  });

  const sortedGroups = Object.entries(groups)
    .map(([date, { messages, displayDate }]) => ({ 
      date, 
      displayDate,
      messages, 
      isRecent: false 
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Change this line - mark the first (newest) group as recent instead of the last
  if (sortedGroups.length > 0) {
    sortedGroups[0].isRecent = true;  // Changed from length-1 to 0
  }

  return sortedGroups;
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


  function formatDate(date: string): string {
    if (date === 'Today' || date === 'Yesterday') return date;
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });  
  }

  function getTotalMessages(): number {
    return messages.length;
  }

  function addMessage(
  role: 'user' | 'assistant' | 'thinking', 
  content: string | Scenario[] | Task[], 
  parentMsgId: string | null = null
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
    model: aiModel?.id || null,
    reactions: {
      upvote: 0,
      downvote: 0,
      bookmark: [],
      highlight: [],
      question: 0
    }
  };
}
  async function createTag(name: string) {
    if (!name.trim()) return;

    try {
      const newTag = await pb.collection('tags').create<Tag>({
        name: name.trim(),
        color: getRandomBrightColor(name),
        user: $currentUser?.id,
        selected_threads: [],
      });

      availableTags = [...availableTags, newTag];
      newTagName = ''; // Clear the input
      editingTagIndex = null; // Close the input
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  }

  function handleScroll(event) {
      const currentScrollTop = event.target.scrollTop;
      if (currentScrollTop > lastScrollTop && currentScrollTop > 50) {
        isMinimized = true;
      } else if (currentScrollTop < lastScrollTop || currentScrollTop <= 50) {
        isMinimized = false;
      }
      lastScrollTop = currentScrollTop;
    }

  function getThreadDateGroup(thread: Threads): string {
    const now = new Date();
    const threadDate = new Date(thread.updated);
    const diffDays = Math.floor((now.getTime() - threadDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 0) return $t('threads.today');
    if (diffDays === 1) return $t('threads.yesterday');
    if (diffDays < 7) return $t('threads.lastweek');
    if (diffDays < 30) return $t('threads.thismonth');
    return $t('threads.older');
  }

  const groupOrder = [$t('threads.today'), $t('threads.yesterday'), $t('threads.lastweek'), $t('threads.thismonth'), $t('threads.older')];

  // $: groupedThreads = threads.reduce((acc, thread) => {
  //   const group = getThreadDateGroup(thread);
  //   if (!acc[group]) acc[group] = [];
  //   acc[group].push(thread);
  //   return acc;
  // }, {} as Record<string, Threads[]>);

  // $: orderedGroupedThreads = groupOrder
  //   .filter(group => groupedThreads[group] && groupedThreads[group].length > 0)
  //   .map(group => ({ group, threads: groupedThreads[group] }));

  function groupMessagesWithReplies(messages: Messages[]): Messages[][] {
    const messageGroups: Messages[][] = [];
    const messageMap = new Map<string, Messages>();

    messages.forEach(message => {
      if (!message.parent_msg) {
        messageGroups.push([message]);
        messageMap.set(message.id, message);
      } else {
        const parentGroup = messageGroups.find(group => group[0].id === message.parent_msg);
        if (parentGroup) {
          parentGroup.push(message);
        } else {
          const parent = messageMap.get(message.parent_msg);
          if (parent) {
            const newGroup = [parent, message];
            messageGroups.push(newGroup);
          } else {
            messageGroups.push([message]);
          }
        }
      }
    });

    return messageGroups;
  }

  async function handleLoadThread(threadId: string) {
  try {
    const thread = await pb.collection('threads').getOne(threadId, {
      expand: 'tags'
    });
    
    currentThreadId = thread.id;
    
    isLoadingMessages = true;
    await messagesStore.fetchMessages(threadId);
    
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

    // Ensure prompt catalog is hidden and chat is shown
    showPromptCatalog = false;
    
  } catch (error) {
    console.error(`Error loading messages for thread ${threadId}:`, error);
  } finally {
    isLoadingMessages = false;
  }
}

  async function handleCreateNewThread() {
    try {
      isCreatingThread = true;
      
      // Create new thread
      const newThread = await threadsStore.addThread({ 
        op: userId, 
        name: `Thread ${threads?.length ? threads.length + 1 : 1}` 
      });
      
      if (!newThread?.id) {
        throw new Error("Failed to create thread: No thread ID returned");
      }

      // Fetch all threads again to ensure we have the complete list
      await threadsStore.loadThreads();
      
      // Set current thread and load it
      currentThreadId = newThread.id;
      await handleLoadThread(newThread.id);
      !isLoading && handleSendMessage();

      return newThread;
    } catch (error) {
      console.error("Error creating new thread:", error);
      return null;
    } finally {
      isCreatingThread = false;
    }
  }

  async function loadThreadCounts(threads: Threads[]) {
    isLoading = true;
    try {
      const { totalThreads } = await messageCountsStore.fetchBatch(threads, currentPage);
      if (totalThreads > currentPage * 20) {
        currentPage++;
      }
    } finally {
      isLoading = false;
    }
  }

  $: visibleThreads = orderedGroupedThreads.flatMap(group => group.threads);
  $: {
    if (visibleThreads.length > 0) {
      loadThreadCounts(visibleThreads);
    }
  }

  afterUpdate(() => {
    if (chatMessagesDiv && chatMessages.length > lastMessageCount) {
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
      lastMessageCount = chatMessages.length;
    }
  });

  function scrollToBottom() {
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
    showThreadList
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
      showThreadList = true;
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

  afterUpdate(() => {
    // scrollToBottom();
  });

  const thinkingPhrases = [
    "Consulting my digital crystal ball...",
    "Asking the oracle of ones and zeros...",
    "Summoning the spirits of Silicon Valley...",
    "Decoding the matrix...",
    "Channeling the ghost in the machine...",
    "Pondering the meaning of artificial life...",
    "Calculating the answer to life, the universe, and everything...",
    "Divining the digital tea leaves...",
    "Consulting the sacred scrolls of binary...",
    "Communing with the AI hive mind..."
  ];


  function copyToClipboard(content: string) {
    navigator.clipboard.writeText(content).then(() => {
      console.log('Content copied to clipboard');
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  }

  function extractKeywords(text: string): string[] {
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    const uniqueWords = [...new Set(words)];
    return uniqueWords.filter(word => 
      word.length > 3 && !['the', 'and', 'for', 'that', 'this', 'with'].includes(word)
    );
  }

  function highlightKeywords(text: string, keywords: string[]): string {
    const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  function generateNetworkData(text: string, keywords: string[]): { nodes: any[], edges: any[] } {
  const nodes = keywords.map(keyword => ({ id: keyword, label: keyword }));
  const edges: { from: string, to: string }[] = [];

  const sentences = text.split(/[.!?]+/);
  sentences.forEach(sentence => {
    const sentenceKeywords = keywords.filter(keyword => sentence.toLowerCase().includes(keyword.toLowerCase()));
    for (let i = 0; i < sentenceKeywords.length; i++) {
      for (let j = i + 1; j < sentenceKeywords.length; j++) {
        edges.push({ from: sentenceKeywords[i], to: sentenceKeywords[j] });
      }
    }
  });

  return { nodes, edges };
}
  
  function getRandomThinkingPhrase() {
    return thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
  }
  
  
  $: if (seedPrompt && !hasSentSeedPrompt) {
    console.log("Processing seed prompt:", seedPrompt);
    hasSentSeedPrompt = true;
    handleSendMessage(seedPrompt);
  }

  async function generateLocalSummary() {
  summary = await generateSummaryAPI(
    chatMessages.map(msg => ({ 
      role: msg.role as 'user' | 'assistant' | 'system', 
      content: msg.content 
    })),
    aiModel, 
    userId,
  );
  dispatch('summary', summary);
}

  async function generateLocalTasks() {
    if (selectedScenario) {
      tasks = await generateTasksAPI(selectedScenario, aiModel, userId);
      dispatch('tasks', tasks);
    } else {
      console.error('No scenario selected for task generation');
    }
  }

  $: if (currentStage === 'summary') {
    generateLocalSummary();
  }

  $: if (currentStage === 'tasks' && selectedScenario) {
    generateLocalTasks();
  }

  async function handleSendMessage(message: string = userInput) {
  if (!message.trim() && chatMessages.length === 0 && !attachment) return;

  try {
    // If no thread is selected, create a new one and set it as the current thread
    if (!currentThreadId) {
      console.log('No thread selected. Creating a new thread...');
      const newThread = await threadsStore.addThread({
        op: userId,
        name: `Thread ${threads?.length ? threads.length + 1 : 1}`
      });

      if (newThread && newThread.id) {
        threads = [...(threads || []), newThread];
        currentThreadId = newThread.id;
        await handleLoadThread(newThread.id);
      } else {
        console.error('Failed to create a new thread. Cannot proceed with sending the message.');
        return;
      }
    }

    // Clear input immediately for responsiveness
    const currentMessage = message.trim();
    userInput = '';
    resetTextareaHeight();

    // Add user message to UI immediately
    const userMessageUI = addMessage('user', currentMessage, quotedMessage ? quotedMessage.id : null);
    chatMessages = [...chatMessages, userMessageUI];

    // Save user message to database
    const userMessage = await messagesStore.saveMessage({
      text: currentMessage,
      type: 'human',
      thread: currentThreadId,
      parent_msg: quotedMessage ? quotedMessage.id : null,
      prompt_type: promptType
    }, currentThreadId);

    quotedMessage = null;

    // Start thinking animation
    thinkingPhrase = getRandomThinkingPhrase();
    const thinkingMessage = addMessage('thinking', thinkingPhrase);
    thinkingMessageId = thinkingMessage.id;
    chatMessages = [...chatMessages, thinkingMessage];
    // isLoading = true;

    // Prepare messages for AI
    const messagesToSend = chatMessages
      .filter(({ role, content }) => role && content)
      .map(({ role, content }) => {
        if (role === 'user' && promptType) {
          // Add prompt context to the last user message
          return {
            role,
            content: `[Using ${promptType} prompt]\n${content.toString()}`
          };
        }
        return { role, content: content.toString() };
      });

    if (messagesToSend.length > 0) {
      // Add system message with prompt context if prompt type exists
      if (promptType) {
        messagesToSend.unshift({
          role: 'system',
          content: `You are responding using the ${promptType} prompt. Please format your response accordingly.`
        });
      }

      const aiResponse = await fetchAIResponse(messagesToSend, aiModel, userId, attachment);

      // Remove thinking message
      chatMessages = chatMessages.filter(msg => msg.id !== String(thinkingMessageId));

      // Save AI response
      const assistantMessage = await messagesStore.saveMessage({
        text: aiResponse,
        type: 'robot',
        thread: currentThreadId,
        parent_msg: userMessage.id,
        prompt_type: promptType,
        mode: aiModel,
      }, currentThreadId);

      // Add AI response to UI
      const newAssistantMessage = addMessage('assistant', '', userMessage.id);
      chatMessages = [...chatMessages, newAssistantMessage];
      typingMessageId = newAssistantMessage.id;

      // Use typewriting effect
      await typeMessage(aiResponse);

      // Update the message with the full response after typewriting is complete
      chatMessages = chatMessages.map(msg =>
        msg.id === String(typingMessageId)
          ? { ...msg, content: aiResponse, text: aiResponse, isTyping: false }
          : msg
      );

      // Add auto-update thread name after first AI response
      const currentMessages = await messagesStore.fetchMessages(currentThreadId);
        if (currentMessages) {
          const robotMessages = currentMessages.filter((m: Messages) => m.type === 'robot');
          if (robotMessages.length === 1) {
            // This is the first AI response, update thread name
            await threadsStore.autoUpdateThreadName(currentThreadId);
          }
        }

      await messagesStore.fetchMessages(currentThreadId);

      console.log('Message sent, checking if scroll needed');
      setTimeout(() => {
        if (chatMessagesDiv) {
          const { scrollTop, scrollHeight, clientHeight } = chatMessagesDiv;
          console.log('Current scroll state:', { scrollTop, scrollHeight, clientHeight });
          if (scrollHeight - scrollTop - clientHeight < 200) {
            console.log('Scrolling to bottom after sending message');
            scrollToBottom();
          } else {
            console.log('Not scrolling to bottom, user has scrolled up');
          }
        } else {
          console.log('chatMessagesDiv is null after sending message');
        }
      }, 0);
    } else {
      console.error('No valid messages to send to the AI');
    }
  } catch (error) {
    console.error('Error in handleSendMessage:', error);
    chatMessages = chatMessages.filter(msg => msg.id !== thinkingMessageId);
    let errorMessage = 'An unexpected error occurred. Please try again later.';
    if (error instanceof Error) {
      errorMessage = `Error: ${error.message}`;
    }
    chatMessages = [...chatMessages, addMessage('assistant', errorMessage)];
  } finally {
    isLoading = false;
    thinkingMessageId = null;
    typingMessageId = null;
    attachment = null;
  }
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

async function handleScenarioSelection(scenario: Scenario) {
  selectedScenario = scenario;
  chatMessages = [...chatMessages, addMessage('user', `Selected scenario: ${scenario.description}`)];
  
  guidance = await generateGuidance({ type: 'scenario', description: scenario.description }, aiModel, userId);
  chatMessages = [...chatMessages, addMessage('assistant', guidance.content)];

  isLoading = true;
  thinkingPhrase = getRandomThinkingPhrase();
  const thinkingMessage = addMessage('thinking', thinkingPhrase);
  chatMessages = [...chatMessages, thinkingMessage];

  try {
    tasks = await generateTasksAPI(scenario, aiModel, userId);
    chatMessages = chatMessages.filter(msg => msg.role !== 'thinking');
    chatMessages = [...chatMessages, addMessage('assistant', "Based on the selected scenario, here are some suggested tasks:")];
    chatMessages = [...chatMessages, addMessage('options', tasks)];
    currentStage = 'tasks';
  } catch (error) {
    if (error instanceof Error) {
    chatMessages = [...chatMessages, addMessage('assistant', `Sorry, I encountered an error: ${error.message}`)];
    } else {
      chatMessages = [...chatMessages, addMessage('assistant', `Sorry, I encountered an error: Unknown error`)];
    }
  } finally {
    isLoading = false;
  }
}
async function handleTaskSelection(task: Task) {
  selectedTask = task;
  chatMessages = [...chatMessages, addMessage('user', `Selected task: ${task.description}`)];
  
  // Provide opportunity for task refinement
  const refinementGuidance = await generateGuidance({ type: 'task_refinement', description: task.description }, aiModel, userId);
  chatMessages = [...chatMessages, addMessage('assistant', refinementGuidance.content)];
  
  // Automatically proceed to finalization
  await finalizeProcess();
}


async function finalizeProcess() {
  if (selectedScenario && selectedTask) {
    isLoading = true;
    chatMessages = [...chatMessages, addMessage('thinking', 'Finalizing process...')];

    try {
      const rootAgent = await createAIAgent(selectedScenario, [selectedTask], aiModel, userId);
      
      const childAgents = await Promise.all(tasks.map(task => 
        createAIAgent({ id: '', description: task.description } as Scenario, [], aiModel, userId)
      ));

      // Update root agent with child agents
      await updateAIAgent(rootAgent.id, {
        child_agents: childAgents.map(agent => agent.id)
      });

      networkStore.addAgent(rootAgent);
      networkStore.addChildAgents(childAgents);

      const summaryMessages = chatMessages.filter(msg => msg.role !== 'thinking' && msg.role !== 'assistant');
      summary = await generateSummaryAPI(
        summaryMessages.map(msg => ({ 
          role: msg.role as 'user' | 'assistant' | 'system', 
          content: msg.content.toString() 
        })), 
        aiModel, 
        userId
      );
      const keywords = extractKeywords(summary);
      const highlightedSummary = highlightKeywords(summary, keywords);
      


      chatMessages = chatMessages.filter(msg => msg.role !== 'thinking');
      await typeMessage('Process complete. AI agent created and network structure determined.');
      await typeMessage('Summary:');
      chatMessages = [...chatMessages, { ...addMessage('assistant', highlightedSummary), isHighlighted: true }];
      
      currentStage = 'summary';
      dispatch('summary', summary);
      dispatch('networkData', networkData);
    } catch (error) {
      console.error('Error in finalizeProcess:', error);
      chatMessages = chatMessages.filter(msg => msg.role !== 'thinking');
      await typeMessage(`An error occurred while finalizing the process: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isLoading = false;
    }
  } else {
    console.error('Cannot finalize process: scenario or task not selected');
    await typeMessage('Error: Cannot finalize process. Please select a scenario and a task.');
  }
}


  function toggleNetworkVisualization() {
    showNetworkVisualization = !showNetworkVisualization;
  }
  
  afterUpdate(() => {
    if (chatMessagesDiv && chatMessages.length > lastMessageCount) {
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
      lastMessageCount = chatMessages.length;
    }
  });


  async function fetchTags() {
    try {
      const records = await pb.collection('tags').getFullList<Tag>({
        sort: 'name',
        expand: 'selected_threads'
      });
      availableTags = records;
      console.log("Fetched tags:", availableTags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }

  function adjustFontSize(element: HTMLTextAreaElement) {
      const maxFontSize = 40;
      const minFontSize = 20;
      const maxLength = 200; // Adjust this value to determine when to start shrinking the font

      const contentLength = element.value.length;
      
      if (contentLength <= maxLength) {
          element.style.fontSize = `${maxFontSize}px`;
      } else {
          const fontSize = Math.max(
              minFontSize,
              maxFontSize - (contentLength - maxLength) / 2
          );
          element.style.fontSize = `${fontSize}px`;
      }
  }

  function getLastMessage(): Messages | null {
    if (messages && messages.length > 0) {
      return messages[messages.length - 1]; // Returns the last message in the array
    }
    return null; // Return null if there are no messages
  }


  onMount(async () => {
    initializeExpandedDates();

    try {
      isAuthenticated = await ensureAuthenticated();
      if (!isAuthenticated) {
        console.error('User is not logged in. Please log in to create a network.');
        showAuth = true;
        return;
      }

      if ($currentUser && $currentUser.id) {
        updateAvatarUrl();
        username = $currentUser.username || $currentUser.email;
      }
      await fetchTags();

      // Fetch threads
      try {
        threads = await fetchThreads();
        console.log("Fetched threads:", threads);
      } catch (error) {
        console.error('Error fetching threads:', error);
      }

      // Get URL parameters once
      const urlParams = new URLSearchParams(window.location.search);
      const threadIdFromUrl = urlParams.get('threadId');
      const messageIdFromUrl = urlParams.get('messageId');
      const shouldAutoTrigger = urlParams.get('autoTrigger') === 'true';
      if (threadIdFromUrl) {
        currentThreadId = threadIdFromUrl;
        await handleLoadThread(threadIdFromUrl);

        // After fetching messages for the thread, get the last message
        if (currentThreadId) {
          messages = await fetchMessagesForThread(currentThreadId);
          const lastMessage = getLastMessage();
          console.log('Last message:', lastMessage);
        }

        if (messageIdFromUrl && shouldAutoTrigger) {
          const targetMessage = messages.find(m => m.id === messageIdFromUrl);
          if (targetMessage) {
            try {
              isLoading = true;
              
              // Start thinking animation
              thinkingPhrase = getRandomThinkingPhrase();
              const thinkingMessage = addMessage('thinking', thinkingPhrase);
              thinkingMessageId = thinkingMessage.id;
              chatMessages = [...chatMessages, thinkingMessage];

              // Fetch AI response
              const aiResponse = await fetchAIResponse(
                chatMessages.map(({ role, content }) => ({ role, content: content.toString() })),
                aiModel,
                userId,
                attachment
              );

              // Remove thinking message
              chatMessages = chatMessages.filter(msg => msg.id !== String(thinkingMessageId));

              // Save AI response
              const assistantMessage = await messagesStore.saveMessage({
                text: aiResponse,
                type: 'robot',
                thread: currentThreadId,
                parent_msg: targetMessage.id,
                prompt_type: prompt
              }, currentThreadId);

              // Add AI response to UI
              const newAssistantMessage = addMessage('assistant', '', targetMessage.id);
              chatMessages = [...chatMessages, newAssistantMessage];
              typingMessageId = newAssistantMessage.id;

              // Use typewriting effect
              await typeMessage(aiResponse);

              // Update the message with the full response
              chatMessages = chatMessages.map(msg => 
                msg.id === String(typingMessageId) 
                  ? { ...msg, content: aiResponse, text: aiResponse, isTyping: false }
                  : msg
              );

              // Update thread name after first AI response
              const robotMessages = messages.filter(m => m.type === 'robot');
              if (robotMessages.length === 1) {
                await threadsStore.autoUpdateThreadName(currentThreadId);
              }

              await messagesStore.fetchMessages(currentThreadId);
            } catch (error) {
              console.error('Error processing AI response:', error);
              chatMessages = chatMessages.filter(msg => msg.id !== thinkingMessageId);
              const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
              chatMessages = [...chatMessages, addMessage('assistant', `Error: ${errorMessage}`)];
            } finally {
              isLoading = false;
              thinkingMessageId = null;
              typingMessageId = null;
            }
          }
        }
      } else {
        // If no specific thread ID, don't automatically load any thread
        currentThreadId = null;
      }

      // Set up textarea handlers
      if (textareaElement) {
        const adjustTextareaHeight = () => {
          textareaElement.style.height = 'auto';
          textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, 300)}px`;
        };

        const resetTextareaHeight = () => {
          textareaElement.style.height = defaultTextareaHeight;
        };

        textareaElement.addEventListener('input', adjustTextareaHeight);
        textareaElement.addEventListener('blur', resetTextareaHeight);

        return () => {
          textareaElement.removeEventListener('input', adjustTextareaHeight);
          textareaElement.removeEventListener('blur', resetTextareaHeight);
        };
      }

      initialLoadComplete = true;
    } catch (error) {
      console.error("Error in onMount:", error);
    }
  });



  
  $: console.log("isLoading changed:", isLoading);

  $: if ($currentUser && $currentUser.avatar) {
      updateAvatarUrl();
  }
  onDestroy(() => {
    // Reset current thread
    currentThreadId = null;
    
    // Reset thread selection in store
    threadsStore.setCurrentThread(null);
    
    // Clear messages
    chatMessages = [];
    messages = [];
    
    // Reset any other state you want to clear
    quotedMessage = null;
    isLoading = false;
    thinkingMessageId = null;
    typingMessageId = null;
    
    // Clean up URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('threadId');
    url.searchParams.delete('messageId');
    url.searchParams.delete('autoTrigger');
    window.history.replaceState({}, '', url);
  });




  function updateAvatarUrl() {
      if ($currentUser && $currentUser.avatar) {
          avatarUrl = pb.getFileUrl($currentUser, $currentUser.avatar);
      }
  }
  
  function drag(event: MouseEvent) {
    if (isDragging) {
      const deltaY = startY - event.clientY;
      chatMessagesDiv.scrollTop = scrollTopStart + deltaY;
    }
  }
  
  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
  }

onMount(async () => {
  try {
    // Ensure user is authenticated
    isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.error('User is not logged in. Please log in to create a network.');
      showAuth = true;
      return;
    }

    // Initialize textarea adjustment logic
    if (textareaElement) {
      const adjustTextareaHeight = () => {
        if (textareaElement) {
          textareaElement.style.height = 'auto';
          textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, 300)}px`; // Cap the height to 300px
        }
      };

      // Add event listener for input
      textareaElement.addEventListener('input', adjustTextareaHeight);

      // Initial adjustment
      adjustTextareaHeight();

      // Cleanup listener on destroy
      return () => {
        textareaElement.removeEventListener('input', adjustTextareaHeight);
      };
    }

    // If no thread is selected, ensure a thread exists
    if (!currentThreadId) {
      console.log("No thread selected, creating a new thread...");
      const newThread = await threadsStore.addThread({
        op: userId,
        name: `Thread ${threads?.length ? threads.length + 1 : 1}`,
      });

      if (newThread && newThread.id) {
        threads = [...(threads || []), newThread];
        currentThreadId = newThread.id;
        console.log("Created new thread:", newThread);
      } else {
        console.error("Failed to create a new thread.");
      }
    }

  } catch (error) {
    console.error("Error in onMount:", error);
  }
});

  function resetTextareaHeight() {
  if (textareaElement) {
    textareaElement.style.height = 'auto';
    textareaElement.style.height = '50px'; 
  }
}

  function startEditingThreadName() {
    isEditingThreadName = true;
    editedThreadName = currentThread?.name || '';
  }

  async function submitThreadNameChange() {
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

  function handleTextareaFocus() {
    isTextareaFocused = true;
  }

  function handleTextareaBlur() {
    isTextareaFocused = false;
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
  async function handleDeleteTag(event: MouseEvent, tagId: string) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this tag?')) {
      try {
        await pb.collection('tags').delete(tagId);
        availableTags = availableTags.filter(tag => tag.id !== tagId);
        console.log('Tag deleted successfully');
      } catch (error) {
        console.error('Error deleting tag:', error);
      }
    }
  }





  // function toggleDateExpansion(date: string) {
  //   if (expandedDates.has(date)) {
  //     if (!groupedMessages.find(group => group.date === date)?.isRecent) {
  //       expandedDates.delete(date);
  //     }
      
  //   } else {
  //     expandedDates.add(date);
      
  //   }
  //   expandedDates = expandedDates;
  // }

//   function toggleDateExpansion(date: string) {
//     if (expandedDates.has(date)) {
//         if (!groupedMessages.find(group => group.date === date)?.isRecent) {
//             expandedDates.delete(date);
//         }
//     } else {
//         expandedDates.add(date);
//     }
// }

//   function toggleDateExpansion(date: string) {
//     if (expandedDates.has(date)) {
//         if (!groupedMessages.find(group => group.date === date)?.isRecent) {
//             expandedDates.delete(date);
//         }
//     } else {
//         expandedDates.add(date);
//     }
// }



   function getRandomBrightColor(tagName: string): string {
    const hash = tagName.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const h = hash % 360;
    return `hsl(${h}, 70%, 60%)`;
  }

  // Toggle tag selection and update filtered threads
  async function toggleTagSelection(tagId: string) {
    if (selectedTagIds.has(tagId)) {
      selectedTagIds.delete(tagId);
    } else {
      selectedTagIds.add(tagId);
    }
    selectedTagIds = selectedTagIds; // Trigger reactivity
    filterThreads();
  }

  // Filter threads based on selected tags
  function filterThreads() {
    if (selectedTagIds.size === 0) {
      // Show all threads if no tags selected
      filteredThreads = threads;
    } else {
      // Filter threads that have ANY of the selected tags
      filteredThreads = threads.filter(thread => {
        // Get all tags associated with this thread
        const threadTags = availableTags
          .filter(tag => tag.selected_threads?.includes(thread.id))
          .map(tag => tag.id);
        
        // Check if thread has any of the selected tags
        return Array.from(selectedTagIds).some(selectedTagId => 
          threadTags.includes(selectedTagId)
        );
      });
    }
  }

  // Create a reactive statement to update filtered threads when dependencies change
  $: {
    filteredThreads = selectedTagIds.size === 0 ? threads : filteredThreads;
  }

  // Update the thread display logic - replace threads with filteredThreads
  $: groupedThreads = filteredThreads.reduce((acc, thread) => {
    const group = getThreadDateGroup(thread);
    if (!acc[group]) acc[group] = [];
    acc[group].push(thread);
    return acc;
  }, {} as Record<string, Threads[]>);

  $: orderedGroupedThreads = groupOrder
    .filter(group => groupedThreads[group] && groupedThreads[group].length > 0)
    .map(group => ({ group, threads: groupedThreads[group] }));

    async function saveSelectedTags() {
      if (currentThreadId && currentThread) {
        const selectedTags = availableTags
          .filter(tag => tag.selected)
          .map(tag => `${tag.name} #${tag.color}`);
        await updateThread(currentThreadId, { tags: selectedTags });
        currentThread.tags = selectedTags;
      }
    }

  async function toggleTag(tag: Tag) {
    if (!currentThreadId) return;

    try {
      const isCurrentlySelected = tag.selected_threads?.includes(currentThreadId);
      let updatedSelectedThreads: string[];

      if (isCurrentlySelected) {
        updatedSelectedThreads = tag.selected_threads.filter(id => id !== currentThreadId);
      } else {
        updatedSelectedThreads = [...(tag.selected_threads || []), currentThreadId];
      }

      // Update local state immediately
      availableTags = availableTags.map(t => 
        t.id === tag.id 
          ? { ...t, selected_threads: updatedSelectedThreads } 
          : t
      );

      // Update in PocketBase
      const updatedTag = await pb.collection('tags').update(tag.id, {
        selected_threads: updatedSelectedThreads
      });

      console.log('Tag toggled successfully:', updatedTag);
    } catch (error) {
      console.error('Error toggling tag:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      // Revert local state if PocketBase update fails
      refreshTags();
    }
  }

  async function updateThreadTags() {
  if (!currentThreadId || !currentThread) return;

  try {
    const updatedThread = await pb.collection('threads').getOne<Threads>(currentThreadId, {
      expand: 'tags'
    });

    currentThread = updatedThread;
    console.log('Thread tags updated:', updatedThread.tags);
  } catch (error) {
    console.error('Error updating thread tags:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

async function refreshTags() {
  try {
    const records = await pb.collection('tags').getFullList<Tag>({
      sort: 'name',
      expand: 'selected_threads'
    });
    availableTags = records;
    console.log("Refreshed tags:", availableTags);
  } catch (error) {
    console.error('Error refreshing tags:', error);
  }
}

$: showThreadList = $threadsStore.showThreadList;

// Call this function when the currentThreadId changes
$: if (currentThreadId) {
  refreshTags();
}
  
</script>

  <div class="chat-interface">
    <div class="threads-container" 
      transition:fly="{{ y: 300, duration: 300 }}" 
      class:thread-list-visible={showThreadList}
      >
      {#if showThreadList}
      <div class="thread-list" transition:fly="{{ y: 300, duration: 300 }}">
        <ThreadListTags
        {availableTags}
        {selectedTagIds}
        {editingTagId}
        {editingTagIndex}
        on:toggleSelection={({ detail }) => toggleTagSelection(detail.tagId)}
        on:createTag={({ detail }) => createTag(detail.name)}
        on:tagUpdated={({ detail }) => {
          const tagIndex = availableTags.findIndex(t => t.id === detail.tag.id);
          if (tagIndex !== -1) {
            availableTags[tagIndex] = detail.tag;
            availableTags = [...availableTags];
          }
        }}
        on:deleteTag={({ detail }) => handleDeleteTag(detail.tagId)}
      />
        <h3>
          {$t('chat.prompts')}
        </h3>

      <PromptCatalog 

      on:select={(event) => {
        showPromptCatalog = !showPromptCatalog;

        console.log('Parent received selection from catalog:', event.detail);
      }}
    />
    <h3>
      {$t('threads.threadHeader')}
    </h3>
        <div class="thread-actions">
          <div class="search-bar">
              <Search size={30} />
              <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search threads..."
              />
          </div>
          <button 
          class="new-button"
            on:click={async () => {
              if (isCreatingThread) return;
              
              const newThread = await handleCreateNewThread();
              if (newThread) {
                // Hide prompt catalog and show chat
                showPromptCatalog = false;
              }
            }}
            disabled={isCreatingThread}
          >
            {#if isCreatingThread}
              <div class="spinner2">
                <Bot size={80} class="bot-icon" />
              </div>
            {:else}
              <MessageCirclePlus size={30} />
            {/if}
        </button>
          
        </div>

        <div class="thread-catalog">

          {#each orderedGroupedThreads as { group, threads }}
          <div class="thread-group">
            <div class="thread-group-header">{group}</div>

            {#each threads as thread}
              <button class="thread-button"
                on:click={() => handleLoadThread(thread.id)}
                class:selected={currentThreadId === thread.id}
              >
              <div class="thread-card">
                <span class="thread-title">{thread.name}</span>
                <span class="message-count">
                  {$messageCounts.getCount(thread.id)}
                  {$t('chat.messagecount')}
                </span>
                  <span class="thread-time">
                    {new Date(thread.updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span class="delete-thread-button" on:click={(e) => handleDeleteThread(e, thread.id)}>
                    <X size={14} />
                  </span>
                </div>
              </button>

            {/each}
            
          </div>
          {/each}
        </div>

      </div>
      {/if}
      <div class="chat-container" on:scroll={handleScroll}>
        <div class="thread-info" class:minimized={isMinimized}>


          {#if currentThread}
            <!-- <button class="btn-back" on:click={goBack}>
              <ChevronLeft size={30} />
            </button> -->
            {#if isEditingThreadName}
              <input class="tag-item"
                bind:value={editedThreadName}
                on:keydown={(e) => e.key === 'Enter' && submitThreadNameChange()}
                on:blur={() => isEditingThreadName = false}
                autofocus
              />
              <span class="save-button" on:click={submitThreadNameChange}>
                <Save />
              </span>
            {:else}
            <div class="title-container">
              {#if isEditingThreadName}
                <input
                  bind:value={editedThreadName}
                  on:keydown={(e) => e.key === 'Enter' && submitThreadNameChange()}
                  on:blur={submitThreadNameChange}
                  autofocus
                />
              {:else}
                <h1 on:click={startEditingThreadName}>
                  {currentThread.name}
                </h1>
              {/if}
              <span>{messages.length}
                {$t('chat.messagecount')}
              </span>

            </div>
            {/if}
      
            {#if !isMinimized}
              <div transition:slide={{duration: 300, easing: cubicOut}}>
                <ThreadTags
                  {availableTags}
                  {currentThreadId}
                  {showTagSelector}
                  {isTags}
                  on:toggleTag={({ detail }) => toggleTag(detail.tag)}
                  on:toggleSelector={() => {
                    showTagSelector = !showTagSelector;
                    isTags = !isTags;
                  }}
                />
              </div>
          {/if}
          {:else}
            <h1>{$t('threads.selectThread')}</h1>

          {/if}
        </div>
          <div class="chat-content" in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}" bind:this={chatMessagesDiv}>
            {#if isLoadingMessages}
              <div class="loading-overlay">
                <div class="spinner"></div>
                <p>{$t('chat.loading')}</p>
              </div>
            {/if}
            <div class="chat-messages" in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}">
              {#each groupMessagesByDate(chatMessages) as { date, messages }}
                <div class="date-divider" on:click={() => toggleDateExpansion(date)} transition:slide>
                    {formatDate(date)}
                    {#if expandedDates.has(date)}
                        <ChevronUp />
                    {:else}
                        <ChevronDown />
                    {/if}
                </div>
                  
                {#if expandedDates.has(date)}

                  {#each messages as message (message.id)}
                    <div class="message {message.role}" class:latest-message={message.id === latestMessageId} in:fly="{{ y: 20, duration: 300 }}" out:fade="{{ duration: 200 }}">
                      <div class="message-header">
                        {#if message.role === 'user'}
                          <div class="avatar-container">
                            {#if avatarUrl}
                              <img src={avatarUrl} alt="User avatar" class="avatar" />
                            {:else}
                              <div class="avatar-placeholder">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-user"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                              </div>
                            {/if}
                          </div>
                          <span class="role">{username}</span>
                          <div class="message-time">
                            {#if message.created}
                              {new Date(message.created).toLocaleTimeString()}
                            {:else}
                              Time not available
                            {/if}
                          </div>
                        {:else if message.role === 'thinking'}
                          <span class="role">
                            <Bot size="50" color="white" />
                          </span>
                        {:else}
                          <!-- <span class="role">
                            <Bot size="40" color="white" />
                            AI
                          </span> -->
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
                        <p>{@html message.content}</p>
                      {:else}
                      <p class:typing={message.isTyping && message.id === latestMessageId}>{message.content}</p>
                      {/if}
                      
                      {#if message.role === 'thinking'}
                        <div class="thinking-animation">
                          <span>
                            <Bot size="40" color="white" />
                          </span>
                          <span>
                            <Bot size="40" color="gray" />
                          </span>
                          <span>
                            <Bot size="40" color="white" />
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
                            // Handle notifications if you have a notification system
                            console.log(event.detail);
                          }}
                        />
                      </div>
                    {/if}

                    </div>
                  {/each}
                  <div class="date-divider bottom" on:click={() => toggleDateExpansion(date)} transition:slide>
                    <ChevronUp size={30} />
                  </div>
                  {/if}
              {/each}
              
            </div>
          </div>
        </div>
      </div>  

      <button class="scroll-bottom-btn" on:click={scrollToBottom}>
        <ChevronDown size={24} />
      </button>

    <div class="input-container">
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
    ></textarea>
      <div class="btn-row-right"  transition:slide>
        <span>
          <Paperclip size="30" color="white" />
        </span>
        <span on:click={() => !isLoading && handleSendMessage()} disabled={isLoading}>
          <Send color="white" />
        </span>
      </div>

      {#if currentStage === 'summary'}
        <button on:click={toggleNetworkVisualization}>
          {showNetworkVisualization ? 'Hide' : 'Show'} Network
        </button>
      {/if}
    </div>
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
	@use "src/themes.scss" as *;
  * {
    /* font-family: 'Merriweather', serif; */
    /* font-family: 'Roboto', sans-serif; */
    /* font-family: 'Montserrat'; */
    /* color: var(--text-color); */
    font-family: var(--font-family);
  }
    .threads-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      margin-left: 64px;
      width: calc(100% - 64px);
      /* position: relative; */

    }
    .chat-container {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: all 0.3s ease-in-out;
      height:94%;
      overflow-y: auto;
      overflow-x: none;
      /* left: 20%; */
      width: 100%;
      padding: 10px;

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

  .title-container {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    height: 40px;
    padding: 0 20px;
    transition: all 0.3s ease;
    user-select: none;
    border-radius: 20px;
  }

  .title-container:hover {
    background-color: var(--bg-color);
  }

  .title-container span {
    color: gray;
    font-size: 16px;
  }

  .title-container h1 {
    width: auto;
    transition: all 0.3s ease;
  }

  .title-container h1:hover {
    cursor:text;
    color: rgb(113, 249, 243);
  }
  .thread-info input  {
    background-color: var(--secondary-color);
    border-bottom: 1px solid rgb(134, 134, 134);
    width: auto;
    height: 40px;
    padding: 0 20px;
    font-size: 24px;
    border-radius: var(--radius-l);

  }
    .chat-messages {
      flex-grow: 1;
      overflow-y: auto;
      overflow-x: hidden;
      /* padding: 10px; */
      display: flex;
      gap: 4px;
      flex-direction: column-reverse;
      align-items: stretch;
      scrollbar-width:1px;
      scrollbar-color: var(--secondary-color) transparent;
      scroll-behavior: smooth;
      margin-bottom: 100px;
      padding-top: 20px;
      height: 90vh;
      width: 100%;
      border-radius: 50px;
      padding-bottom: 40px;
      border: 2px solid var(--bg-color);
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

    }
    
    .chat-messages::before {
      display: flex;
      flex-direction: column;
    }
    .chat-messages::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: 30px;
      width: 100%;
      pointer-events: none;
      /* border-radius: 20px; */
    }

    span.edit-tag {
      background-color: transparent;
      scale: 0.8;
      border: none;
      position: relative;
      transition: all ease 0.3s;
      color: rgb(131, 131, 131);
    }

    span.edit-tag:hover{
      color: rgb(0, 248, 166);
    }
    .chat-messages::before {
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

    /* .chat-messages::after {
  bottom: 90px;
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
  z-index: 1;
} */
  
    .chat-messages::-webkit-scrollbar {
      width: 10px;
    }
  
    .chat-messages::-webkit-scrollbar-track {
      background: #f1f1f1;
      
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 5px;
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
  
    .message {
    display: flex;
    flex-direction: column;
    align-items: flex-start;  /* Change this from 'stretch' to 'flex-start' */
      padding: 2rem;
    /* border-radius: 20px; */
    font-size: 18px;
    /* font-weight: 300; */
    font-weight: 100;
    letter-spacing: 1px;
    line-height: 1.5;
    /* font-family: 'Merriweather', serif; */
    /* font-family: 'Roboto', serif; */

    transition: all 0.3s ease-in-out;

  }

  .message p {
  font-size: calc(10px + 1vmin);
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-wrap: break-word;
  hyphens: auto;
  width: 100%;
  text-align: left; 
}
  
    .message::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
      opacity: 0.5;
      z-index: -1;
      transition: opacity 0.3s ease;
    }
  
    .message:hover::before {
      opacity: 0.8;
      background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);

    }
  
    .role {
        align-self: flex-start;
        margin-bottom: 5px;  /* Add some space between the role and the message content */
}

  /* Adjust assistant message alignment */
  .message.assistant {
    display: flex;
    /* position: relative; */
    align-self: flex-end;
    /* background-color: #2e3838; */
    /* border-bottom: 5px solid #242d2d;
    border-right: 5px solid #242d2d;
    border-left: 2px solid #242d2d;
    border-top: 2px solid #242d2d; */
    /* border-bottom: 2px solid #585858; */
    border-bottom-right-radius: 20px;
    color: white;
    /* font-style: italic; */
    /* width: auto;  Allow the message to shrink-wrap its content */
    /* margin-left: 200px; */
    height: auto;
    /* border: 1px solid black; */
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

  }

  .message.assistant p {
      /* font-weight: 600; */
      font-size: 1.2rem;
      color: var(--text-color);
      height: auto;
    }

  /* .message.assistant:hover {
      opacity: 0.8;
      background: radial-gradient(circle at center, rgba(204, 213, 213, 0.2) 0%, rgba(2, 28, 28, 0.6) 100%);
      /* font-size: 40px; */
  
    .message.options {
      align-self: flex-end;
      background-color: transparent;
      padding: 0;
      margin-right: 20px;
      max-width: 80%;  /* Limit the maximum width of the message */

      box-shadow: none;
      font-style: italic;
      font-size: 30px;
      font-weight: bold;
    }
  
    .message.user {
      display: flex;
    /* position: relative; */
    align-self: flex-start;
      margin: 1rem;
      /* background-color: #2e3838; */
    /* border-bottom: 5px solid #242d2d;
    border-right: 5px solid #242d2d;
    border-left: 2px solid #242d2d;
    border-top: 2px solid #242d2d; */
    /* border-bottom: 2px solid #585858; */
    border-bottom-right-radius: 20px;
    color: var(--text-color);
    /* font-style: italic; */
    /* width: auto;  Allow the message to shrink-wrap its content */
    /* margin-left: 200px; */
    /* border: 1px solid black; */
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    background: var(--bg-color);
      border-radius: 20px;
      border: 1px solid var(--secondary-color); 
      width: calc(94% - 2rem);


    }


    .message.user p {
      /* font-weight: 600; */
      font-size: 1.2rem;
      width: 100%;
      margin-top: 1rem;


    }




    .message p {
      font-size: calc(10px + 1vmin);
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-wrap: break-word;
      hyphens: auto;
    }


    .options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
      margin-bottom: 20px;

    }
  
    .options button {
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
  }

  .options button:hover {
    background-color: #e0e0e0;
    transform: translateY(-2px);
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

  .message.thinking {
    display: flex;
    flex-direction: row;
    align-self: center;
    align-items: center;
    justify-content: center;
    /* gap: 10px; */
    padding: 20px;
    width: auto;
    height: auto;
    /* color: #FFD700; */
    /* background: #4B0082; */
    font-style: italic;
    /* animation: pulsate 1.5s infinite alternate; */
    border-radius: 50px;
    /* margin-left: 20px; */
  }

  .message.thinking p {
    display: flex;
    flex-wrap: wrap;
    font-size: 20px;
    /* width: 80%; */
        /* animation: pulsate 1.5s infinite alternate; */

  }

  .role {
    font-weight: bolder;
    /* align-self: flex-start; */
    /* margin-bottom: 5px;  Add some space between the role and the message content */
  }

  .thread-info.minimized {
  max-height: 50px; /* Adjust this value to fit your h1 */
  overflow: hidden;
}

.thread-info h1 {
  margin: 0;
  padding: 10px 0;
  color: var(--text-color)

}

.thread-info.minimized h1 {
  font-size: 1.2em; /* Smaller font size when minimized */
}


.thread-actions {
  display: flex;
  flex-direction: row;
  width: 100%;
  background: var(--bg-gradient-right);
  border-radius: var(--spacing-md);
  margin-bottom: 0.5rem;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  // padding: var(--spacing-sm);
  border-radius: var(--radius-m);
  height: var(--spacing-xl);
  width: 80%;
  height: auto;
  margin: 0 var(--spacing-md);

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


button.new-button {
  background-color: var(--primary-color);
  font-size: var(--font-size-s);
  font-weight: bold;
  cursor: pointer;
  transition: all ease 0.3s;
  width: 20% !important;
  padding: var(--spacing-md);
  display: flex;
  margin: var(--spacing-sm) 0;
  user-select: none;
  gap: var(--spacing-sm);

}

button.new-button:hover, 
button.add-tag:hover {
  background-color: var(--tertiary-color);
  
}

.new-button svg {
  color: red;
}

span.new-button {
  border: none;
    cursor: pointer;
    display: flex;
    position: relative;
    justify-content: center;
    transition: all ease 0.3s;
    border-radius: 50%;
    width: auto;
    height: auto;
    display: flex;


}

.thread-group {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: var(--spacing-sm);
  backdrop-filter: blur(20px);
  border-radius: 10px;
  scrollbar-width:1px;
    scrollbar-color: #c8c8c8 transparent;
    scroll-behavior: smooth;

}

.thread-group-header {
  // margin-bottom: 10px;
  color: var(--placeholder-color);
  justify-content: left;
  display: flex;
  font-size: var(--font-size-s);
  padding: var(--spacing-sm) var(--spacing-sm);
  border-top: 1px solid var(--bg-color);
  text-align: right;
  
  text-transform:uppercase;
}

.thread-catalog {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 20px;
  backdrop-filter: blur(20px);
  background: var(--bg-gradient-left);
  border-radius: 10px;
  overflow-y: auto;
  scrollbar-width:1px;
  scrollbar-color: var(--text-color) transparent;
  scroll-behavior: smooth;
}

  .message-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
  @media (min-width: 300px) {
      .chat-container {
        /* width: 50%; */
        height: 90vh;
        /* margin-left: 25%; */
        /* margin-right: 25%; */
        overflow-x: hidden;
      }

      .threads-container {
          /* background-color: red; */
        }
      .thread-list {
          /* width: 25%; */
          height: 80%;
          border-top-left-radius: 50px;
          overflow-y: scroll;
          overflow-x: none;
          scrollbar-width:1px;
          scrollbar-color: #c8c8c8 transparent;
          display: flex;
          background-color: var(--primary-color);
        }

        .thread-list-visible .chat-container {
          overflow-y: auto;
          margin-right: 0;
          width: 66%;
          left: calc(1% + 64px);
        }

        .thread-list-visible .thread-toggle {
          left: 10px;
          
        }
    }


    @keyframes glowy {
    0% { box-shadow: 0 0 0 #2b2b29, 0 0 2px #4b505d; }
    0% { box-shadow: 0 1px 0 #2b2b29, 0 0 15px #4c4e55; }

    100% { box-shadow: 0 0 1px #474539, 0 0 50px #32322e; }
  }

  @keyframes pulsate {
    0% { box-shadow: 0 0 0 var(--secondary-color), 0 0 4px var(--tertiary-color); }
    
    100% { box-shadow: 0 0 1px var(--secondary-color), 0 0 6px var(--bg-color); }
  }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  @keyframes blink {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes blink-slow {
    0% { opacity: 0.2; }
    50% { opacity: 0.7; }
    100% { opacity: 0.2; }
  }

  .thinking-animation {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: left;
    margin-top: 10px;
  }

  .thinking-animation span {
    width: 10px;
    height: 10px;
    margin: 0 5px;
    padding: 10px;
    background-color: transparent;
    /* border-radius: 50%; */
    animation: bounce 1s infinite ease-in-out both;
  }

  .thinking-animation span:nth-child(1) { animation-delay: -0.32s; }
  .thinking-animation span:nth-child(2) { animation-delay: -0.16s; }

  .input-container {
    display: flex;
    position: fixed;
    width: 98%;
    padding: 1rem;
    left: 0;
    bottom: 0;
    justify-content: center;
    align-items: flex-end;
    /* margin-bottom: 0; */
    /* border-radius: 70%; */
    background: transparent;
    /* background: linear-gradient(45deg, rgba(0, 0, 0, 0.8) 50%, rgba(128, 128, 128, 0.8) 100%); */
    display: flex;
    /* border: 1px solid rgb(44, 44, 44); */
    /* background-color: rgb(17, 56, 39); */

  }

  input {
    flex-grow: 1;
    margin-right: 20px;
    padding: 10px;
    height: 50px;
    font-size: 18px;
    border-radius: 25px;
    background-color: #000000;
    color: #818380;
    border: none;
    transition: all ease-in 0.3s;
    outline: none;
  }

  .input-container input:focus {
    border: 2px solid blue;
    background-color: lightgrey;
    color: black;
    font-size: 24px;
}

.input-container textarea {
    border: 1px solid rgb(54, 54, 54);
    background-color:var(--bg-gradient-left);
    color: white;
    animation: pulsate 4.5s infinite alternate;
    display: flex;
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    z-index: 1000;
    backdrop-filter: blur(40px);
  }

.input-container textarea:focus {
    border: 1px solid rgb(54, 54, 54);
    background-color:var(--bg-gradient-r);
    color: white;
    animation: glowy 1.5s infinite alternate;
    display: flex;
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    z-index: 1000;
    backdrop-filter: blur(40px);
  }

  button {
    display: flex;
    
    // width: 60px;
    // height: 60px;
    // padding: 10px;
    // background-color: #21201d;    
    // color: white;
    /* border: 2px solid rgb(0, 0, 0); */
    // border: none;
    // border-radius: 30px;
    // transition: background-color 0.3s;
  }

  .highlight {
    background-color: rgba(255, 255, 0, 0.3);
    border-radius: 3px;
    padding: 0 2px;
    font-weight: bold;
  }

  .network-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .network-container {
    position: absolute;
    margin-left: auto;
    margin-right: auto;
    top: 30%;
    width: 80%;
    height: 50%;
    background-color: #fff;
    border-radius: 10px;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    padding: 20px;
    display: flex;
    align-items: stre;
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

.btn-row-right {
    display: flex;
    flex-direction: column;
    height: auto;
    justify-content: center;
    align-items: center;
    transition: all 0.3s ease;
    padding: 1rem;
    z-index: 1000;
  }

  .btn-row-right span {
    height: 60px;
    width: 60px;
    padding: 4px;
    justify-content: center;
    align-items: center;
    background-color: transparent;
    border-radius: 50%;
    transition: all 0.3s ease;
    background-color: var(--primary-color);
  }

  .btn-row-right span:hover {
    background-color: var(--tertiary-color);
    box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);

  }

  .btn-row-right.expanded {
    opacity: 1;
    bottom: 140px;
    gap: 1rem;
    right: 2rem;
    display: flex;
  }

  .btn-row-right > *:not(:last-child) {
    display: none;
  }

  .btn-row-right.expanded > * {
    display: flex;
  }

  .btn-row-right:hover {
    opacity: 1;
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
    width: 100%;
    min-height: 60px;
    margin-left: 4rem;
    /* min-height: 60px; Set a minimum height */
    /* max-height: 1200px; Set a maximum height */
    padding: 1rem;
    text-justify: center;
    justify-content: center;
    resize: none;
    font-size: 24px;
    letter-spacing: 1.4px;
    border: 1px solid rgba(53, 63, 63, 0.5);   
    border-radius: 20px;
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
  }


  textarea:focus {
    /* margin-right: 5rem; */
    outline: none;
    border: 2px solid #000000;
    color: white;
    transform: translateY(0) rotate(0deg); 
    font-size: 30px;
    padding: 100px 70px;
    /* height: 300px; */
    display: flex;
    /* min-height: 200px; */
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

  .auth-container {
    background-color: #fff;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .message-header {
		display: flex;
		gap: 10px;
    justify-content: left;
    align-items: center;
    width: 100%;
  }

span {
  display: flex;
  justify-content: left;
  align-items: center;
  /* gap: 10px; */
}

.message-count {
  color: var(--placeholder-color);
}

.thread-tags span {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  /* background-color: blue; */
  color: white;
  /* width: 100px; */
  font-size: 16px;
  padding: 10px;
}

.thread-tags span:hover {
  background-color: gray;

}

.avatar-container {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  /* margin-right: 10px; */
}

.avatar, .avatar-placeholder {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #2c3e50;
}

.avatar-placeholder svg {
  width: 20px;
  height: 20px;
  color: white;
}

.message-time {
    font-size: 0.8em;
    color: #888;
    text-align: right;
    justify-content: right;
    width: 90%;
    margin-top: 5px;
    right: auto;
  }

  .chat-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    // width: 50%;
    margin: 0 1rem;
    // margin-left: 25%;
    padding: 0 10px;
    overflow-y: hidden;
    overflow-x: hidden;
    boreder-radius: var(--radius-l);
    transition: all ease 0.3s;
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
  }



  .thread-list {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    overflow-x: none;
    overflow-y: hidden;
    position: fixed;
    padding: 20px 10px;
    border-top-left-radius: 50px;
    top: 1rem;
    left: 64px;
    bottom: 60px;
    width: 20%;
    height: 86%;
    border-radius: var(--radius-l);
    transition: all 0.3s ease-in-out;
    scrollbar-width:1px;
    scrollbar-color: #c8c8c8 transparent;
    scroll-behavior: smooth;
  }


  /* padding: 20px 10px; */
.thread-list.hidden {
  display: none;
  transform: translateX(-100%);
}


.thread-list-visible {
  /* background-color: blue; */
}
.thread-list-visible .chat-container {
  /* margin-left: 300px; */
}

.thread-button {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  justify-content: space-between;
  // align-items: left;
  width: 90%;
  // left: 5%;
  /* width: 100%; */
  // position: relative;
  /* border: 10px solid rgb(0, 0, 0); */
  // border-left: 14px solid var(--secondary-color);
  // border-top: 1px solid  var(--bg-color);
  // background-color: var(--tertiary-color);
  // border-bottom: 14px solid  var(--bg-color);
  // border-right: 1px solid rgb(59, 59, 59);
  // border-bottom-left-radius: 0px;
  margin-bottom: var(--spacing-xs);
}

  .thread-list button {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      background-color: transparent;
      // margin-left: 5%;
      // padding: 20px 20px;
      border: none;
      // margin-bottom: 10px;
      // margin-left: 10px;
      // border-radius: 10px;
      /* margin-bottom: 5px; */
      /* text-align: left; */
      /* border-bottom: 1px solid #4b4b4b; */
      cursor: pointer;
      color: #fff;
      transition: background-color var(--transition-speed);
      // transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
      border-radius: var(--radius-m);
      // letter-spacing: 4px;
      // font-size: 20px;
      font-family: var(--font-family);
    width: 100%;
      &:hover {
        background: var(--tertiary-color);
      }
  }
  .thread-list button.selected {
    background-color: var(--secondary-color);
    font-weight: bold;
  }

  .thread-info {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    flex-wrap: wrap;
    /* align-items: center; */
    // padding: 0 20px;
    font-size: 20px;
    color: white;
    /* height: 140px; */
    /* gap: 20px; */
    /* background-color: black; */
  }

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

    .thread-card {
      display: flex;
      flex-direction: column;
      align-items: left;    
      text-align: left;
      gap: 2px;
      flex-grow: 1;
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .thread-title {
      font-weight: bold;
      color: var(--text-color);
      font-size: var( --font-size-s);
    }

    .thread-message {
      font-size: var(--font-size-xs);
      color: var(--placeholder-color);

    }

    .thread-time {
      font-size: var(--font-size-xs);
      color: var(--placeholder-color);
    }

  .landing-footer {
    display: flex;
    flex-direction: row;
    width: 98%;
    margin-left: 1%;
  }

  .thread-list .add-button {
    background-color: rgb(71, 59, 59);
    font-style: italic;
    /* font-weight: bolder; */
    border-bottom: 1px solid #633c3c;
    border-radius: 10px;
    margin-bottom: 2rem;
  }

  .thread-list .add-button:hover {
    background: var(--tertiary-color);
    transform:  translateX(5px);          
    letter-spacing: 4px;
    /* padding: 230px 0; */
    /* height: 300px; */
    animation: pulsate 0.5s infinite alternate;

  }

    .add-button {
      background-color: #3c3b35;
      font-style: italic;
      border: none;
      border-radius: 10px;
      margin-bottom: 15px;
      width: 90%;
      padding: 10px;
      color: white;
      font-size: 16px;
      cursor: pointer;
      
      transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 0.3s);
      user-select: none;
    }

  .add-button:hover {
    background-color: #4a4a4a;
    transform: scale(1.0) translateX(5px) rotate(520deg);          
    letter-spacing: 4px;
    padding: 20px;
        
  }

    .thread-toggle {
    /* background-color: #283428; */
    color: var(--text-color);
    background: var(--bg-gradient-right);
    padding: 4px;
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
    /* border: 2px solid #506262; */
    transition: all 0.3s ease-in-out;
    overflow: hidden;
    user-select: none;
    }

    .thread-list-visible .thread-toggle {
      left: 310px;
    }

  .thread-toggle:hover {
    box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
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

  .btn-back {
  position: absolute;
  left: 0;
  top: 25%;
  height: 50%;
  // top: 3rem;
  background: transparent;
  justify-content: center;
  align-items: center;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  border-radius: var(--radius-l);
  transition: all 0.3s ease;
  z-index: 1000;

  &:hover {
    background-color: var(--secondary-color);
    transform: translateX(10px);
  }

  &:active {
  }
}

  .scroll-bottom-btn {
    position: fixed;
    bottom: 120px;
    right: 0;
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
    margin-right: 20px;
  }

  .scroll-bottom-btn:hover {
    background-color: #000000;
  }

  .thread-button-container {
    display: flex;
    align-items: center;
    width: 100%;
  }

  span.delete-thread-button   {
    border: none;
    color: #606060;
    cursor: pointer;
    padding: 6px;
    height: 30px;
    width: 30px;
    display: flex;
    position: absolute;
    right: 0;
    transition: all ease 0.3s;
  }

  span.delete-thread-button:hover {
    height: 30px;
    width: 30px;
    color: red;
    transform: scale(1.3);

  }

  .thread-stats-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;

    color: #fff;
    
  }

  .tag-selector.tag-item {
    background-color: red;
  }

  .tag-selector-toggle {
    background: none;
    border: none;
    cursor: pointer;
    color: white;
    position: absolute;
    right: 1rem;
    top: 2.1rem;
  }

  .tag-selector-toggle:hover {
    color: rgb(69, 171, 202);
    background-color: transparent;

  }









  .tag-row {
  display: flex;
  flex-wrap: nowrap;
  justify-content: right;
  align-items: right;
  gap: 5px;
  margin-top: 1rem;
  /* height: 50px; */
  border-radius: 20px;
  transition: all ease 0.3s;
  margin-right: 2rem;
}

  .tag-row:hover {
  display: flex;
  flex-wrap: nowrap;
  justify-content: right;
}

.date-divider-row {
  display: flex;
  justify-content: space-between; /* Align date dividers side by side */
  margin-bottom: 10px; /* Space between date dividers */
}


  .date-divider {
    display: flex;
    flex-direction: row;
    justify-content: center;

    align-items: center;
    padding: 0.5rem;
    gap: 2rem;
    // background: var(--bg-gradient-left);
    /* background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 0%, rgba(128, 128, 128, 0) 100%); */
    /* border-radius: 5px; */
    cursor: pointer;
    // border-top: 1px solid rgb(82, 82, 82);
    border-bottom: 1px solid var(--secondary-color);
    backdrop-filter: blur(100px);
    // background: var(--bg-color);
    border-radius: 30px;
    border-top-left-radius: 30px;
    border-top-right-radius: 30px;
    transition: all ease 0.15s;
    color:var(--text-color);
    background: var(--bg-gradient-left);
    user-select: none;
    width: auto;
    margin-left: calc(25% + 300px);
    width: 300px;
    /* backdrop-filter: blur(10px); */

  }

  .date-divider:hover{
    transform: translateY(-5px) rotate(0deg); 
    background: var(--bg-gradient-left);
    color: var(--tertiary-color);
  }

  .date-divider.bottom {
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--bg-gradient-right);
    border: 0;
    padding: 0;
    background: none;
    // background: linear-gradient(to top, rgba(255, 255, 255, 0.1) 0%, rgba(128, 128, 128, 0) 59%);
    backdrop-filter: none;
    border-top: none;
    border-top-left-radius: none;
    border-top-right-radius: none;
    border-bottom: none;
    border-bottom-left-radius: 30px;
    border-bottom-right-radius: 30px;
    /* background-color: rgba(255, 255, 255, 0.1); */
    /* border-radius: 5px; */
    cursor: pointer;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h1 {
    font-size: 24px;
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
    z-index: 1000;
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
        width: 30px;
        height: 30px;
        color: rgb(71, 69, 69);
        border: 5px dashed #363f3f;
        border-radius: 50%;
        position: relative;
        /* background-color: yellow; */
        animation: nonlinearSpin 4.2s infinite;
        animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);

    }

    .bot-icon {
        width: 50%;
        height: 50%;
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
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
  .threads-container {
    flex-direction: column;

  }



  .new-tag-input {
    display: flex;
    margin-bottom: 10px;
    width: 90%;
    margin-left: 3.5rem;
    justify-content: space-between;

  }

  .new-tag-input input {
    flex-grow: 1;
    border: 1px solid #ccc;
    border-radius: 15px;
    background-color: var(--bg-color);
    padding: 5px 10px;
    color: white;
    font-size: 16px;
  }

  .tag-list {
    margin-left: 3rem;

  }

  .thread-info .add-button {
      background-color: rgb(189, 16, 16);
      font-style: italic;
      /* font-weight: bolder; */
      border-bottom: 1px solid #633c3c;
      border-radius: 10px;
      margin-bottom: 2rem;
    }

  .thread-list .add-button {
      font-style: italic;
      /* font-weight: bolder; */
      border-bottom: 1px solid #633c3c;
      border-radius: 10px;
      margin-bottom: 2rem;
      margin-left: 3.5rem;
      width: 90%;
      justify-content: center;
    }
  .thread-list {
    position: fixed;
    top: 60px;




    transform: translateX(-100%);
    transition: transform 0.3s ease-in-out;
    /* z-index: 1000; */
  }

  .thread-list-visible .thread-list {
    transform: translateX(0);
  }

  .thread-list-visible .chat-container {
    display: none;
  }
  .thread-list-visible .thread-toggle {
    left: 10px;
  }

  h1 {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 16px;
    padding: 10px;
    border-radius: 5px;
  }
.threads-container {
    /* background-color: red; */
    width: 100%;

  }
.thread-list {
    width: 100%;
    padding: 0;

  }

  .chat-messages {
    width: auto;
    margin-right: 1rem;
    
  }

  .thread-list-visible .chat-container {
    margin-left: 0;
    display: none;
    
  }

  .thread-list-visible .thread-toggle {
    left: 10px;
  }

  .input-container {
    /* background-color: red; */
  }
    }

@media (min-width: 769px) {
  .threads-container {
    display: flex;
  }

  .thread-list {
    width: 300px;
    transform: translateX(0);
  }

  .thread-list-visible .chat-container {
    margin-left: calc(20% + 64px);
  }

  .chat-container {
    flex-grow: 1;
    margin-left: 0;
    transition: margin-left 0.3s ease-in-out;
    width: 98%;
  }

  .thread-toggle {
    /* display: none; */
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

.btn-col-left:hover {
  width: 96%;
}
  .scroll-bottom-btn {
    bottom: 200px;
  }

  .thread-toggle {
    bottom: 120px;
  }
//   button.new-button  {
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

  .input-container {
    margin-bottom: 80px;
    width: 98%;
    margin-left: 0;
  }

    .input-container textarea:focus {
      border: 1px solid rgb(54, 54, 54);
      background-color: rgb(0, 0, 0);
      color: white;
      font-size: 20px;
      animation: glowy 1.5s infinite alternate;
      display: flex;
      z-index: 1000;
  }

  .message.user {
    margin-right: 2rem;
    margin-left: 2rem;

    width: auto;
    align-self: flex-end;
  }
    .message.user p {
      /* font-weight: 600; */
      font-size: 1.2rem;
    }

    .date-divider {
      margin-right: 2rem;
    }

    .message.assistant  {
      display: flex;
    /* position: relative; */
    align-self: flex-end;
    /* background-color: #2e3838; */
    /* border-bottom: 5px solid #242d2d;
    border-right: 5px solid #242d2d;
    border-left: 2px solid #242d2d;
    border-top: 2px solid #242d2d; */
    /* border-bottom: 2px solid #585858; */
    border-bottom-right-radius: 20px;
    color: white;
    margin-bottom: 20px;
    /* font-style: italic; */
    /* width: auto;  Allow the message to shrink-wrap its content */
    /* margin-left: 200px; */
    margin-right: 2rem;
    margin-left: 2rem;

    width: auto;    /* border: 1px solid black; */

    }
}
@media (max-width: 1900px) {

.chat-content {
    width: auto;
    margin-left: 1rem;
    margin-top: 1rem;
    background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
    border: none;
  }

  .chat-messages {
    border: none;
    background: none;
  }
}
</style>