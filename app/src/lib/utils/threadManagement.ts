import type { Messages, Threads, AIModel } from '$lib/types/types';
import { pb } from '$lib/pocketbase';
import { fetchAIResponse } from '$lib/clients/aiClient';
import { get } from 'svelte/store';
import { threadsStore } from '$lib/stores/threadsStore';
import { messagesStore } from '$lib/stores/messagesStore';

// Custom error types for better error handling
export class ThreadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThreadError';
  }
}

// Interface for thread naming configuration
interface ThreadNamingConfig {
  maxNameLength: number;
  minMessageCount: number;
  maxContextMessages: number;
}

const defaultConfig: ThreadNamingConfig = {
  maxNameLength: 50,
  minMessageCount: 2, // At least one user message and one AI response
  maxContextMessages: 3 // Maximum messages to consider for naming
};

export async function ensureValidThread(threadId: string | null): Promise<string> {
  if (!threadId) {
    const store = get(threadsStore);
    const newThread = await threadsStore.addThread({
      op: pb.authStore.model?.id,
      name: `New Thread ${store.threads.length + 1}`,
      created: new Date().toISOString()
    });
    
    if (!newThread?.id) {
      throw new ThreadError('Failed to create new thread');
    }
    
    return newThread.id;
  }
  return threadId;
}

async function generateThreadName(
  messages: Messages[],
  model: AIModel,
  userId: string
): Promise<string> {
  const context = messages
    .slice(-defaultConfig.maxContextMessages)
    .map(msg => ({
      role: msg.type === 'human' ? 'user' : 'assistant',
      content: msg.text
    }));

  const prompt = {
    role: 'system',
    content: `Create a concise, descriptive title (max ${defaultConfig.maxNameLength} chars) for a conversation containing these messages. Return only the title, no quotes or explanation.`
  };

  try {
    const response = await fetchAIResponse([prompt, ...context], model, userId);
    return response.slice(0, defaultConfig.maxNameLength).trim();
  } catch (error) {
    console.error('Error generating thread name:', error);
    throw new ThreadError('Failed to generate thread name');
  }
}

export async function saveMessageAndUpdateThread(
  message: Partial<Messages>,
  threadId: string | null,
  model: AIModel,
  userId: string
): Promise<{ message: Messages; threadId: string }> {
  try {
    // Ensure we have a valid thread
    const validThreadId = await ensureValidThread(threadId);
    
    // Add thread ID to message
    const messageWithThread = {
      ...message,
      thread: validThreadId
    };

    // Save message
    const savedMessage = await messagesStore.saveMessage(messageWithThread, validThreadId);
    
    // Check if we should update thread name
    const messages = await messagesStore.fetchMessages(validThreadId);
    const robotMessages = messages.filter(m => m.type === 'robot');
    
    // Only update name on first AI response
    if (message.type === 'robot' && robotMessages.length === 1) {
      try {
        const newName = await generateThreadName(messages, model, userId);
        await threadsStore.updateThread(validThreadId, { name: newName });
        
        // Refresh threads list
        await threadsStore.loadThreads();
      } catch (error) {
        console.error('Thread naming failed:', error);
        // Continue despite naming failure
      }
    }

    return { message: savedMessage, threadId: validThreadId };
  } catch (error) {
    console.error('Error in saveMessageAndUpdateThread:', error);
    throw new ThreadError(
      error instanceof Error ? error.message : 'Failed to save message and update thread'
    );
  }
}

export function isFirstAIMessage(messages: Messages[]): boolean {
  const aiMessages = messages.filter(m => m.type === 'robot');
  return aiMessages.length === 1;
}

export async function updateThreadNameIfNeeded(
  threadId: string,
  messages: Messages[],
  model: AIModel,
  userId: string
): Promise<void> {
  try {
    if (!isFirstAIMessage(messages)) {
      return;
    }

    const newName = await generateThreadName(messages, model, userId);
    await threadsStore.updateThread(threadId, { name: newName });
    await threadsStore.loadThreads();
  } catch (error) {
    console.error('Error updating thread name:', error);
    // Non-critical error, don't throw
  }
}