<script lang="ts">
    import { onMount } from 'svelte';
    import { fly, fade, slide } from 'svelte/transition';
    import { Bot, MessagesSquare, RefreshCcw, Send, ChevronDown } from 'lucide-svelte';
    import Reactions from '$lib/components/common/chat/Reactions.svelte';
    import type { InternalChatMessage } from '$lib/types/types';
    import { createEventDispatcher } from 'svelte';
    import { showThreadList, threadsStore } from '$lib/stores/threadsStore';
    import { threadListVisibility } from '$lib/clients/threadsClient';
    import { prepareReplyContext } from '$lib/utils/handleReplyMessage';
    import { pocketbaseUrl } from '$lib/pocketbase';
    import { currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
    import { createTaskFromMessage, saveTask, getPromptFromThread, loadTasks, updateTask, deleteTask, updateTaskTags } from '$lib/clients/taskClient';
    import type { KanbanTask } from '$lib/types/types';
    import { 
        fetchAIResponse, 
        fetchDualAIResponses,
        saveSelectedResponse,
        handleStartPromptClick, 
        generateScenarios, 
        generateTaskFromMessage,
        createAIAgent, 
        generateGuidance 
    } from '$lib/clients/aiClient';
    import { addNotification, updateNotification, removeNotification } from '$lib/stores/taskNotificationStore';
    import { goto } from '$app/navigation';
    import { projectStore } from '$lib/stores/projectStore';


    export let message: InternalChatMessage;
    export let allMessages: InternalChatMessage[] = [];
    export let userId: string;
    export let name: string;
    export let depth: number = 0;
    export let getUserProfile;
    export let getAvatarUrl: (user: any) => string;
    export let processMessageContentWithReplyable;
    export let latestMessageId: string | null;
    export let toggleReplies: (messageId: string) => void;
    export let hiddenReplies: Set<string>;
    export let aiModel: any;
    export let promptType: string | null = null;
    export let sendMessage: (text: string, parent_msg?: string, contextMessages?: any[]) => Promise<void> = async () => {};
    export let isDualResponse = false;
    export let dualResponsePair = false;
    export let isPrimaryDualResponse = false;
    export let onSelectResponse: ((messageId: string) => void) | null = null;
    let currentProjectId: string | null;
    let showScrollButton = false;
    let isUserScrolling = false;
    let lastScrollTop = 0;
    let userScrollY = 0;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    $: currentProjectId = $projectStore.currentProjectId;    

    const dispatch = createEventDispatcher();
    
    const MAX_DEPTH = 5;
  
    $: childReplies = allMessages.filter(msg => msg.parent_msg === message.id);
    
    $: repliesHidden = hiddenReplies.has(message.id) || $showThreadList;
    
    let showReplyInput = false;
    let replyText = '';
    let isSubmitting = false;
   let showTaskTooltip = false;
    let taskTooltipText = '';
    function handleToggleReplies(messageId: string) {
        if (hiddenReplies.has(messageId)) {
            hiddenReplies.delete(messageId);
        } else {
            hiddenReplies.add(messageId);
        }
        hiddenReplies = new Set(hiddenReplies); 
    }
    function scrollToBottom() {
  console.log('Scroll button clicked in RecursiveMessage');
  
  // Find the main chat container (could be a parent element)
  const chatContainer = findScrollableParent(document.querySelector(`[data-message-id="${message.id}"]`));
  
  if (chatContainer) {
    // Use smooth scrolling for better UX
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: 'smooth'
    });
    
    // Reset state
    showScrollButton = false;
    isUserScrolling = false;
  } else {
    console.log('Scrollable container not found');
  }
}

// Add this helper function
function findScrollableParent(element: Element | null): HTMLElement | null {
  if (!element) return null;
  
  let parent = element.parentElement;
  while (parent) {
    // Check if this parent is scrollable
    const style = window.getComputedStyle(parent);
    const overflowY = style.getPropertyValue('overflow-y');
    
    if (['auto', 'scroll'].includes(overflowY) && 
        parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    
    parent = parent.parentElement;
  }
  
  // If no scrollable parent found, use document.documentElement as fallback
  return document.documentElement;
}

// Add this to handle scroll events - this should be connected to the parent scroll container
// You can call this from an onMount lifecycle hook
function setupScrollHandler() {
  const scrollContainer = findScrollableParent(document.querySelector(`[data-message-id="${message.id}"]`));
  
  if (scrollContainer) {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      
      // Distance from bottom
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // Show button when not at bottom
      showScrollButton = distanceFromBottom > 50;
      
      // Track user scrolling state
      if (scrollTop > lastScrollTop) {
        // Scrolling down
        if (distanceFromBottom < 20) {
          isUserScrolling = false;
        }
      } else if (scrollTop < lastScrollTop) {
        // Scrolling up
        isUserScrolling = true;
      }
      
      lastScrollTop = scrollTop;
    };
    
    // Initial check
    handleScroll();
    
    // Add event listener
    scrollContainer.addEventListener('scroll', handleScroll);
    
    // Clean up on destroy
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }
}


    function handleReply() {
        showReplyInput = !showReplyInput;
        
        if (showReplyInput) {
            setTimeout(() => {
                const textarea = document.getElementById(`reply-textarea-${message.id}`);
                if (textarea) textarea.focus();
            }, 10);
        }
    }
    
    async function submitReply() {
        if (!replyText.trim() || isSubmitting) return;
        
        try {
            isSubmitting = true;
            
            const { messagesToSend, contextMessage } = prepareReplyContext(
                replyText,
                message.id,
                allMessages,
                aiModel,
                promptType
            );
            
            await sendMessage(replyText, message.id, messagesToSend);
            
            // Clear the input and hide it
            replyText = '';
            showReplyInput = false;
            
            // Make sure any nested replies container is visible after sending
            if (hiddenReplies.has(message.id)) {
                hiddenReplies.delete(message.id);
                hiddenReplies = new Set(hiddenReplies);
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            dispatch('notification', {
                message: 'Failed to send reply. Please try again.',
                type: 'error'
            });
        } finally {
            isSubmitting = false;
        }
    }
    
    function cancelReply() {
        replyText = '';
        showReplyInput = false;
    }
    
    async function generateTaskDescription(content: string): Promise<string> {
  try {
    // Set up system instructions for the AI to generate a focused task description
    const systemPrompt = `
      Create a clear, concise task description based on the provided content. 
      - Focus only on actionable items and deliverables
      - Write in an imperative style (e.g., "Create a report" not "Here is a task to create a report")
      - Do not include phrases like "here is" or other meta-commentary
      - Be specific about requirements and acceptance criteria
      - Keep it focused and task-oriented
      - Format as a direct set of instructions
      - Include only text that would be useful in a task tracking system
    `;

    // If the content is already reasonably sized, use it directly
    if (content.length < 500) {
      // Clean the content of HTML and other markup
      const cleanContent = content.replace(/<\/?[^>]+(>|$)/g, '');
      
      // Prepare the messages for AI processing
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transform this into a focused task description: ${cleanContent}` }
      ];
      
      // Use the appropriate AI model to generate the description
      const aiResponse = await fetchAIResponse(messages, aiModel, userId);
      return aiResponse;
    } else {
      // For longer content, extract the most relevant parts
      const summary = content.substring(0, 1000); // Take first 1000 chars as a sample
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a focused task description from this content: ${summary}` }
      ];
      
      const aiResponse = await fetchAIResponse(messages, aiModel, userId);
      return aiResponse;
    }
  } catch (error) {
    console.error('Error generating task description:', error);
    // Fall back to original content if description generation fails
    return content;
  }
}

async function generateTask(taskDetails: { 
  messageId: string, 
  content: string,
  model: string,
  promptType: string,
  threadId?: string 
}) {
  console.log('generateTask called with details:', taskDetails);
  try {
    const notificationId = addNotification('Generating parent task...', 'loading');
    const modelObject = typeof aiModel === 'string' 
      ? { api_type: aiModel, provider: 'anthropic', name: aiModel } 
      : aiModel;
    
    const { title, description } = await generateTaskFromMessage({
      content: taskDetails.content,
      messageId: taskDetails.messageId,
      model: modelObject,
      userId: userId,
      threadId: taskDetails.threadId || message.thread,
      isParentTask: true 
    });
    updateNotification(notificationId, {
      message: 'Creating task...',
    });
    const cleanTitle = title
      .replace(/^\*\*Title:\*\*\s*/i, '')
      .replace(/^Title:\s*/i, '')
      .replace(/\*\*/g, '')
      .replace(/^#+\s*/, '')
      .trim();
    
    console.log('Generated parent task title:', cleanTitle);
    console.log('Generated parent task description:', description);
    
    const threadId = taskDetails.threadId || message.thread || '';
    
    const newParentTask: KanbanTask = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: cleanTitle,
      taskDescription: description,
      creationDate: new Date(),
      due_date: null,
      tags: [],
      attachments: [],
      project_id: currentProjectId || '',
      createdBy: $currentUser?.id || '',
      parent_task: undefined,
      allocatedAgents: [],
      status: 'backlog' as 'backlog',
      priority: 'medium' as 'medium', 
      prompt: getPromptFromThread(threadId, allMessages), 
      context: '',
      task_outcome: '',
      dependencies: [],
      agentMessages: [taskDetails.messageId]
    };
    
    const projectId = currentProjectId || '';
    console.log('Saving parent task with projectId:', projectId);
    const savedParentTask = await saveTask(newParentTask);
    console.log('Parent task saved successfully:', savedParentTask);
    
    const parentId = savedParentTask.id;
    console.log('Using parent task ID for child tasks:', parentId);
    updateNotification(notificationId, {
      message: 'Generating subtasks...',
    });
    const childTasks = await generateChildTasks({
      content: taskDetails.content,
      messageId: taskDetails.messageId,
      model: modelObject,
      userId: userId,
      parentTaskId: parentId,
      projectId: currentProjectId || ''
    });
    
    console.log(`Generated and saved ${childTasks.length} child tasks`);
    updateNotification(notificationId, {
      message: `Task "${cleanTitle}" created with ${childTasks.length} subtasks`,
      type: 'success',
      link: {
        url: '/lean',
        text: 'Open Tasks'
      }
    });
    dispatch('notification', {
      message: `Task created with ${childTasks.length} subtasks`,
      type: 'success'
    });
    
    // taskTooltipText = `Task created with ${childTasks.length} subtasks`;
    // showTaskTooltip = true;
    // setTimeout(() => {
    //   showTaskTooltip = false;
    // }, 2000);
    
    return {
      parentTask: savedParentTask,
      childTasks: childTasks
    };
  } catch (error) {
    console.error('Error generating task:', error);
    console.log('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      fullError: error
    });
    addNotification(
      'Failed to create task: ' + (error instanceof Error ? error.message : 'Unknown error'),
      'error'
    );
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dispatch('notification', {
      message: 'Failed to create task: ' + errorMessage,
      type: 'error'
    });
    
    // Show error tooltip
    taskTooltipText = 'Failed to create task';
    showTaskTooltip = true;
    setTimeout(() => {
      showTaskTooltip = false;
    }, 2000);
  }
}

async function generateChildTasks({
  content,
  messageId,
  model,
  userId,
  parentTaskId,
  projectId
}: {
  content: string,
  messageId: string,
  model: any,
  userId: string,
  parentTaskId: string,
  projectId: string
}) {
  console.log('generateChildTasks called with parentTaskId:', parentTaskId);
  const subtasksNotificationId = addNotification('Analyzing message for subtasks...', 'loading');

  try {
    const systemPrompt = {
      role: 'system',
      content: `Extract 4-8 specific subtasks from the content below. Each subtask should be:
      - A clear, actionable item
      - Independent enough to track separately
      - Specific to one part of the overall task
      - Written in imperative form (e.g., "Design user interface" not "Designing user interface")
      - 3-8 words in length
      Format your response as a JSON array of strings containing ONLY the subtask titles. 
      Example: ["Create project plan", "Design user interface", "Implement backend API", "Test functionality"]`,
      model: model.api_type
    };

    const userPrompt = {
      role: 'user',
      content: `Generate subtasks based on this content:
      ${content}`,
      model: model.api_type
    };
    updateNotification(subtasksNotificationId, {
      message: 'Generating subtask titles...',
    });
    const subtasksResponse = await fetchAIResponse(
      [systemPrompt, userPrompt],
      model,
      userId
    );

    let subtaskTitles = [];
    try {
      subtaskTitles = JSON.parse(subtasksResponse);
    } catch (e) {
      const jsonMatch = subtasksResponse.match(/\[.*\]/s);
      if (jsonMatch) {
        try {
          subtaskTitles = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.error('Failed to parse subtasks JSON:', e2);
          subtaskTitles = subtasksResponse
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.includes('"role":') && !line.includes('{') && !line.includes('}'))
            .map(line => line.replace(/^["'\d\-\[\]\s•]+|\s*["',]+$/g, '').trim())
            .filter(line => line.length > 0);
        }
      } else {
        subtaskTitles = subtasksResponse
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
      }
    }

    if (!Array.isArray(subtaskTitles) || subtaskTitles.length === 0) {
      console.error('Failed to generate valid subtasks array:', subtasksResponse);
      updateNotification(subtasksNotificationId, {
        message: 'Failed to generate subtasks',
        type: 'error'
      });
      return [];
    }

    console.log('Generated subtask titles:', subtaskTitles);
    console.log('Creating child tasks with parent_task ID:', parentTaskId);
    updateNotification(subtasksNotificationId, {
      message: `Saving ${subtaskTitles.length} subtasks...`,
    });
    const savedChildTasks = [];

    for (const title of subtaskTitles) {
      const cleanTitle = title
        .replace(/^\d+\.\s*/, '') 
        .replace(/^\*+\s*/, '') 
        .replace(/^-\s*/, '') 
        .trim();

      const childTask: KanbanTask = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        title: cleanTitle,
        taskDescription: "",
        creationDate: new Date(),
        due_date: null,
        tags: [],
        attachments: [],
        project_id: projectId,
        createdBy: $currentUser?.id || '',
        parent_task: parentTaskId,
        allocatedAgents: [],
        status: 'backlog' as 'backlog',
        priority: 'medium' as 'medium',
        prompt: "",
        context: "",
        task_outcome: "",
        dependencies: [],
        agentMessages: []
      };

      console.log('Saving child task with parent_task:', childTask.parent_task);
      
      try {
        const savedChildTask = await saveTask(childTask);
        console.log('Child task saved with ID:', savedChildTask.id);
        console.log('Child task parent_task field:', savedChildTask.parent_task);
        savedChildTasks.push(savedChildTask);
      } catch (err) {
        console.error('Error saving child task:', err);
        console.error('Failed task object:', childTask);
      }
    }
    updateNotification(subtasksNotificationId, {
      message: `Created ${savedChildTasks.length} subtasks`,
      type: 'success'
    });
    return savedChildTasks;
  } catch (error) {
    console.error('Error generating child tasks:', error);
    updateNotification(subtasksNotificationId, {
      message: 'Failed to generate subtasks: ' + (error instanceof Error ? error.message : 'Unknown error'),
      type: 'error'
    });
    return [];
  }
}
async function handleGenerateDualResponses(userInput: string, systemPrompts: string[]) {
  try {
    // Call the existing fetchDualAIResponses function
    const result = await fetchDualAIResponses(
      userInput,
      aiModel,
      userId,
      systemPrompts
    );
    
    // Emit an event to the parent component with the responses
    dispatch('dualResponsesGenerated', {
      responses: result.responses,
      threadId: result.threadId,
      systemPrompts: systemPrompts,
      userMessage: userInput
    });
    
  } catch (error) {
    console.error('Error generating dual responses:', error);
    dispatch('notification', {
      message: 'Failed to generate responses: ' + (error instanceof Error ? error.message : 'Unknown error'),
      type: 'error'
    });
  }
}
async function handleSelectResponse(event) {
  const { messageId, content, systemPrompt } = event.detail;
  console.log('Handling response selection:', event.detail);
  
  try {
    const userMessage = isDualResponse ? allMessages.find(msg => 
      msg.role === 'user' && (msg.id === message.parent_msg || msg.thread === message.thread)
    ) : null;
    
    const userMessageContent = userMessage ? userMessage.content : "User message";
    
    // Use the existing sendMessage function which already knows how to properly save messages
    await sendMessage(userMessageContent, null, [
      { 
        role: 'system', 
        content: systemPrompt || '',
        model: typeof aiModel === 'string' ? aiModel : aiModel.api_type 
      },
      { 
        role: 'user', 
        content: userMessageContent,
        model: typeof aiModel === 'string' ? aiModel : aiModel.api_type 
      }
    ]);
    
    // Show success notification
    dispatch('notification', {
      message: 'Response selected and saved',
      type: 'success'
    });
    
    // Notify the parent that a selection was made so it can clean up dual response state
    dispatch('dualResponseProcessed', {
      selectedMessageId: messageId
    });
    
  } catch (error) {
    console.error('Error handling response selection:', error);
    dispatch('notification', {
      message: 'Failed to save selected response: ' + (error instanceof Error ? error.message : 'Unknown error'),
      type: 'error'
    });
  }
}
    function cleanHtmlContent(htmlContent: string): string {
        let cleaned = htmlContent.replace(/<\/?[^>]+(>|$)/g, '');
        cleaned = cleaned.replace(/\s+/g, ' ');
        cleaned = cleaned.trim();
        return cleaned;
    }    
    function handleMessageClick(event: MouseEvent) {
        if (
            event.target instanceof HTMLElement && (
                event.target.tagName === 'BUTTON' || 
                event.target.closest('button') || 
                event.target.tagName === 'A' ||
                event.target.tagName === 'INPUT' ||
                event.target.tagName === 'TEXTAREA' ||
                event.target.closest('.message-footer') ||
                event.target.closest('.reply-input-container')
            )
        ) {
            return;
        }
        
        if ($showThreadList) {
            threadListVisibility.set(false);
            
            const messageElement = event.currentTarget as HTMLElement;
            const messageId = messageElement.dataset.messageId;
            
            setTimeout(() => {
                const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
                
                if (targetMessage) {
                    targetMessage.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start'
                    });
                    
                    targetMessage.classList.add('scroll-highlight');
                    setTimeout(() => {
                        targetMessage.classList.remove('scroll-highlight');
                    }, 1500);
                }
            }, 100);
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            submitReply();
        }
        else if (event.key === 'Escape') {
            event.preventDefault();
            cancelReply();
        }
    }
    onMount(() => {
  return setupScrollHandler();
});
</script>
  
<div 
    class="message {message.role} depth-{depth}"
    class:latest-message={message.id === latestMessageId}
    class:highlighted={message.isHighlighted}
    class:clickable={$showThreadList && childReplies.length > 0}
    class:dual-response={isDualResponse}
    class:dual-response-alt={isDualResponse && dualResponsePair}
    data-message-id={message.id}
    data-thread-id={message.thread || ''}
    in:fly="{{ y: 20, duration: 300 }}"
    out:fade="{{ duration: 200 }}"
    on:click={handleMessageClick}
>
    <div class="message-header">
        {#if message.role === 'user'}
        <div class="user-header">
          <div class="avatar-container">
            {#if getAvatarUrl($currentUser)}
            <img 
              src={getAvatarUrl($currentUser)}
              alt="User avatar" 
              class="user-avatar" 
            />
            {:else}
              <div class="default-avatar">
                {($currentUser?.name || $currentUser?.username || $currentUser?.email || '?')[0]?.toUpperCase()}
              </div>
            {/if}
          </div>
          <span class="role">
            {#if message.type === 'human' && message.user}
              {#await getUserProfile(message.user) then userProfile}
                {userProfile ? userProfile.name : name}
              {/await}
            {:else}
              {name}
            {/if}
          </span>
        </div>
        {:else if message.role === 'assistant'}
            <div class="avatar-container">
                <Bot />
            </div>
            <div class="user-header">
                <span class="model">{message.model}</span>
                {#if message.prompt_type}
                    <span class="prompt-type">{message.prompt_type}</span>
                {/if}
            </div>
        {/if}
    </div>
    
    <p class:typing={message.isTyping}>
        {@html processMessageContentWithReplyable(message.content, message.id)}
    </p>
    
    {#if showReplyInput}
        <div class="reply-input-container" transition:slide={{ duration: 200 }}>
            <textarea 
                id="reply-textarea-{message.id}" 
                bind:value={replyText} 
                placeholder="Type your reply..." 
                on:keydown={handleKeydown}
                disabled={isSubmitting}
                rows="2"
            ></textarea>
            <div class="reply-actions">
                <button 
                    class="cancel-btn" 
                    on:click={cancelReply} 
                    title="Cancel"
                    disabled={isSubmitting}
                >
                    <span class="x-icon">×</span>
                </button>
                <button 
                    class="send-btn" 
                    on:click={submitReply} 
                    disabled={!replyText.trim() || isSubmitting} 
                    title="Send reply (Ctrl+Enter)"
                >
                    {#if isSubmitting}
                        <RefreshCcw size={16} class="loading-icon" />
                    {:else}
                        <Send size={16} />
                    {/if}
                </button>
            </div>
        </div>
    {/if}
    
    {#if childReplies.length > 0}
        <div class="replies-section">
            <button 
                class="toggle-replies-btn" 
                on:click|stopPropagation={() => handleToggleReplies(message.id)}
            >
                <span class="replies-indicator">
                    <MessagesSquare size={16} />
                    {childReplies.length} 
                    <span class="toggle-icon">{repliesHidden ? '+' : '−'}</span>
                </span>
            </button>
            
            {#if !repliesHidden}
                <div class="replies-container replies-to-{message.id}">
                    {#each childReplies as reply (reply.id)}
                        {#if depth < MAX_DEPTH}
                            <svelte:self 
                                message={reply}
                                allMessages={allMessages}
                                {userId}
                                {currentUser}
                                name={name}
                                depth={depth + 1}
                                {getUserProfile}
                                getAvatarUrl={getAvatarUrl}
                                {processMessageContentWithReplyable}
                                {latestMessageId}
                                toggleReplies={handleToggleReplies}
                                {hiddenReplies}
                                {sendMessage}
                                {aiModel}
                                {promptType}
                            />
                        {:else}
                            <!-- Simplified view for deep nesting -->
                            <div class="deep-nested-reply">
                                <p>{reply.role}: {@html reply.content.substring(0, 100)}...</p>
                                <a href="#{reply.id}" class="view-full-link">View full message</a>
                            </div>
                        {/if}
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
    
    {#if message.role === 'thinking'}
        <div class="thinking-animation">
            <span><Bot color="white" /></span>
            <span><Bot color="gray" /></span>
            <span><Bot color="white" /></span>
        </div>
    {/if}
    
    {#if message.role === 'assistant'}
        <div class="message-footer">
            <Reactions 
                message={message}
                {userId}
                isDualResponse={isDualResponse}
                isPrimaryDualResponse={isPrimaryDualResponse}
                on:update
                on:notification
                on:reply={() => handleReply()}
                on:createTask={(event) => {
                    console.log('createTask event received:', event.detail);
                    generateTask(event.detail);
                }}
                on:selectResponse={(event) => {
                  console.log('selectResponse event received:', event.detail);
                  handleSelectResponse(event);
                }}
            />
        </div>
    {/if}
    {#if showScrollButton}
  <button 
    class="scroll-bottom-btn" 
    on:click={scrollToBottom}
  >
    <ChevronDown />
  </button>
{/if}
</div>
  
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


    .message.depth-0 {
      box-shadow: 20px -20px 10px -10px var(--primary-color, 0.01);
      border-radius: 1rem;
      padding: 0;

    }
    
    .message.depth-1 {
        margin-left: 1.5rem;
        max-width: calc(80% - 1.5rem);
        // box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
        border-radius: 1rem;

        
    }
    
    .message.depth-2 {
        margin-left: 1.5rem;
        max-width: calc(80% - 3rem);
      // box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
      border-radius: 1rem;

    }
    
    .message.depth-3, .message.depth-4, .message.depth-5 {
        margin-left: 1.5rem;
        max-width: calc(80% - 4rem);
        // box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
        border-radius: 1rem;

    }
    
    .deep-nested-reply {
        padding: 0.5rem;
        border: 1px dashed #ccc;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
        font-size: 0.9rem;
    }
    
    .view-full-link {
        color: var(--link-color, #0077cc);
        text-decoration: none;
        font-size: 0.8rem;
    }
    
    .replies-container {
        margin-left: 1rem;
        margin-top: 0.5rem;
        border-left: 1px solid var(--line-color);
        border-bottom: 1px solid var(--line-color);
        border-bottom-left-radius: 2rem;

        // padding-left: 0.75rem;
    }
    
    .highlighted {
      box-shadow: 20px -20px 10px -10px var(--primary-color, 0.01);
    }
    
    /* Reply input styling */
    .reply-input-container {
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
        position: relative;
        border: 1px solid var(--inline-color);
        border-radius: 0.5rem;
        background: var(--primary-color);
        padding: 0.5rem;
        width: 100%;
    }
    
    .reply-input-container textarea {
        width: 100%;
        border: none;
        resize:none;
        min-height: 60px;
        background-color: transparent;
        padding: 0.5rem;
        font-family: inherit;
        font-size: 1.3rem;
        color: var(--text-color, #333);
        outline: none;
    }
    
    .reply-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.25rem;
        height: auto;
    }
    
    .cancel-btn, .send-btn {
        padding: 0.25rem 0.5rem;
        height: 3rem;
        width: 3rem;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        &:hover {
            color: var(--tertiary-color);

        }
    }
    
    .cancel-btn {
      background-color: transparent;
      color: var(--text-color);

    }
    
    .send-btn {
        background-color: var(--secondary-color);
        border-radius: 50%;
        color: white;
    }
    
    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .x-icon {
        font-size: 1.2rem;
        line-height: 1;
    }
    .avatar-container {
    width: auto;
    height: auto;
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
      width: auto;
      height: auto;
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

    
    .toggle-replies-btn {
        background: var(--secondary-color);
        color: var(--text-color);
        cursor: pointer;
        border: 1px solid var(--line-color);
        display: inline-flex;
        width: auto; 
        min-width: 4rem; 
        max-width: fit-content; 
        margin-bottom: 0.5rem;
        border-radius: 1rem;
        font-size: 0.9rem;
        padding: 0.25rem 0.5rem;
        text-align: left;
        justify-content: center;
        align-self: flex-start;

        &:hover {
            background: var(--primary-color);
        }
    }
    
    .replies-indicator {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    .message-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        color: var(--placeholder-color);
        font-weight: 200;
    }
    .message.clickable {
        cursor: pointer;
        transition: all 0.3s ease;
        border-radius: 2rem;

    }

    .message.clickable:hover {
        background: var(--primary-color);
        transform: translateX(10px);
        padding-inline-start: 1rem;
    }

    .message.typing::after {
      content: '▋';
      display: inline-block;
      vertical-align: bottom;
      animation: blink 0.7s infinite;
    }
    .message-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 100% ;
        gap: 1rem;

        &.assistant {
        margin-bottom: 0.5rem;
        }
    }
    .user-header {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        user-select: none;
    }

    .replies-section {
        display: flex;
        flex-direction: column;
        width: 100%;
        margin-left: 0;
        &.replies-container {
            display: flex;
            flex-direction: column;
            max-height: 100%;
            transition: max-height 0.3s ease;
            overflow-y: auto;
            // background: var(--bg-gradient-right);
            // border: 1px solid var(--line-color);
            padding: 0;
            // border-top: 1px solid var(--line-color);
            // background: var(--primary-color);  
        }
    }
    @keyframes highlight-fade {
    0% { box-shadow: 0px 10px 50px 1px rgba(255, 255, 255, 0); }
    20% { box-shadow: 0px 10px 50px 1px rgba(255, 255, 255, 0.3); }
    80% { box-shadow: 0px 10px 50px 1px rgba(255, 255, 255, 0.3); }
    100% { box-shadow: 0px 10px 50px 1px rgba(255, 255, 255, 0); }
}

    .scroll-highlight {
        animation: highlight-fade 1.5s ease-in-out forwards;
        border-radius: 2rem;
    }
    @keyframes bounce {
    0%, 80%, 100% { 
      transform: scale(0); 
    }
    40% { 
      transform: scale(1); 
    }
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
    .message.dual-response {
        border-left: 3px solid var(--primary-color, #3b82f6);
        position: relative;
    }
    .message.was-selected-response {
        border-left: 3px solid var(--success-color, #10b981);
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

    }
    &:hover::before {
      opacity: 0.8;
      background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);
    }
    &.thinking {
      display: flex;
      flex-direction: column;
      align-self: center;
      align-items: center;
      text-align: center;
      justify-content: center;
      box-shadow: none !important;
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
      max-width: 1200px;
      width: calc(100%);
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


    }
    .scroll-bottom-btn {
      position: fixed;
      bottom: 10rem;
      right: 6rem;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background-color: var(--bg-color);
      color: var(--placeholder-color);
      border: 1px solid transparent;
      // box-shadow: 0 2px 10px 2px rgba(0, 0, 0, 0.01);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 100;
      transition: all 0.2s ease;
      &:hover {
        color: var(--text-color);
      }
    }


  }
  @media (max-width: 1000px) {
    .scroll-bottom-btn {
      position: fixed;
      bottom: 10rem;
      right: 2rem !important;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background-color: var(--bg-color);
      color: var(--placeholder-color);
      border: 1px solid transparent;
      // box-shadow: 0 2px 10px 2px rgba(0, 0, 0, 0.01);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 100;
      transition: all 0.2s ease;
      &:hover {
        color: var(--text-color);
      }
    }
  }
  @media (max-width: 450px) {
    .message.depth-0 {
      font-size: 0.7rem;
    }

    .message.depth-1 {
        margin-left: 0;
        max-width: calc(100%);
        // box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
        border-radius: 1rem;
    }
       
    .message.depth-2 {
        margin-left:0;
        max-width: calc(100% - 3rem);
      // box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
      border-radius: 1rem;

    }
    
    .message.depth-3, .message.depth-4, .message.depth-5 {
        margin-left:0;
        max-width: calc(100% - 4rem);
        // box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
        border-radius: 1rem;

    } 
  }

  </style>