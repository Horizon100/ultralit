import { writable, get, derived } from 'svelte/store';

import type { ThreadGroup, InternalChatMessage, Scenario, Task, RoleType, PromptType, Messages } from '$lib/types/types';
import { formatContent } from '$lib/utils/formatters';

import { handleLoadThread, handleThreadNameUpdate, } from '$lib/chat/threadHandlers';
import { t } from '$lib/stores/translationStore';
import { messagesStore} from '$lib/stores/messagesStore';
import { threadsStore } from '$lib/stores/threadsStore';

import { currentThreadId, threads, userId, expandedDates} from '$lib/chat/threadHandlers';
import { resetTextareaHeight } from '$lib/utils/textHandlers';
import { aiModel } from '$lib/chat/promptHandlers';

export let chatMessages: InternalChatMessage[] = [];
export let thinkingMessageId: string | null = null;
export let typingMessageId: string | null = null;
export let attachment: File | null = null;
export let isLoading = false;
export let messageIdCounter: number = 0;
export const lastMessageCount = 0;
export let latestMessageId: string | null = null;
export const messages: Messages[] = [];
export const groupOrder = [
    get(t)('threads.today'),
    get(t)('threads.yesterday'), 
    get(t)('threads.lastweek'),
    get(t)('threads.thismonth'),
    get(t)('threads.older')
];

interface ExpandedGroups {
  [key: string]: boolean;
}
// Thread management functions
export function initializeExpandedGroups(groups: ThreadGroup[]) {
    const initialState: ExpandedGroups = {};
    groups.forEach((group, index) => {
      initialState[group.group] = index === 0; // Only expand first group
    });
    expandedGroups.set(initialState);
  }
  // Toggle group expansion
  export function toggleGroup(state: ExpandedGroups, groupName: string): ExpandedGroups {
    return {
      ...state,
      [groupName]: !state[groupName],
    };
  }
  

export function cleanup() {
  isLoading = false;
  thinkingMessageId = null;
  typingMessageId = null;
  attachment = null;
}
export function getRandomThinkingPhrase(): string {
    const thinkingPhrases = get(t)('extras.thinking');
    if (!thinkingPhrases?.length) {
      return 'Thinking...';
    }
    return thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
  }
  export const groupedMessages = derived(messages, ($messages) => 
    groupMessagesByDate($messages.map(m => mapMessageToInternal(m)))
  );
export function initializeExpandedDates() {
    if (groupedMessages.length > 0) {
      const latestGroup = groupedMessages[0];
      expandedDates.add(latestGroup.date);
      expandedDates = expandedDates;
    }
  }
  export async function handleAutoTriggerResponse(targetMessage) {
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
    //   const assistantMessage = await messagesStore.saveMessage({
    //     text: aiResponse,
    //     type: 'robot',
    //     thread: currentThreadId,
    //     parent_msg: targetMessage.id,
    //     prompt_type: prompt
    //   }, 
    //   currentThreadId);

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

export async function typeMessage(message: string) {
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

export function addMessage(
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
  export function getLastMessage(): Messages | null {
    if (messages && messages.length > 0) {
      return messages[messages.length - 1]; // Returns the last message in the array
    }
    return null;
  }

  

  export function getTotalMessages(): number {
    return messages.length;
  }
  export function mapMessageToInternal(message: Messages): InternalChatMessage {
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

export async function handleSendMessage(message: string = userInput) {
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

export function groupMessagesByDate(messages: InternalChatMessage[]) {
    const groups: { [key: string]: { messages: InternalChatMessage[]; displayDate: string } } = {};
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = new Date(today - 86400000).setHours(0, 0, 0, 0);
  
    messages.forEach(message => {
      const messageDate = new Date(message.created).setHours(0, 0, 0, 0);
      const dateKey = new Date(messageDate).toISOString().split('T')[0];
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

  export function groupMessagesWithReplies(messages: Messages[]): Messages[][] {
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

export function handleError(error: unknown) {
    console.error('Message handling error:', error);
    chatMessages = chatMessages.filter(msg => msg.id !== thinkingMessageId);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    chatMessages = [...chatMessages, addMessage('assistant', errorMessage)];
}


export const showScrollButton = writable(false);
export const isMinimized = writable(false);
export const lastScrollTop = writable(0);

export function handleScroll(event: { target: HTMLElement }) {
    const currentScrollTop = event.target.scrollTop;
    const currentLastScrollTop = get(lastScrollTop);
    
    if (currentScrollTop > currentLastScrollTop && currentScrollTop > 50) {
        isMinimized.set(true);
    } else if (currentScrollTop < currentLastScrollTop || currentScrollTop <= 50) {
        isMinimized.set(false);
    }
    lastScrollTop.set(currentScrollTop);
}

export function handleScrolling() {
    setTimeout(() => {
        const div = get(chatMessagesDiv);
        if (div) {
            const { scrollTop, scrollHeight, clientHeight } = div;
            if (scrollHeight - scrollTop - clientHeight < 200) {
                scrollToBottom();
            }
        }
    }, 0);
}

export async function scrollToBottom() {
    console.log('Scroll button clicked');
    const div = get(chatMessagesDiv);
    if (div) {
        const chatMessages = div.querySelector('.chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
            showScrollButton.set(false);
        } else {
            console.log('chat-messages div not found');
        }
    }
}