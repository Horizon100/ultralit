<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { PostWithInteractions } from '$lib/types/types.posts';
    import { pocketbaseUrl, currentUser } from '$lib/pocketbase';
    import PostReplyModal from '$lib/features/content/components/PostReplyModal.svelte';
    import ShareModal from '$lib/components/modals/ShareModal.svelte';
    import { t } from '$lib/stores/translationStore';
    import { 
        MessageSquare, 
        Heart, 
        Repeat, 
        Share, 
        MoreHorizontal,
        Paperclip
    } from 'lucide-svelte';

    export let post: PostWithInteractions;
    export let showActions: boolean = true;
    export let isRepost: boolean = false;
    export let isOwnRepost: boolean = false;
    export let isComment: boolean = false;
    export let isQuote: boolean = false;

    let showTooltip = false;
    let tooltipTimeout: NodeJS.Timeout;
    let showShareModal = false;
    let showQuoteModal = false;
    
  const dispatch = createEventDispatcher<{
    interact: { postId: string; action: 'upvote' | 'repost' | 'read' | 'share' };
    comment: { postId: string };
    quote: { content: string; attachments: File[]; quotedPostId: string };

  }>();
  
  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  }
  
  function handleInteraction(action: 'upvote' | 'repost' | 'read') {
    dispatch('interact', { postId: post.id, action });
  }
  
  function handleComment() {
    dispatch('comment', { postId: post.id });
  }
async function handleShare() {
    showShareModal = true;
}
async function handleCopyLink() {
    const postUrl = `${window.location.origin}/${post.author_username}/posts/${post.id}`;
    
    try {
        await navigator.clipboard.writeText(postUrl);
        
        showTooltip = true;
        clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(() => {
            showTooltip = false;
        }, 2000);

        if (!post.share) {
            dispatch('interact', { postId: post.id, action: 'share' });
        }
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        showTooltip = true;
        clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(() => {
            showTooltip = false;
        }, 2000);
    }
}

function handleQuote() {
    showQuoteModal = true;
}

function handleQuoteSubmit(event: CustomEvent<{ content: string; attachments: File[]; quotedPostId: string }>) {
    dispatch('quote', event.detail);
    showQuoteModal = false;
}
</script>

<article class="post-card" class:comment={isComment}>
  {#if isRepost}
    <div class="repost-indicator">
      <Repeat size={14} />
      <span>{$t('posts.repostedBy')} {post.author_name || post.author_username}</span>
    </div>
  {:else if isOwnRepost}
    <div class="repost-indicator own-repost">
      <Repeat size={14} />
      <span>{$t('posts.youReposted')}</span>
    </div>
  {/if}
  <div class="post-header">

  
    <a href="/{post.author_username}" class="avatar-link">
      <img 
        src={post.author_avatar ? `${pocketbaseUrl}/api/files/users/${post.user}/${post.author_avatar}` : '/api/placeholder/40/40'} 
        alt="{post.author_username || post.author_name}'s avatar" 
        class="post-avatar" 
      />
    </a>
    <div class="post-meta">
      <!-- Make author name clickable -->
      <a href="/{post.author_username}" class="author-link">
        <div class="post-author">
          {post.author_name || post.author_username || 'Unknown User'}
        </div>
      </a>
      <div class="post-timestamp">{formatTimestamp(post.created)}</div>
    </div>
    {#if showActions}
      <button class="post-options">
        <MoreHorizontal size={16} />
      </button>
    {/if}
  </div>
  
{#if !isComment}
  <a href="/{post.author_username}/posts/{post.id}" class="post-content-link">
    <div class="post-content">
      <p>{post.content}</p>
      
      {#if post.attachments && post.attachments.length > 0}
        <div class="post-attachments">
          {#each post.attachments as attachment}
            <div class="attachment">
              {#if attachment.file_type === 'image'}
                <img 
                  src="/api/files/posts/{attachment.id}/{attachment.file_path}"
                  alt={attachment.original_name}
                  class="attachment-image"
                />
              {:else}
                <div class="attachment-file">
                  <Paperclip size={16} />
                  <span>{attachment.original_name}</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </a>
{:else}
  <!-- For comments, just show content without link -->
  <div class="post-content">
    <p>{post.content}</p>
    
    {#if post.attachments && post.attachments.length > 0}
      <div class="post-attachments">
        {#each post.attachments as attachment}
          <div class="attachment">
            {#if attachment.file_type === 'image'}
              <img 
                src="/api/files/posts/{attachment.id}/{attachment.file_path}"
                alt={attachment.original_name}
                class="attachment-image"
              />
            {:else}
              <div class="attachment-file">
                <Paperclip size={16} />
                <span>{attachment.original_name}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
  
  {#if showActions}
    <div class="post-actions">
      <button 
        class="action-button comment"
        title="Comment"
        on:click={handleComment}
      >
        <MessageSquare size={16} />
        <span>{post.commentCount || 0}</span>
      </button>
      
      <button 
        class="action-button repost"
        class:active={post.repost}
        on:click={() => handleInteraction('repost')}
        title={$t('posts.repost')} 
      >
        <Repeat size={16} />
        <span>{post.repostCount || 0}</span>
      </button>
      
      <button 
        class="action-button upvote"
        class:active={post.upvote}
        on:click={() => handleInteraction('upvote')}
        title={$t('posts.postUpvote')} 
      >
        <Heart size={16} />
        <span>{post.upvoteCount || 0}</span>
      </button>
      
<button 
    class="action-button share"
    class:shared={post.share}
    title={$t('generic.share')} 
    on:click={handleShare}
>
    <Share size={16} />
    <span>{(post.shareCount || 0) + (post.quoteCount || 0)}</span>
    {#if showTooltip}
        <span class="tooltip">{$t('generic.copiedLink')} </span>
    {/if}
</button>
      
      <!-- Read indicator -->
      {#if post.readCount > 0}
        <div class="read-status" title="{post.readCount} readers">
          <span class="read-count">{post.readCount} {$t('generic.postRead')} </span>
        </div>
      {/if}
    </div>
  {/if}
</article>
<ShareModal 
  bind:isOpen={showShareModal}
  {post}
  on:close={() => showShareModal = false}
  on:copyLink={handleCopyLink}
  on:quote={handleQuote}
/>

<!-- Quote Modal -->
<PostReplyModal 
  bind:isOpen={showQuoteModal}
  {post}
  on:close={() => showQuoteModal = false}
  on:quote={handleQuoteSubmit}
/>
<style lang="scss">
  $breakpoint-sm: 576px;
  $breakpoint-md: 1000px;
  $breakpoint-lg: 992px;
  $breakpoint-xl: 1200px;
	@use "src/styles/themes.scss" as *;
  * {

    font-family: var(--font-family);
  }    
  .post-card {
    border-bottom: 1px solid var(--line-color);
    padding: 0.5rem 0;
    transition: all 0.2s ease;
  }
  
  .post-card:hover {
    // border-color: var(--primary-color);
  }
  
  .post-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  /* Avatar link styles */
  .avatar-link {
    text-decoration: none;
    border-radius: 50%;
    overflow: hidden;
    transition: transform 0.2s ease;
  }
  
  .avatar-link:hover {
    transform: scale(1.05);
  }
  
  .post-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .post-meta {
    flex: 1;
  }
  
  /* Author link styles */
  .author-link {
    text-decoration: none;
    color: inherit;
    display: inline-block;
    transition: color 0.2s ease;
  }
  
  .author-link:hover {
    color: var(--primary-color);
  }
  
  .post-author {
    font-weight: 600;
    color: var(--text-color);
    font-size: 0.95rem;
  }
  
  .author-link:hover .post-author {
    color: var(--primary-color);
  }
  
  .post-timestamp {
    color: var(--placeholder-color);
    font-size: 0.85rem;
    margin-top: 2px;
  }
  
  .post-options {
    background: none;
    border: none;
    color: var(--placeholder-color);
    padding: 4px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .post-options:hover {
    background: var(--line-color);
    color: var(--text-color);
  }
  
  /* Post content link styles */
  .post-content-link {
    text-decoration: none;
    color: inherit;
    display: block;
    transition: all 0.2s ease;
    border-radius: 8px;
    padding: 4px;
    margin: -4px;
  }
  
  .post-content-link:hover {
    background: rgba(var(--primary-color-rgb), 0.05);
  }
  
  .post-content {
    color: var(--text-color);
    line-height: 1.5;
    margin-bottom: 12px;
  }
  
  .post-content p {
    margin: 0;
    margin-left: 3rem;
  }
  
  .post-attachments {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .attachment-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    border: 1px solid var(--line-color);
  }
  
  .attachment-file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--line-color);
    border-radius: 8px;
    color: var(--text-color);
    font-size: 0.9rem;
  }
  
  .post-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-left: 3rem;
  }
  
  .action-button {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--placeholder-color);
    font-size: 0.9rem;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .action-button:hover {
    background: var(--line-color);
    color: var(--text-color);
  }
  
  .action-button.active {
    color: var(--primary-color);
  }
  
  .action-button.active:hover {
    color: var(--primary-color);
    background: var(--line-color);
  }
  
  .action-button.upvote.active {
    color: #e91e63;
  }
  
  .action-button.repost.active {
    color: #00c853;
  }
  
  .read-status {
    margin-left: auto;
    color: var(--placeholder-color);
    font-size: 0.85rem;
  }
  
  .read-count {
    opacity: 0.7;
  }
  .tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text-color);
  color: var(--bg-color);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  white-space: nowrap;
  margin-bottom: 4px;
  z-index: 10;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--text-color);
}
.action-button.share.shared {
    color: var(--secondary-color);
}

.action-button.share {
    position: relative;
}

/* Keep the hover effect for all states */
.action-button.share:hover {
    background: var(--line-color);
    color: var(--text-color);
}
  .repost-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--secondary-color);
    font-size: 0.85rem;
    margin-bottom: 12px;
    padding: 6px 12px;
    background: rgba(var(--secondary-color-rgb), 0.1);
    border-radius: 8px;
    border-left: 3px solid var(--secondary-color);
  }
  
  .repost-indicator.own-repost {
    color: var(--primary-color);
    background: rgba(var(--primary-color-rgb), 0.1);
    border-left-color: var(--primary-color);
  }
  /* Mobile responsive */
  @media (max-width: 768px) {
    .post-card {
      padding: 12px;
    }
    
    .post-actions {
      gap: 12px;
    }
    
    .action-button {
      padding: 4px 6px;
    }
  }
</style>