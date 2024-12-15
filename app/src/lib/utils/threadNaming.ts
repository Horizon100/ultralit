// src/lib/services/threadNaming.ts

import type { Messages, AIModel } from '$lib/types';
import { fetchAIResponse } from '$lib/aiClient';
import { pb } from '$lib/pocketbase';
import { threadsStore } from '$lib/stores/threadsStore';

export async function generateThreadName(
  userMessage: string,
  aiResponse: string,
  model: AIModel,
  userId: string
): Promise<string> {
  console.log('Generating thread name for:', {
    userMessage,
    aiResponse,
    modelId: model?.id
  });

  const prompt = {
    role: 'system',
    content: `Create a concise, descriptive title (max 50 chars) for a conversation starting with:
User: ${userMessage}
Assistant: ${aiResponse}
Return only the title, no quotes or explanation.`
  };

  try {
    console.log('Sending prompt for thread name generation:', prompt);
    const response = await fetchAIResponse([prompt], model, userId);
    console.log('Received thread name suggestion:', response);

    // Clean up the response - remove quotes and normalize
    const cleanName = response.replace(/^["']|["']$/g, '').trim().slice(0, 50);
    console.log('Cleaned thread name:', cleanName);
    return cleanName;
  } catch (error) {
    console.error('Error generating thread name:', error);
    return 'New Conversation';
  }
}

export async function shouldUpdateThreadName(messages: Messages[]): Promise<boolean> {
  console.log('Checking if thread name should be updated. Messages count:', messages?.length);
  
  if (!messages?.length) {
    console.log('No messages found, skipping thread name update');
    return false;
  }
  
  const robotMessages = messages.filter(m => m.type === 'robot');
  console.log('Found robot messages:', robotMessages.length);
  
  return robotMessages.length === 1;
}

export async function updateThreadNameIfNeeded(
  threadId: string,
  messages: Messages[],
  model: AIModel,
  userId: string
): Promise<void> {
  console.log('Starting thread name update check for thread:', threadId);
  
  try {
    if (!threadId || !messages?.length) {
      console.log('Missing threadId or messages, skipping update');
      return;
    }

    // Set naming state using the store
    threadsStore.setNamingThreadId(threadId);
    console.log('Set naming state for thread:', threadId);

    const shouldUpdate = await shouldUpdateThreadName(messages);
    console.log('Should update thread name?', shouldUpdate);

    if (!shouldUpdate) {
      console.log('Thread name update not needed');
      threadsStore.setNamingThreadId(null);
      return;
    }

    const lastUserMessage = messages.find(m => m.type === 'human')?.text || '';
    const lastAIMessage = messages.find(m => m.type === 'robot')?.text || '';
    
    console.log('Found messages for naming:', {
      userMessage: lastUserMessage,
      aiMessage: lastAIMessage
    });

    const newName = await generateThreadName(
      lastUserMessage,
      lastAIMessage,
      model,
      userId
    );

    console.log('Generated new thread name:', newName);
    console.log('Updating thread with new name...');

    await threadsStore.updateThread(threadId, { name: newName });
    console.log('Thread name updated successfully');

    await threadsStore.loadThreads();
    console.log('Thread list reloaded');
  } catch (error) {
    console.error('Error in updateThreadNameIfNeeded:', error);
  } finally {
    // Clear naming state using the store
    threadsStore.setNamingThreadId(null);
    console.log('Cleared naming state');
  }
}