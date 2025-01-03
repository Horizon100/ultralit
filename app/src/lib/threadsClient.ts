import type { Messages, Threads, AIModel} from '$lib/types';
import { pb } from '$lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
// import { fetchNamingResponse } from '$lib/aiClient'
import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
import { marked } from 'marked';

marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
    headerIds: false,
    mangle: false
  });

  function processMarkdown(content: string): string {
    try {
      // Process content with marked
      const processed = marked(content);
      
      // Additional formatting rules
      return processed
        // Ensure proper spacing around headers
        .replace(/(<h[1-6]>)/g, '\n$1')
        .replace(/(<\/h[1-6]>)/g, '$1\n')
        // Proper list formatting
        .replace(/(<[uo]l>)/g, '\n$1')
        .replace(/(<\/[uo]l>)/g, '$1\n')
        // Proper code block formatting
        .replace(/(<pre>)/g, '\n$1')
        .replace(/(<\/pre>)/g, '$1\n')
        // Clean up excessive newlines
        .replace(/\n{3,}/g, '\n\n');
    } catch (error) {
      console.error('Error processing markdown:', error);
      return content;
    }
  }

/** Utility to ensure user is authenticated */
function ensureAuthenticated(): void {
    if (!pb.authStore.isValid) {
        throw new Error('User is not authenticated');
    }
}



export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
    try {
        ensureAuthenticated();
        console.log(`Attempting to fetch messages for thread: ${threadId}`);

        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `thread = "${threadId}"`,
            sort: '-created',
            expand: 'user,parent_msg,task_relation,agent_relation,prompt_type,model'
        });

        // Process markdown for each message
        const processedMessages = messages.map(message => ({
            ...message,
            text: processMarkdown(message.text)
        }));

        console.log(`Fetched ${processedMessages.length} messages for thread ${threadId}`);
        return processedMessages;
    } catch (error) {
        console.error('Error fetching messages for thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}


export async function fetchLastMessageForThread(threadId: string): Promise<Messages | null> {
    try {
        ensureAuthenticated();


        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `thread = "${threadId}"`,
            sort: '-created', // Sort messages by creation date, descending
            limit: 1
        });

        if (messages.length > 0) {
            const lastMessage = messages[0];
            return {
                ...lastMessage,
                text: processMarkdown(lastMessage.text)
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching last message for thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function fetchThreads(): Promise<Threads[]> {
    try {
        ensureAuthenticated();

        // Fetch threads with expanded last_message field
        const threads = await pb.collection('threads').getFullList<Threads>({
            expand: 'last_message',
        });

        // If the last_message is expanded, you can access the details of the last message
        threads.forEach(thread => {
            if (thread.expand?.last_message) {
                console.log(`Last message for thread ${thread.id}:`, thread.expand.last_message);
            }
        });

        console.log('Fetched threads with last_message:', threads);
        return threads;
    } catch (error) {
        console.error('Error fetching threads:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}



export async function createThread(threadData: Partial<Threads>): Promise<Threads> {
    try {
        ensureAuthenticated();


        const newThread: Partial<Threads> = {
            name: threadData.name || 'New Thread',
            op: pb.authStore.model?.id,
        };

        console.log('Attempting to create thread with data:', newThread);

        const createdThread = await pb.collection('threads').create<Threads>(newThread);
        console.log('Created thread:', createdThread);
        return createdThread;
    } catch (error) {
        console.error('Error creating thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function updateMessage(id: string, data: Partial<Messages>): Promise<Messages> {
    try {
        ensureAuthenticated();

        // Process markdown if text is being updated
        const processedData = data.text ? {
            ...data,
            text: processMarkdown(data.text)
        } : data;

        return await pb.collection('messages').update<Messages>(id, processedData);
    } catch (error) {
        console.error('Error updating message:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function updateThread(id: string, changes: Partial<Threads>): Promise<Threads> {
    try {
        ensureAuthenticated();


        // If tags are being updated, ensure they're in the correct format
        if (changes.tags) {
            changes.tags = changes.tags.map(tag => {
                if (!tag.includes('#')) {
                    const color = getRandomBrightColor(tag);
                    return `${tag} #${color.slice(1)}`; // Remove the # from the color
                }
                return tag;
            });
        }

        return await pb.collection('threads').update<Threads>(id, changes);
    } catch (error) {
        console.error('Error updating thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function autoUpdateThreadName(
    threadId: string, 
    messages: Messages[], 
    model: AIModel,
    userId: string
): Promise<Threads | null> {
    try {
        // First check authentication
        await ensureAuthenticated();
  
        // Then return the result of updateThreadNameIfNeeded
        return await updateThreadNameIfNeeded(threadId, messages, model, userId);
    } catch (error) {
        console.error('Error in autoUpdateThreadName:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        return null;
    }
}

export async function addMessageToThread(message: Omit<Messages, 'id' | 'created' | 'updated'>): Promise<Messages> {
    try {
        ensureAuthenticated();

        console.log('Attempting to add message:', JSON.stringify(message, null, 2));
        console.log('User ID:', pb.authStore.model?.id);

        // Process markdown before saving
        const processedMessage = {
            ...message,
            text: processMarkdown(message.text)
        };

        const createdMessage = await pb.collection('messages').create<Messages>(processedMessage);
        console.log('Created message:', createdMessage);
        return createdMessage;
    } catch (error) {
        console.error('Error adding message to thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
            console.error('Error details:', error.data?.data);
        }
        throw error;
    }
}

export async function resetThread(threadId: string): Promise<void> {
    try {
      ensureAuthenticated();
      
      if (!threadId) {
        throw new Error('Thread ID is required');
      }
  
      // Update the thread in the database if needed
      await pb.collection('threads').update(threadId, {
        selected: false
        // Add any other reset properties you need
      });
      
      console.log('Thread reset successfully');
    } catch (error) {
      console.error('Error resetting thread:', error);
      if (error instanceof ClientResponseError) {
        console.error('Response data:', error.data);
        console.error('Status code:', error.status);
      }
      throw error;
    }
  }