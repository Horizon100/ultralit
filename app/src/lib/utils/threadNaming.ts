// src/lib/utils/threadNaming.ts
import { fetchAIResponse } from '$lib/clients/aiClient';
import { ensureAuthenticated } from '$lib/pocketbase';
import { threadsStore } from '$lib/stores/threadsStore';
import type { AIModel, RoleType, Messages } from '$lib/types/types';

export async function generateThreadName(
	userMessage: string,
	aiResponse: string,
	model: AIModel,
	userId: string
): Promise<string> {
	ensureAuthenticated();
	console.log('Generating thread name for:', {
		userMessage,
		aiResponse,
		modelId: model?.id
	});
	
	const prompt = {
		role: 'system' as RoleType,
		content: `Create a concise, descriptive title (max 50 chars) for a conversation starting with:
			User: ${userMessage}
			Assistant: ${aiResponse}
			Return only the title, no quotes or explanation.`,
		model: model.id
	};
	
	try {
		await ensureAuthenticated();
		console.log('Sending prompt for thread name generation:', prompt);
		const response = await fetchAIResponse([prompt], model, userId);
		console.log('Received thread name suggestion:', response);
		
		const cleanName = response
			.replace(/^["']|["']$/g, '')
			.trim()
			.slice(0, 50);
			
		console.log('Cleaned thread name:', cleanName);
		return cleanName;
	} catch (error) {
		console.error('Error generating thread name:', error);
		return 'New Conversation';
	}
}

export async function shouldUpdateThreadName(messages: Messages[]): Promise<boolean> {
	ensureAuthenticated();
	console.log('Checking if thread name should be updated. Messages count:', messages?.length);
	
	if (!messages?.length) {
		console.log('No messages found, skipping thread name update');
		return false;
	}
	
	const robotMessages = messages.filter((m) => m.type === 'robot');
	console.log('Found robot messages:', robotMessages.length);
	return robotMessages.length === 1;
}

export async function updateThreadNameIfNeeded(
	threadId: string,
	messages: Messages[],
	model: AIModel,
	userId: string
  ): Promise<void> {
	try {
	  ensureAuthenticated();
	  console.log('Starting thread name update check for thread:', threadId);
	  
	  // Check if thread was manually named recently
	  const manuallyNamed = typeof window !== 'undefined' && 
		window.localStorage.getItem(`thread_${threadId}_manual_name`) === 'true';
	  
	  const timestamp = typeof window !== 'undefined' && 
		window.localStorage.getItem(`thread_${threadId}_name_timestamp`);
	  
	  const isRecent = timestamp && (Date.now() - parseInt(timestamp)) < 10000; // 10 seconds
	  
	  if (manuallyNamed && isRecent) {
		console.log("Skipping auto-naming because thread was manually named recently");
		return;
	  }
	  
	  const lastUserMessage = messages.find((m) => m.type === 'human')?.text || '';
	  const lastAIMessage = messages.find((m) => m.type === 'robot')?.text || '';
	  
	  console.log('Found messages for naming:', {
		userMessage: lastUserMessage,
		aiMessage: lastAIMessage
	  });
	  
	  const newName = await generateThreadName(lastUserMessage, lastAIMessage, model, userId);
	  console.log('Generated new thread name:', newName);
	  console.log('Updating thread with new name...');
	  
	  await threadsStore.updateThread(threadId, { name: newName });
	  console.log("Thread updated. Now loading threads...");
	  
	  // Allow state to settle before reloading threads
	  await new Promise(resolve => setTimeout(resolve, 1000));
	  await threadsStore.loadThreads();
	  console.log('Thread list reloaded');
	} catch (error) {
	  console.error('Error in updateThreadNameIfNeeded:', error);
	} finally {
	  threadsStore.setNamingThreadId(null);
	  console.log('Cleared naming state');
	}
  }