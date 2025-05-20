<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/pocketbase';
  import { sidenavStore, showSidenav } from '$lib/stores/sidenavStore';
  import { t } from '$lib/stores/translationStore';
  import { fade } from 'svelte/transition';
  import type { User, UserProfile, Threads, Messages, PublicUserProfile } from '$lib/types/types'
  import { postStore } from '$lib/stores/postStore';
  import type { PostWithInteractions } from '$lib/types/types.posts';
  import { getPublicUserProfile, getPublicUserProfiles } from '$lib/clients/profileClient';
  import { pocketbaseUrl } from '$lib/pocketbase';
  import PostComposer from '$lib/components/ui/PostComposer.svelte';
  import PostCard from '$lib/components/ui/PostCard.svelte';
  import PostCommentModal from '$lib/components/ui/PostCommentModal.svelte';
  import RepostCard from '$lib/components/ui/RepostCard.svelte';
  import PostQuoteCard from '$lib/components/ui/PostQuoteCard.svelte';
  import PostSidenav from '$lib/components/ui/PostSidenav.svelte';
  import PostTrends from '$lib/components/ui/PostTrends.svelte';
  
  let isCommentModalOpen = false;
  let selectedPost: PostWithInteractions | null = null;
  let innerWidth = 0;
  
  let userProfilesMap: Map<string, PublicUserProfile | null> = new Map();

  $: posts = $postStore.posts;
  $: loading = $postStore.loading;
  $: error = $postStore.error;

  $: userIds = [...new Set(posts.flatMap(post => {
    const ids = [post.user];
    if (post.repostedBy && Array.isArray(post.repostedBy)) {
      ids.push(...post.repostedBy);
    }
    return ids;
  }))];
  $: enhancedPosts = posts.map(post => {
    const authorProfile = userProfilesMap.get(post.user);
    
    if (authorProfile) {
      return {
        ...post,
        authorProfile,
        author_name: authorProfile.name || post.author_name,
        author_username: authorProfile.username || post.author_username,
        author_avatar: authorProfile.avatar || post.author_avatar,
      };
    }
    
    return post;
  });
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
  async function getUserProfile(userId: string): Promise<PublicUserProfile | null> {
    if (userProfilesMap.has(userId)) {
      return userProfilesMap.get(userId);
    }
    
    const profile = await getPublicUserProfile(userId);
    userProfilesMap.set(userId, profile);
    return profile;
  }
  // Handle creating a new post
  async function handlePostSubmit(event: CustomEvent<{ content: string; attachments: File[]; parentId?: string }>) {
    try {
      await postStore.addPost(
        event.detail.content,
        event.detail.attachments,
        event.detail.parentId
      );
    } catch (err) {
      console.error('Error creating post:', err);
    }
  }

async function handlePostInteraction(event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share'}>) {
    const { postId, action } = event.detail;
    
    try {
        // Actions that require authentication
        if ((action === 'upvote' || action === 'repost' || action === 'read') && !$currentUser) {
            // Redirect to login or show login prompt
            alert('Please sign in to interact with posts');
            return;
        }
        
        // Process the actions
        if (action === 'upvote') {
            await postStore.toggleUpvote(postId);
        } else if (action === 'repost') {
            await postStore.toggleRepost(postId);
        } else if (action === 'read') {
            await postStore.markAsRead(postId);
        } else if (action === 'share') {
            // Share works for both logged-in and guest users
            await postStore.sharePost(postId);
        }
    } catch (err) {
        console.error(`Error ${action}ing post:`, err);
    }
}

  // Handle opening comment modal (from PostCard)
  function handleComment(event: CustomEvent<{ postId: string }>) {
    if (!$currentUser) {
      // Redirect to login or show login prompt
      alert('Please sign in to comment on posts');
      return;
    }
    
    const post = posts.find(p => p.id === event.detail.postId);
    if (post) {
      selectedPost = post;
      isCommentModalOpen = true;
    }
  }

  // Handle submitting a comment (from PostCommentModal)
  async function handleCommentSubmit(event: CustomEvent<{ content: string; attachments: File[]; parentId: string }>) {
    const { content, attachments, parentId } = event.detail;
    
    if (!$currentUser) {
      console.error('User not logged in');
      return;
    }
    
    try {
      await postStore.addPost(content, attachments, parentId);
      
      // Close the modal after successful comment
      isCommentModalOpen = false;
      selectedPost = null;
      
      // Optionally refresh the posts to show the new comment
      await postStore.fetchPosts(20, 0);
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  }

  async function handleQuote(event) {
    if (!$currentUser) {
      // Redirect to login or show login prompt
      alert('Please sign in to quote posts');
      return;
    }
    
    const { content, attachments, quotedPostId } = event.detail;
    
    try {
        await postStore.quotePost(quotedPostId, content, attachments);
        // Optionally show success message or redirect
    } catch (error) {
        console.error('Failed to quote post:', error);
        // Handle error (show toast, etc.)
    }
  }

  function handleCloseCommentModal() {
    isCommentModalOpen = false;
    selectedPost = null;
  }

  async function handleFollowUser(event) {
    const { userId } = event.detail;
    console.log('Follow user action:', userId);
    
    const userProfile = await getPublicUserProfile(userId);
    console.log('Following user profile:', userProfile);
    
  }

  onMount(async () => {
    console.log('Home page mounted, showSidenav:', $showSidenav);
    
    // Fetch posts when component mounts
    if (posts.length === 0) {
      try {
        await postStore.fetchPosts(20, 0);
      } catch (err) {
        console.error('Error fetching posts:', err);
      }
    }
    
    // Load user profiles for all post authors in a batch
    if (userIds.length > 0) {
      try {
        const profiles = await getPublicUserProfiles(userIds);
        
        // Update profiles map
        userIds.forEach((id, index) => {
          if (profiles[index]) {
            userProfilesMap.set(id, profiles[index]);
          }
        });
        
        // Force component update
        userProfilesMap = new Map(userProfilesMap);
      } catch (err) {
        console.error('Error fetching user profiles:', err);
      }
    }
  });
  
  // When posts change, load any missing user profiles
  $: if (posts.length > 0 && userIds.length > 0) {
    const missingUserIds = userIds.filter(id => !userProfilesMap.has(id));
    
    if (missingUserIds.length > 0) {
      getPublicUserProfiles(missingUserIds)
        .then(profiles => {
          missingUserIds.forEach((id, index) => {
            if (profiles[index]) {
              userProfilesMap.set(id, profiles[index]);
            }
          });
          
          // Force component update
          userProfilesMap = new Map(userProfilesMap);
        })
        .catch(err => {
          console.error('Error fetching user profiles:', err);
        });
    }
  }
  
  // Reactive statements for debugging
  $: console.log('Sidenav visibility changed:', $showSidenav);
  $: console.log('Posts:', posts);
  $: console.log('Loading:', loading);
  $: console.log('Error:', error);
</script>

<svelte:window bind:innerWidth />

<div class="home-container" class:hide-left-sidebar={!$showSidenav}>
  <!-- Left Sidebar Component -->
  <PostSidenav {innerWidth} />
  
  <!-- Main Content -->
  <main class="main-content">
    <div class="main-wrapper">
      <!-- Create Post Section -->
      <section class="create-post">
        {#if $currentUser}
          <PostComposer 
            on:submit={handlePostSubmit}
          />
        {:else}
          <div class="login-prompt">
            <p>Please <a href="/login">sign in</a> to create a post.</p>
          </div>
        {/if}
      </section>
      
      <!-- Error Display -->
      {#if error}
        <div class="error-message">
          {error}
        </div>
      {/if}
      
      <!-- Loading State -->
      {#if loading && posts.length === 0}
        <div class="loading-state">
          <p>Loading posts...</p>
        </div>
      {/if}
      
      <!-- Posts Feed -->
      <section class="posts-feed">
        <h2 class="feed-title">Latest Updates</h2>
        {#each enhancedPosts as post (post.id)}
          {#if post.isRepost}
            <RepostCard 
              post={post}
              repostedBy={{
                id: post.repostedBy_id || $currentUser?.id,
                username: post.repostedBy_username || $currentUser?.username,
                name: post.repostedBy_name || $currentUser?.name,
                avatar: post.repostedBy_avatar || $currentUser?.avatar
              }}
              authorProfile={post.authorProfile || null}
              on:interact={handlePostInteraction}
              on:comment={handleComment}
              on:quote={handleQuote}
            />
          {:else if post.quotedPost}
            <PostQuoteCard 
              post={post}
              quotedBy={{
                id: post.user,
                username: post.author_username,
                name: post.author_name,
                avatar: post.author_avatar
              }}
              authorProfile={post.authorProfile || null}
              on:interact={handlePostInteraction}
              on:comment={handleComment}
              on:quote={handleQuote}
            />
          {:else}
            <PostCard 
              post={post}
              authorProfile={post.authorProfile || null}
              on:interact={handlePostInteraction}
              on:comment={handleComment}
              on:quote={handleQuote}
            />
          {/if}
        {/each}
        
        {#if posts.length === 0 && !loading}
          <div class="empty-state">
            <p>No posts yet. Be the first to share something!</p>
          </div>
        {/if}
      </section>
    </div>
  </main>

  <!-- Right Sidebar Component -->
  {#if innerWidth > 1200}
    <PostTrends 
      userProfiles={Array.from(userProfilesMap.values()).filter(Boolean)}
      on:followUser={handleFollowUser} 
    />
  {/if}
</div>

<PostCommentModal 
  isOpen={isCommentModalOpen && $currentUser !== null}
  post={selectedPost}
  on:close={handleCloseCommentModal}
  on:comment={handleCommentSubmit}
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
  .home-container {
    display: flex;
    justify-content: center;
    min-height: 100vh;
    width: 100%;
    padding-bottom: 3rem;
    background-color: var(--primary-color);
  }

  .home-container.hide-left-sidebar .main-content {
    margin-left: 0;
  }

  .main-content {
    flex: 1;
    padding: 0.5rem;
    max-width: 800px;
    width: 100%;
    overflow-y: auto;
    margin-bottom: 2rem;
        background: var(--bg-color);

  }

  .main-wrapper {
    max-width: calc(100% - 2rem);
    margin: 0 auto;
  }

  .create-post {
    margin-bottom: 2rem;
  }

  .feed-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    color: var(--text-color);
  }

  .posts-feed {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .error-message {
    padding: 1rem;
    background-color: rgba(255, 0, 0, 0.1);
    border: 1px solid rgba(255, 0, 0, 0.3);
    border-radius: 8px;
    color: #ff3333;
    margin-bottom: 1rem;
  }

  .loading-state {
    display: flex;
    justify-content: center;
    padding: 2rem 0;
    color: var(--text-color);
    opacity: 0.7;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 0;
    color: var(--text-color);
    opacity: 0.7;
  }

.login-prompt {
    background-color: var(--bg-color);
    border: 1px dashed var(--line-color);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    color: var(--text-color);
  }

  .login-prompt a {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 600;
  }

  .login-prompt a:hover {
    text-decoration: underline;
  }
  @media (max-width: 768px) {
    .main-content {
      padding: 1rem;
    }
  }
</style>