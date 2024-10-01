<script lang="ts">
  import { pb, currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
  import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { elasticOut } from 'svelte/easing';
  import { Send, Paperclip, Bot, Menu, Reply, Smile, Plus, X} from 'lucide-svelte';
  import { fetchAIResponse, generateScenarios, generateTasks as generateTasksAPI, createAIAgent, determineNetworkStructure, generateSummary as generateSummaryAPI, generateGuidance, generateNetwork } from '$lib/aiClient';
  import { networkStore } from '$lib/stores/networkStore';
  import { messagesStore} from '$lib/stores/messagesStore';
  import NetworkVisualization from '$lib/components/network/NetworkVisualization.svelte';
  import { Spinner } from 'flowbite-svelte';
  import { updateAIAgent, ensureAuthenticated } from '$lib/pocketbase';
  import PromptSelector from './PromptSelector.svelte';
  import type { AIModel, ChatMessage, InternalChatMessage, Scenario, Task, Attachment, Guidance, PromptType, NetworkData, AIAgent, Network, Threads, Messages, Tag} from '$lib/types';
  import Auth from '$lib/components/auth/Auth.svelte';
	import ModelSelector from './ModelSelector.svelte';
  import { fetchThreads, fetchMessagesForThread, createThread, updateThread, addMessageToThread } from '$lib/threadsClient';

import { threadsStore } from '$lib/stores/threadsStore';


  export let seedPrompt: string = '';
  export let additionalPrompt: string = '';
  export let aiModel: AIModel;
  export let userId: string;
  export let attachment: File | null = null;
  export let promptType: PromptType = 'CASUAL_CHAT';

let threads: Threads[];
let currentThreadId: string | null;
let showThreadList = true;
let updateStatus: string;
let currentThreadName: string = '';
let messages: Messages[] = [];
let quotedMessage: Messages | null = null;
let isEditingThreadName = false;
let editedThreadName = '';

let showReactions: string | null = null;  
let editingTagIndex: number | null = null;
  let newTag = '';
  let availableTags: Tag[] = [
  { id: 1, name: 'Work', color: '#FF6B6B', selected: false },
  { id: 2, name: 'Personal', color: '#4ECDC4', selected: false },
  { id: 3, name: 'Urgent', color: '#FFD93D', selected: false },
  { id: 4, name: 'Ideas', color: '#6BCB77', selected: false },
  { id: 5, name: 'Learning', color: '#4D96FF', selected: false },
];
  let selectedTagIds = new Set<number>();


  const reactions = ['😊', '👍', '❤️', '😂', '😮', '😢'];


messagesStore.subscribe(value => messages = value);

function toggleReactions(messageId: string) {
    showReactions = showReactions === messageId ? null : messageId;
  }

  
threadsStore.subscribe(state => {
  threads = state.threads;
  currentThreadId = state.currentThreadId;
  messages = state.messages;
  updateStatus = state.updateStatus;
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
  $: currentThread = threads.find(t => t.id === currentThreadId);

  $: safeAIModel = aiModel || defaultAIModel;

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

  let isAuthenticated = false;
  let showAuth = false;
  let avatarUrl: string | null = null;
  let username: string = 'You';
  let lastMessageCount = 0;
  let currentPromptType: PromptType = promptType;




$: groupedMessages = groupMessagesByDate(messages);

function groupMessagesByDate(messages: Messages[]): { date: string; messages: Messages[] }[] {
  const groups: { [key: string]: Messages[] } = {};
  messages.forEach(message => {
    const date = new Date(message.created).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });
  return Object.entries(groups).map(([date, messages]) => ({ date, messages: messages.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()) }));
}

async function addReaction(messageId: string, reaction: string) {
    try {
      const messageIndex = chatMessages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        const updatedMessage = { ...chatMessages[messageIndex] };
        updatedMessage.selectedReaction = reaction;
        updatedMessage.reactions = updatedMessage.reactions || {};
        updatedMessage.reactions[reaction] = (updatedMessage.reactions[reaction] || 0) + 1;
        
        const updatedMessages = [...chatMessages];
        updatedMessages[messageIndex] = updatedMessage;
        chatMessages = updatedMessages;

        await messagesStore.updateMessage(messageId, updatedMessage);
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
    showReactions = null;
  }

  function toggleTagCreation() {
    if (editingTagIndex !== null) {
      saveTag();
    } else {
      newTag = '';
      editingTagIndex = -1;
    }
  }

  function getRandomColor(tagName: string): string {
        const hash = tagName.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const h = hash % 360;
        return `hsl(${h}, 70%, 60%)`;
    }

  function saveTag() {
  if (newTag.trim()) {
    if (editingTagIndex === -1) {
      const newTagObject: Tag = {
        id: availableTags.length + 1,
        name: newTag.trim(),
        color: getRandomColor(newTag.trim()),
        selected: false
      };
      availableTags = [...availableTags, newTagObject];
    } else if (editingTagIndex !== null) {
      availableTags[editingTagIndex].name = newTag.trim();
    }
    newTag = '';
    editingTagIndex = null;
  }
}




    function toggleTag(tag: Tag) {
      tag.selected = !tag.selected;
      availableTags = [...availableTags]; // Trigger reactivity
      updateThreadTags();
    }

    async function updateThreadTags() {
      if (currentThreadId && currentThread) {
        const updatedTags = availableTags.filter(tag => tag.selected).map(tag => tag.name);
        await updateThread(currentThreadId, { tags: updatedTags });
        currentThread.tags = updatedTags;
      }
    }

  function addNewTag() {
  const newTag: Tag = {
    id: availableTags.length + 1,
    name: `Tag ${availableTags.length + 1}`,
    color: getRandomColor(`Tag ${availableTags.length + 1}`),
    selected: false
  };
  availableTags = [...availableTags, newTag];
}
  
  function filterThreads() {
    if (selectedTags.length === 0) {
      // Show all threads
    } else {
      // Filter threads based on selectedTags
    }
  }

  

  function getThreadDateGroup(thread: Threads): string {
    const now = new Date();
    const threadDate = new Date(thread.updated);
    const diffDays = Math.floor((now.getTime() - threadDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return 'This Week';
    if (diffDays < 30) return 'This Month';
    return 'Older';
  }

  $: groupedThreads = threads.reduce((acc, thread) => {
    const group = getThreadDateGroup(thread);
    if (!acc[group]) acc[group] = [];
    acc[group].push(thread);
    return acc;
  }, {} as Record<string, Threads[]>);

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

let expandedGroups: Set<string> = new Set();

function toggleGroupExpansion(groupId: string) {
  if (expandedGroups.has(groupId)) {
    expandedGroups.delete(groupId);
  } else {
    expandedGroups.add(groupId);
  }
  expandedGroups = expandedGroups; // Trigger reactivity
}

async function handleLoadThread(threadId: string) {
  try {
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      currentThreadName = thread.name;
      currentThreadId = threadId;
    }
    await messagesStore.fetchMessages(threadId);
    chatMessages = messages.map(msg => addMessage(msg.type === 'human' ? 'user' : 'assistant', msg.text, msg.parent_msg));
  } catch (error) {
    console.error(`Error loading messages for thread ${threadId}:`, error);
  }
}
  


afterUpdate(() => {
  if (chatMessagesDiv && chatMessages.length > lastMessageCount) {
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    lastMessageCount = chatMessages.length;
  }
});


  const dispatch = createEventDispatcher();

    function copyToClipboard(content: string) {
    navigator.clipboard.writeText(content).then(() => {
      console.log('Content copied to clipboard');
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  }

  function handleReaction(messageId: string, reaction: 'up' | 'down') {
    console.log(`Reaction ${reaction} for message ${messageId}`);
    // Implement reaction logic here
  }

  function toggleThreadList() {
    showThreadList = !showThreadList;
  }


  function getSystemMessage(promptType: PromptType): string {
    switch (promptType) {
      case 'SCENARIO_GENERATION':
        return "You are an AI assistant specialized in generating creative scenarios. Please provide detailed and imaginative scenarios based on the user's input.";
      case 'TASK_GENERATION':
        return "You are an AI assistant focused on breaking down scenarios into actionable tasks. Please generate specific, well-defined tasks based on the given scenario.";
      case 'AGENT_CREATION':
        return "You are an AI assistant designed to create AI agent profiles. Please generate detailed agent profiles based on the provided scenario and tasks.";
      case 'NETWORK_STRUCTURE':
        return "You are an AI assistant specialized in determining optimal network structures. Please analyze the given scenario and tasks to suggest the most suitable network structure.";
      case 'REFINE_SUGGESTION':
        return "You are an AI assistant focused on refining and improving suggestions. Please provide constructive feedback and enhancements to the given suggestions.";
      case 'SUMMARY_GENERATION':
        return "You are an AI assistant specialized in summarizing conversations. Please provide concise and accurate summaries of the given conversation.";
      case 'NETWORK_GENERATION':
        return "You are an AI assistant designed to generate network structures. Please create a detailed network structure based on the provided summary.";
      default:
        return "You are a helpful AI assistant. Please provide informative and relevant responses to the user's queries.";
    }
  }

  function handleFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const file = target.files[0];
        attachment = {
            // id: crypto.randomUUID(),
            name: file.name,
            url: URL.createObjectURL(file),
            file: file
        };
    }
  }

    function deleteAttachment() {
    attachment = null;
  }


  function addMessage(role: 'user' | 'assistant' | 'thinking' | 'options', content: string | Scenario[] | Task[], parentMsgId: string | null = null): InternalChatMessage {
    messageIdCounter++;
    const messageContent = typeof content === 'string' ? content : JSON.stringify(content);
    return { 
      role: role as 'user' | 'assistant' | 'thinking',
      content: messageContent,
      id: `msg-${messageIdCounter}`, 
      isTyping: role === 'assistant',
      text: messageContent,
      user: userId,
      collectionId: '',
      collectionName: '',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      parent_msg: parentMsgId,
    };
  }

  function handleQuoteMessage(message: Messages) {
    quotedMessage = message;
  }

  function handleCancelQuote() {
    quotedMessage = null;
  }


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
  
  // function addMessage(role: 'user' | 'assistant' | 'thinking' | 'options', content: string | Scenario[] | Task[]) {
  //   messageIdCounter++;
  //   return { role, content, id: messageIdCounter, isTyping: role === 'assistant' };
  // }
  
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
    if (!message && chatMessages.length === 0 && !attachment) return;

    if (!currentThreadId) {
        console.error('No thread selected');
        return;
    }

    try {
        // Save user message
        const userMessage = await messagesStore.saveMessage({
            text: message,
            type: 'human',
            thread: currentThreadId,
            parent_msg: quotedMessage ? quotedMessage.id : null,
        }, currentThreadId);

        chatMessages = [...chatMessages, addMessage('user', message, quotedMessage ? quotedMessage.id : null)];
        userInput = '';
        quotedMessage = null;
        resetTextareaHeight();

        thinkingPhrase = getRandomThinkingPhrase();
        const thinkingMessage = addMessage('thinking', thinkingPhrase);
        thinkingMessageId = thinkingMessage.id;
        chatMessages = [...chatMessages, thinkingMessage];
        isLoading = true;

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
            parent_msg: userMessage.id,
        }, currentThreadId);

        // Add an empty message for typewriting effect
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

        await messagesStore.fetchMessages(currentThreadId);

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

// async function typeMessage(message: string) {
//     const typingSpeed = 10; // milliseconds per character
//     let typedMessage = '';
    
//     for (let i = 0; i <= message.length; i++) {
//         typedMessage = message.slice(0, i);
//         chatMessages = chatMessages.map(msg => 
//             msg.id === String(typingMessageId) 
//                 ? { ...msg, content: typedMessage, text: typedMessage, isTyping: i < message.length }
//                 : msg
//         );
//         await new Promise(resolve => setTimeout(resolve, typingSpeed));
//     }
// }

        // Handle different prompt types
        // switch (currentPromptType) {
        //     case 'SCENARIO_GENERATION':
        //         if (currentStage === 'initial') {
        //             scenarios = await generateScenarios(message, aiModel, userId);
        //             chatMessages = [...chatMessages, addMessage('options', scenarios)];
        //             currentStage = 'scenarios';
        //         }
        //         break;
        //     case 'TASK_GENERATION':
        //         if (currentStage === 'scenarios' && selectedScenario) {
        //             tasks = await generateTasksAPI(selectedScenario, aiModel, userId);
        //             chatMessages = [...chatMessages, addMessage('options', tasks)];
        //             currentStage = 'tasks';
        //         } else if (currentStage === 'initial') {
        //             chatMessages = [...chatMessages, addMessage('assistant', "Please select a scenario first.")];
        //         }
        //         break;
        //     case 'AGENT_CREATION':
        //         if (currentStage === 'tasks' && selectedTask) {
        //             await finalizeProcess();
        //         } else {
        //             chatMessages = [...chatMessages, addMessage('assistant', "Please select a task first.")];
        //         }
        //         break;
        //     case 'CASUAL_CHAT':
        //     default:
        //         // No additional action needed for casual chat
        //         break;
        // }


  // async function typeMessage(message: string) {
  //   const assistantMessage = addMessage('assistant', '');
  //   chatMessages = [...chatMessages, assistantMessage];
  //   typingMessageId = assistantMessage.id;

  //   const typingSpeed = 1; // milliseconds per character
  //   for (let i = 0; i <= message.length; i++) {
  //     chatMessages = chatMessages.map(msg => 
  //       msg.id === String(typingMessageId) 
  //         ? { ...msg, content: message.slice(0, i), text: message.slice(0, i), isTyping: i < message.length }
  //         : msg
  //     );
  //     await new Promise(resolve => setTimeout(resolve, typingSpeed));
  //   }
  // }

  async function typeMessage(message: string) {
    const typingSpeed = 10; // milliseconds per character
    let typedMessage = '';
    
    for (let i = 0; i <= message.length; i++) {
      typedMessage = message.slice(0, i);
      chatMessages = chatMessages.map(msg => 
        msg.id === String(typingMessageId) 
          ? { ...msg, content: typedMessage, text: typedMessage, isTyping: i < message.length }
          : msg
      );
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
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


// // Call these functions at appropriate times in your component
// $: if (currentStage === 'summary') {
//     generateSummary();
// }

// $: if (currentStage === 'tasks') {
//     generateTasks();
// }

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
      
      // Generate network data based on AI agents
      // networkData = {
      //   rootAgent,
      //   childAgents,
      //   // Add any other relevant network information
      // };

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




onMount(async () => {
  await threadsStore.loadThreads(userId);

    try {
        isAuthenticated = await ensureAuthenticated();
        if (!isAuthenticated) {
            console.error('User is not logged in. Please log in to create a network.');
            showAuth = true;
        }

        threads = await fetchThreads(userId);
        console.log("Fetched threads:", threads);
        if (threads.length === 0) {
            const newThread = await createThread({ userId, name: `Thread ${threads.length + 1}` });
            threads = [newThread];
            console.log("Created new thread:", newThread);
        }
        if (threads.length > 0) {
            await handleLoadThread(threads[0].id);
        }

        // New user-related code
        if ($currentUser && $currentUser.id) {
            updateAvatarUrl();
            username = $currentUser.username || $currentUser.email;
        }

        if (textareaElement) {
            const adjustTextareaHeight = () => {
                if (textareaElement) {
                    textareaElement.style.height = 'auto';
                    textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, 300)}px`;
                }
            };

            textareaElement.addEventListener('input', adjustTextareaHeight);
            adjustTextareaHeight();

            return () => {
                if (textareaElement) {
                    textareaElement.removeEventListener('input', adjustTextareaHeight);
                }
            };
        }
    } catch (error) {
        console.error("Error in onMount:", error);
        // Handle the error appropriately, e.g., show an error message to the user
    }
});
  
  $: console.log("isLoading changed:", isLoading);

  $: if ($currentUser && $currentUser.avatar) {
    updateAvatarUrl();
}

async function handleCreateNewThread() {
  try {
    const newThread = await threadsStore.addThread({ op: userId, name: `Thread ${threads?.length ? threads.length + 1 : 1}` });
    if (newThread && newThread.id) {
      threads = [...(threads || []), newThread];
      await handleLoadThread(newThread.id);
    } else {
      console.error("Failed to create new thread: Thread object is undefined or missing id");
    }
  } catch (error) {
    console.error("Error creating new thread:", error);
  }
}

function updateAvatarUrl() {
    if ($currentUser && $currentUser.avatar) {
        avatarUrl = pb.getFileUrl($currentUser, $currentUser.avatar);
    }
}6
  
  let isDragging = false;
  let startY: number;
  let scrollTopStart: number;
  
  function startDrag(event: MouseEvent) {
    isDragging = true;
    startY = event.clientY;
    scrollTopStart = chatMessagesDiv.scrollTop;
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
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
    isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.error('User is not logged in. Please log in to create a network.');
      showAuth = true;
    }

    if (textareaElement) {
      const adjustTextareaHeight = () => {
        if (textareaElement) {
          textareaElement.style.height = 'auto';
          textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, )}px`;
        }
      };

      textareaElement.addEventListener('input', adjustTextareaHeight);
      adjustTextareaHeight();

      // if (!showChat) {
      //   textareaElement.focus();
      // }

      return undefined;

    }
  });

  function resetTextareaHeight() {
  if (textareaElement) {
    textareaElement.style.height = 'auto';
    textareaElement.style.height = '50px'; // Set this to your default height
  }
}

function handleAuthSuccess() {
    isAuthenticated = true;
    showAuth = false;
  }

  function handleAuthFailure() {
    console.error('Authentication failed');
    // You can add additional error handling here
  }

  function handlePromptTypeChange(event: CustomEvent<PromptType>) {
    currentPromptType = event.detail;
    // Reset relevant state variables when prompt type changes
    scenarios = [];
    tasks = [];
    selectedScenario = null;
    selectedTask = null;
    currentStage = 'initial';
  }

  function startEditingThreadName() {
  isEditingThreadName = true;
  editedThreadName = currentThread?.name || '';
}

async function submitThreadNameChange() {
  if (currentThreadId && editedThreadName.trim() !== '') {
    await updateThread(currentThreadId, { name: editedThreadName.trim() });
    if (currentThread) {
      currentThread.name = editedThreadName.trim();
    }
    isEditingThreadName = false;
  }
}

  
</script>

<div class="chat-interface">
  <button class="thread-toggle" on:click={toggleThreadList}>
    <Menu size={24} />
  </button>
  <div class="threads-container" transition:fly="{{ y: 300, duration: 300 }}" class:thread-list-visible={showThreadList}>
    {#if showThreadList}
    <div class="thread-list" transition:fly="{{ y: 300, duration: 300 }}">
      <button class="add-button" on:click={handleCreateNewThread}>+ New Thread</button>
      <div class="tag-list">
        {#each availableTags as tag, index}
          <button class="tag" class:selected={tag.selected} on:click={() => toggleTag(tag)}>
            {tag.name}
          </button>
        {/each}
        <button class="add-tag" on:click={toggleTagCreation}>
          <Plus size={16} />
        </button>
      </div>
      {#if editingTagIndex !== null}
        <div class="new-tag-input">
          <input bind:value={newTag} placeholder="New tag" on:keydown={(e) => e.key === 'Enter' && saveTag()} />
          <button on:click={saveTag}><Plus size={16} /></button>
        </div>
      {/if}
      {#each Object.entries(groupedThreads) as [group, groupThreads]}
      <div class="thread-group">
        <div class="thread-group-header">{group}</div>
        {#each groupThreads as thread}
          <button class="thread-button"
            on:click={() => handleLoadThread(thread.id)}
            class:selected={currentThreadId === thread.id}
          >
            {thread.name}
          </button>
        {/each}
      </div>
    {/each}
    </div>
    {/if}
    <div class="chat-container" transition:fly="{{ y: 300, duration: 300 }}">
      <div class="thread-info">
        {#if currentThread}
          {#if isEditingThreadName}
            <input
              bind:value={editedThreadName}
              on:keydown={(e) => e.key === 'Enter' && submitThreadNameChange()}
              on:blur={() => isEditingThreadName = false}
              autofocus
            />
            <button on:click={submitThreadNameChange}>Save</button>
          {:else}
            <h1>{currentThread.name}</h1>
            <button on:click={startEditingThreadName}>Edit</button>
            <div class="thread-tags">
              {#each currentThread.tags || [] as tag}
                <span class="tag">{tag}</span>
              {/each}
              <button class="add-tag" on:click={toggleTagCreation}>
                <Plus size={16} />
              </button>
            </div>
          {/if}
          
          <div class="thread-stats">
            <span>{messages.length} messages</span>
            <span>Created: {new Date(currentThread.created).toLocaleDateString()}</span>
            <span>Last updated: {new Date(currentThread.updated).toLocaleDateString()}</span>
          </div>
        {:else}
          <h1>Select a thread</h1>
        {/if}
      </div>
      <div class="chat-content" in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}" bind:this={chatMessagesDiv}>
        <div class="chat-messages" in:fly="{{ x: 200, duration: 300 }}" out:fade="{{ duration: 200 }}" bind:this={chatMessagesDiv}>
          {#each chatMessages as message (message.id)}
            <div class="message {message.role}" in:fly="{{ x: 20, duration: 300 }}" out:fade="{{ duration: 200 }}">
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
                {:else if message.role === 'thinking'}
                  <span class="role">
                    <Bot size="50" color="white" />
                  </span>
                {:else if message.role === 'options'}
                  <!-- <span class="role">Select scenario</span> -->
                {:else}
                  <span class="role">
                    <Bot size="40" color="white" />
                    AI
                  </span>
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
                <p class:typing={message.isTyping}>{message.content}</p>
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
              
              <div class="message-footer">
                <div class="message-time">{new Date(message.created).toLocaleTimeString()}</div>
                <div class="message-reactions">
                  {#if message.selectedReaction}
                    <span class="reaction selected">{message.selectedReaction}</span>
                  {:else}
                    <button 
                      class="reaction-button" 
                      on:mousedown={() => showReactions = message.id}
                      on:click={() => showReactions = null}
                    >
                      <Smile size={16} />
                    </button>
                  {/if}
                  {#if showReactions === message.id}
                    <div class="reaction-picker">
                      {#each reactions as reaction}
                        <button class="reaction-btn" on:click={() => addReaction(message.id, reaction)}>{reaction}</button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

  </div>  
  <div class="input-container">
    <textarea
      bind:this={textareaElement}
      bind:value={userInput}
      on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && !isLoading && handleSendMessage()}
      placeholder="Type your message..."
      disabled={isLoading}
      rows="1"
    ></textarea>
    
    <div class="button-row">
      <div class="btn-model">
        <ModelSelector/>
        <PromptSelector/>
        <button>
          <Paperclip size="30" color="white" />
        </button>
        <button on:click={() => !isLoading && handleSendMessage()} disabled={isLoading}>
          <Send size="30" color="white" />
        </button>
      </div>
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
  
  <style>
  * {
    font-family: 'Merriweather', serif;

  }
    .threads-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
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
      /* left: 20%; */
      width: 100%;
      padding: 10px;

    }

   

    .button-row {
      display: flex;
      flex-direction: row;
    }

  
    .chat-messages {
      flex-grow: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      
      scrollbar-width:1px;
      scrollbar-color: #898989 transparent;
      margin-bottom: 100px;
      padding-top: 40px;
      height: 90vh;
      border-radius: 50px;
      padding-bottom: 40px;
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
      backdrop-filter: blur(10px);

    }
    
    .chat-messages::before,
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
  
    .message {
    display: flex;
    flex-direction: column;
    align-items: flex-start;  /* Change this from 'stretch' to 'flex-start' */
    padding: 20px;
    border-radius: 20px;
    font-size: 18px;
    /* font-weight: 300; */
    font-weight: 100;
    letter-spacing: 1px;
    line-height: 1.5;
    font-family: 'Merriweather', serif;
    /* font-family: 'Roboto', serif; */

    transition: all 0.3s ease-in-out;
    width: 300px;  
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
    }
  
    .role {
        align-self: flex-start;
        margin-bottom: 5px;  /* Add some space between the role and the message content */
}

/* Adjust assistant message alignment */
.message.assistant {
  align-self: flex-start;
  background: #21201d;
  color: white;
  /* margin-bottom: 20px; */
  margin-left: 0px;
  font-style: italic;
  width: 50%;  
  border: 1px solid black

}
  
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
      position: relative;
      align-self: flex-end;
      text-justify: center;
      justify-content: center;
      /* margin-right: 20px; */
      width: 50%;  
      /* background: #3c3b35; */
          background-color: #2e3838;

      color: white;
      border: 1px solid rgb(54, 54, 54);

      margin-bottom: 20px;
      /* border: none; */
      border-radius: 20px;

    }

    .message p {
      font-size: calc(10px + 1vmin);
      margin: 0;
      white-space: pre-wrap;
      
      overflow-wrap: break-word;
      word-wrap: break-word;
      hyphens: auto;
    }

    .reaction-btn {
      border: none;
      height: 50px;
      width: 50px;
      transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

    }
  
    .reaction-btn:hover {
      transform: scale(1.2);
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
      font-family: 'Roboto', sans-serif;
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

/* Adjust assistant message alignment */
  .message.assistant {
    align-self: flex-start;
    background: #21201d;
    color: white;
    margin-bottom: 20px;
    font-style: italic;
    width: auto;  /* Allow the message to shrink-wrap its content */
    width: 50%;  

  }
/* 
  .tag-list {
    display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-start; 
  align-content: flex-start; 
    gap: 5px;
    margin-bottom: 10px;

  } */

  .tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}

.tag {
  /* background-color: #302626; */
  border: none;
  border-radius: 15px;
  padding: 5px 10px;
  font-size: 10px;
  height: auto;
  min-height: 20px;
  width: auto;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.3s;
}

.tag.selected {
  background-color: #007bff;
  color: white;
}

.add-tag {
  /* background-color: red; */
  border: 1px dashed #ccc;
  border-radius: 15px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.new-tag-input {
  display: flex;
  margin-bottom: 10px;
}

.new-tag-input input {
  flex-grow: 1;
  border: 1px solid #ccc;
  border-radius: 15px;
  padding: 5px 10px;
  font-size: 12px;
}

.thread-group-header {
  font-weight: bold;
  margin-top: 10px;
  margin-bottom: 5px;
  color: #666;
  font-size: 30px;
  width: 100%;

  
}

.thread-group {
  display: flex;
  flex-wrap: wrap;
  /* background-color: red; */
  margin-top: 10px;
  gap: 39px 20px;
  /* background-color: #302626; */
  border: none;
  border-radius: 15px;
  padding: 5px 10px;
  font-size: 10px;
  height: auto;
  min-height: 20px;
  width: auto;
  display: inline-flex;
  /* align-items: center; */
  /* justify-content: center; */
  cursor: pointer;
  transition: background-color 0.3s;

}

.thread-button {
  display: flex;
  


}





  .message-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 5px;
  }

  .message-reactions {
    display: flex;
    align-items: center;
    transition: all ease-in 0,3s;
  }

  .message-reactions:hover {
    display: flex;
    align-items: center;
    transform: scale(1.2);
    /* background-color: red; */
  }
  .reaction-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-left: 5px;
  }

  .reaction-picker {
    position: absolute;
    /* background-color: white; */
    /* border: 1px solid #ccc; */
    border-radius: 5px;
    padding: 5px;
    display: flex;
    gap: 5px;
    z-index: 10;
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

  }

  .reaction {
    font-size: 16px;
    cursor: pointer;
    position: absolute;
    display: flex;
    align-items: right;
  }

  .reaction.selected {
    /* border: 1px solid #007bff; */
    border-radius: 50%;
    padding: 0px 20px;
  }

  @media (min-width: 1200px) {
      .chat-container {
        /* width: 50%; */
        height: 95vh;
        margin-left: 25%;
        /* margin-right: 25%; */


      }


      .threads-container {
          /* background-color: red; */
        }
      .thread-list {
          /* width: 25%; */
          margin-top: 20px;
          height: 80%;
          overflow-y: scroll;
          overflow-x: none;
          scrollbar-width:1px;
          scrollbar-color: #c8c8c8 transparent;
          

        }

        .thread-list-visible .chat-container {
          margin-left: 0;
          left: 0;
          overflow-y: auto;
          margin-right: 0;
          margin-left: 0;
          width: auto;


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
    0% { box-shadow: 0 0 0 #FFD700, 0 0 2px #FFD700; }
    100% { box-shadow: 0 0 1px #FFD700, 0 0 10px #FFD700; }
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

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  .input-container {
    display: flex;
    position: fixed;
    bottom: 400px;
    width: 95%;
    padding: 10px;
    bottom: 20px;
    /* margin-bottom: 0; */
    border-radius: 70%;
    background: linear-gradient(45deg, rgba(0, 0, 0, 0.8) 50%, rgba(128, 128, 128, 0.8) 100%);
    display: flex;
    border: 1px solid rgb(44, 44, 44);
    background-color: rgb(17, 56, 39);

  }

  input {
    flex-grow: 1;
    margin-right: 10px;
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

.input-container textarea:focus {
    border: 1px solid rgb(54, 54, 54);
    background-color: rgb(0, 0, 0);
    color: white;
    font-size: 40px;
    animation: glowy 1.5s infinite alternate;
    display: flex;

}

  button {
    display: flex;
    
    width: 60px;
    height: 60px;
    padding: 10px;
    background-color: #21201d;    
    color: white;
    border: 2px solid rgb(0, 0, 0);
    border-radius: 30px;
    cursor: pointer;
    transition: background-color 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  button:hover {
    background: #000000;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
  }

  .typing::after {
    content: '▋';
    display: inline-block;
    vertical-align: bottom;
    animation: blink 0.7s infinite;
    
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

  
  .btn-model {
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: fixed;
    right: 0;
    bottom: 40px;
    align-items: flex-end;
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

  }


  .btn-upload {
    position: relative;
    margin-bottom: 20px;
    right: 0;

  }

  textarea {
    display: flex;
    flex-direction: column;
    font-family: 'Merriweather', serif;
    width: 96%;
    /* min-height: 60px; Set a minimum height */
    /* max-height: 1200px; Set a maximum height */
    padding: 20px;
    text-justify: center;
    justify-content: center;
    resize: none;
    font-size: 16px;
    letter-spacing: 1.4px;
    border: none;
    border-radius: 20px;
    /* background-color: #2e3838; */
    background-color: #020101;
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
    outline: none;
    border: 2px solid #000000;
    color: white;
    transform: translateY(-10px) rotate(0deg); 
    font-size: 30px;
    padding: 60px;
    /* height: 300px; */
    display: flex;

  }

  @keyframes blink {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
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
    margin-bottom: 10px;


  }

span {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.thread-tags span {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  /* background-color: blue; */
  color: white;
  width: 100px;
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
    margin-top: 5px;
  }

  .chat-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    overflow-y: hidden;
  }

  .thread-list {
    display: flex;
    flex-direction: column;
    justify-content: top;
    align-items: center;
    overflow: auto;
  position: fixed;
  padding: 20px 0px;
  /* left: 30px; */
  /* top: 80px; */
  /* bottom: 60px; */
  /* border-radius: 50px; */
  width: 20%;
  transition: all 0.3s ease-in-out;
  /* z-index: 10; */
}

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


  .thread-list button {
      display: flex;
      flex-direction: rows;
      justify-content: center;
      margin-left: 5%;
      /* width: 88%; */
      padding: 20px 20px;
      border-radius: 10px;
      /* margin-bottom: 5px; */
      text-align: left;
      /* border-bottom: 1px solid #4b4b4b; */
      cursor: pointer;
      color: #fff;
      transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
      letter-spacing: 4px;
      font-size: 20px;
      justify-content: center;
      align-items: center;
      
  }

    .thread-list button:hover {
        background-color: #2c3e50;
        transform: scale(1.62) translateX(5px) rotate(5deg);          
        letter-spacing: 4px;
        padding: 20px;
        /* font-size: 30px; */

      }

    .thread-list button.selected {
        /* background-color: #2980b9; */
        font-weight: 200;
        
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
      border-bottom: 1px solid #6b6b6b;
      border-radius: 10px;
      margin-bottom: 2rem;
    }

    .thread-toggle {
      display: flex;
      flex-direction: row;
      position: fixed;
      height: 60px;
      width: 60px;
      bottom: 80px;
      left: 0;
      z-index: 1000;
      background-color: rgb(24, 24, 24);
      border: 1px solid gray;
      border-radius: 50px;
      cursor: pointer;
      transition: left 0.3s ease-in-out;
    }

    .thread-list-visible .thread-toggle {
      left: 310px;
    }

  .thread-toggle:hover {
    background-color: black;
  }

  .thread-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    border-radius: 5px;
    font-size: 20px;
    color: white;
    height: 60px;
    /* background-color: black; */
  }

  .thread-stats {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;    
    position: relative;
    gap: 40px;
    font-size: 0.9em;
    color: #666;
    font-size: 20px;

  }

  .message-actions {
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .message.human:hover .message-actions {
    opacity: 1;
  }

  .message.robot .message-actions {
    display: none;
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

  .thread-list button.selected {
    background-color: #2c3e50;
    font-weight: bold;
  }

  .thread-tags {
    display: flex;
    flex-direction: row;
  }

  @keyframes blink {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }



  @media (max-width: 768px) {
  .threads-container {
    flex-direction: column;

  }

  .chat-content {
    width: 100%;
    
  }

  .thread-list {
    position: fixed;
    margin-left: 1%;
    top: 100px;
    bottom: 0;
    width: 90%;
    height: 100%;
    transform: translateX(-100%);
    transition: transform 0.3s ease-in-out;
    z-index: 1000;
  }

  .thread-list-visible .thread-list {
    transform: translateX(0);
  }

  .thread-list-visible .chat-container {
    display: none;
  }

  .chat-container {
        width: 96%;
        height: 95vh;
        margin-left: 2%;
        left: 0;

      }

  .thread-toggle {
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 1001;
  }

  .thread-list-visible .thread-toggle {
    left: 10px;
  }

  h1 {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 16px;
    padding: 10px;
    background-color: #f0f0f0;
    border-radius: 5px;
  }


.chat-content {

}
.threads-container {
    /* background-color: red; */
    width: 100%;

  }
.thread-list {
    width: 100%;
    
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
    margin-left: 300px;
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
</style>