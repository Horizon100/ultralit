<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PostCard from './PostCard.svelte';
  import { Repeat } from 'lucide-svelte';
  import { pocketbaseUrl } from '$lib/pocketbase';
  
  export let post: any;
  export let repostedBy: any;
  
  const dispatch = createEventDispatcher();
  
  function handleInteract(event: any) {
    dispatch('interact', event.detail);
  }
  
  function handleComment(event: any) {
    dispatch('comment', event.detail);
  }
</script>

<article class="repost-wrapper">
  <!-- Repost header -->
  <div class="repost-header">
    <a href="/{repostedBy.username}" class="reposter-link">
      <img 
        src={repostedBy.avatar ? `${pocketbaseUrl}/api/files/users/${repostedBy.id}/${repostedBy.avatar}` : '/api/placeholder/20/20'} 
        alt="{repostedBy.name || repostedBy.username}'s avatar" 
        class="reposter-avatar" 
      />
    </a>
    <Repeat size={16} />
    <a href="/{repostedBy.username}" class="reposter-name">
      {repostedBy.name || repostedBy.username} reposted
    </a>
  </div>
  
  <!-- Original post -->
  <PostCard 
    {post}
    showActions={true}
    isRepost={false}
    on:interact={handleInteract}
    on:comment={handleComment}
  />
</article>

<style lang="scss">
  $breakpoint-sm: 576px;
  $breakpoint-md: 1000px;
  $breakpoint-lg: 992px;
  $breakpoint-xl: 1200px;
	@use "src/styles/themes.scss" as *;
  * {

    font-family: var(--font-family);
  }    
  .repost-wrapper {
    margin-bottom: 1rem;
    border-radius: 12px;
    overflow: hidden;
    // border: 1px solid var(--line-color);
  }
  
  .repost-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--secondary-color);
    font-size: 0.9rem;
    padding: 12px 16px 8px;
    background: rgba(var(--secondary-color-rgb), 0.05);
    // border-bottom: 1px solid var(--line-color);
  }
  
  .reposter-link {
    text-decoration: none;
  }
  
  .reposter-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .reposter-name {
    color: var(--secondary-color);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }
  
  .reposter-name:hover {
    color: var(--text-color);
  }
  
  .repost-wrapper :global(.post-card) {
    margin-bottom: 0;
    margin-left: 3rem;
    border-radius: 1rem;
    border-top: none;

    border: 1px solid var(--line-color);
  }
</style>