<script lang="ts">
    import { fly, fade, slide } from 'svelte/transition';
    import { Bot, MessagesSquare, RefreshCcw, Send } from 'lucide-svelte';
    import Reactions from '$lib/components/common/chat/Reactions.svelte';
    import type { InternalChatMessage } from '$lib/types/types';
    import { createEventDispatcher } from 'svelte';
    import { showThreadList, threadsStore } from '$lib/stores/threadsStore';
    import { threadListVisibility } from '$lib/clients/threadsClient';
    import { prepareReplyContext } from '$lib/utils/handleReplyMessage';
    import { pocketbaseUrl } from '$lib/pocketbase';
    import {  currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';


 // The message to display
 export let message: InternalChatMessage;
    // All messages in the chat (used to find replies)
    export let allMessages: InternalChatMessage[] = [];
    // Current user's ID
    export let userId: string;
    // Current user object
    // Username to display
    export let name: string;
    // Nesting depth of this message (for styling)
    export let depth: number = 0;
    // Function to get a user's profile
    export let getUserProfile;
    // Function to process message content
    export let processMessageContentWithReplyable;
    // ID of the latest message (for highlighting)
    export let latestMessageId: string | null;
    // Function to toggle replies visibility
    // Set of hidden reply IDs
    export let hiddenReplies: Set<string>;
    // Reference to the AI model being used
    export let aiModel: any;
    // Current prompt type
    export let promptType: string | null = null;
    // Function to send a message (optional)
    export let sendMessage: (text: string, parent_msg?: string, contextMessages?: any[]) => Promise<void> = async () => {};
    
    const dispatch = createEventDispatcher();
    
    // Maximum nesting depth for performance
    const MAX_DEPTH = 5;
  
    // Get direct replies to this message
    $: childReplies = allMessages.filter(msg => msg.parent_msg === message.id);
    
    // Check if replies to this message are hidden
    $: repliesHidden = hiddenReplies.has(message.id) || $showThreadList;
    
    // State for the reply input
    let showReplyInput = false;
    let replyText = '';
    let isSubmitting = false;

    function toggleReplies(messageId: string) {
        if (hiddenReplies.has(messageId)) {
            hiddenReplies.delete(messageId);
        } else {
            hiddenReplies.add(messageId);
        }
        hiddenReplies = new Set(hiddenReplies); 
    }

    // Handle reply button click from Reactions component
    function handleReply() {
        showReplyInput = !showReplyInput;
        
        // If opening the reply input, focus the textarea after it's rendered
        if (showReplyInput) {
            setTimeout(() => {
                const textarea = document.getElementById(`reply-textarea-${message.id}`);
                if (textarea) textarea.focus();
            }, 10);
        }
    }
    
    // Submit a reply with enhanced context
    async function submitReply() {
        if (!replyText.trim() || isSubmitting) return;
        
        try {
            isSubmitting = true;
            
            // Prepare the reply context with parent message information
            const { messagesToSend, contextMessage } = prepareReplyContext(
                replyText,
                message.id,
                allMessages,
                aiModel,
                promptType
            );
            
            // Send the reply with parent_msg set to the current message ID and enhanced context
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
    
    // Cancel the reply (hide the input)
    function cancelReply() {
        replyText = '';
        showReplyInput = false;
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
    function handleMessageClick(event) {
        // Don't trigger if clicking on buttons or interactive elements
        if (
            event.target.tagName === 'BUTTON' || 
            event.target.closest('button') || 
            event.target.tagName === 'A' ||
            event.target.tagName === 'INPUT' ||
            event.target.tagName === 'TEXTAREA' ||
            event.target.closest('.message-footer') ||
            event.target.closest('.reply-input-container')
        ) {
            return;
        }
        
        // If thread list is visible, hide it when clicking any message
        if ($showThreadList) {
            // Use the threadListVisibility utility to set the value to false
            threadListVisibility.set(false);
            
            // Store the clicked message ID to scroll to after thread list is hidden
            const messageElement = event.currentTarget;
            const messageId = messageElement.dataset.messageId;
            
            // Wait for the UI to update after hiding thread list
            setTimeout(() => {
                // Find the message element again (as the DOM might have changed)
                const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);
                
                if (targetMessage) {
                    // Scroll the message to the top with smooth animation
                    targetMessage.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start'
                    });
                    
                    // Optional: Add a brief highlight effect to the scrolled message
                    targetMessage.classList.add('scroll-highlight');
                    setTimeout(() => {
                        targetMessage.classList.remove('scroll-highlight');
                    }, 1500);
                }
            }, 100);
        }
    }

    // Handle keyboard shortcuts in the reply textarea
    function handleKeydown(event: KeyboardEvent) {
        // Send on Ctrl+Enter or Cmd+Enter
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            submitReply();
        }
        // Cancel on Escape
        else if (event.key === 'Escape') {
            event.preventDefault();
            cancelReply();
        }
    }
</script>
  
<div 
    class="message {message.role} depth-{depth}"
    class:latest-message={message.id === latestMessageId}
    class:highlighted={message.isHighlighted}
    class:clickable={$showThreadList && childReplies.length > 0}
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
    
    <!-- Reply input area with loading state -->
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
    
    <!-- Replies section -->
    {#if childReplies.length > 0}
        <div class="replies-section">
            <button 
                class="toggle-replies-btn" 
                on:click|stopPropagation={() => toggleReplies(message.id)}
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
                                {name}
                                depth={depth + 1}
                                {getUserProfile}
                                {getAvatarUrl}
                                {processMessageContentWithReplyable}
                                {latestMessageId}
                                {toggleReplies}
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
                on:update
                on:notification
                on:reply={() => handleReply()}
            />
        </div>
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
      /* Depth styling */
    .message.depth-0 {
      /* Top-level styling */

    }
    
    .message.depth-1 {
        margin-left: 1.5rem;
        max-width: calc(80% - 1.5rem);
        
    }
    
    .message.depth-2 {
        margin-left: 1.5rem;
        max-width: calc(80% - 3rem);
    }
    
    .message.depth-3, .message.depth-4, .message.depth-5 {
        margin-left: 1.5rem;
        max-width: calc(80% - 4rem);
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

        padding-left: 0.75rem;
    }
    
    .highlighted {
        box-shadow: 0 0 0 2px var(--highlight-color-secondary, #ffc107);
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
    }
    
    .reply-input-container textarea {
        width: 100%;
        border: none;
        resize: vertical;
        min-height: 60px;
        background-color: transparent;
        padding: 0.5rem;
        font-family: inherit;
        font-size: 0.9rem;
        color: var(--text-color, #333);
        outline: none;
    }
    
    .reply-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.25rem;
    }
    
    .cancel-btn, .send-btn {
        padding: 0.25rem 0.5rem;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .cancel-btn {
      background-color: transparent;
      color: var(--text-muted, #666);
    }
    
    .send-btn {
        background-color: var(--primary-color, #0077cc);
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


    }
    
  }
  </style>