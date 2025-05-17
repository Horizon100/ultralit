<script lang="ts">
  import { TrendingUp, Users } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  
  // Trending topics and suggested users
  export let trendingTopics = [
    { topic: '#AIRevolution', posts: '125K' },
    { topic: '#TechInnovation', posts: '89K' },
    { topic: '#MachineLearning', posts: '67K' },
    { topic: '#DigitalTransformation', posts: '45K' },
    { topic: '#FutureOfWork', posts: '34K' }
  ];
  
  export let suggestedUsers = [
    {
      id: 1,
      username: 'ai_pioneer',
      name: 'Dr. Sarah Chen',
      avatar: '/api/placeholder/40/40',
      bio: 'AI Researcher at MIT | Building the future of machine learning',
      following: false
    },
    {
      id: 2,
      username: 'tech_visionary',
      name: 'Marcus Rodriguez',
      avatar: '/api/placeholder/40/40',
      bio: 'Founder & CEO | Transforming industries with AI',
      following: false
    },
    {
      id: 3,
      username: 'data_scientist',
      name: 'Emily Parker',
      avatar: '/api/placeholder/40/40',
      bio: 'Senior Data Scientist | Turning data into insights',
      following: true
    }
  ];
  
  function followUser(userId: number) {
    suggestedUsers = suggestedUsers.map(user => {
      if (user.id === userId) {
        return { ...user, following: !user.following };
      }
      return user;
    });
    
    dispatch('followUser', { userId });
  }
</script>

<aside class="right-sidebar">
  <div class="sidebar-content">
    <!-- Trending Topics -->
    <section class="trending-section">
      <h3>
        <TrendingUp size={20} />
        Trending
      </h3>
      <ul class="trending-list">
        {#each trendingTopics as trend}
          <li class="trending-item">
            <div class="trend-topic">{trend.topic}</div>
            <div class="trend-posts">{trend.posts} posts</div>
          </li>
        {/each}
      </ul>
    </section>
    
    <!-- Suggested Users -->
    <section class="suggestions-section">
      <h3>
        <Users size={20} />
        Suggested for you
      </h3>
      <ul class="suggestions-list">
        {#each suggestedUsers as user}
          <li class="suggestion-item">
            <img src={user.avatar} alt="{user.name}'s avatar" class="suggestion-avatar" />
            <div class="suggestion-info">
              <div class="suggestion-name">{user.name}</div>
              <div class="suggestion-username">@{user.username}</div>
              <div class="suggestion-bio">{user.bio}</div>
            </div>
            <button 
              class="follow-button"
              class:following={user.following}
              on:click={() => followUser(user.id)}
            >
              {user.following ? 'Following' : 'Follow'}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</aside>

<style lang="scss">
    $breakpoint-sm: 576px;
    $breakpoint-md: 1000px;
    $breakpoint-lg: 992px;
    $breakpoint-xl: 1200px;
    @use "src/styles/themes.scss" as *;
    * {

      font-family: var(--font-family);
    }   
  .right-sidebar {
    width: 320px;
    height: 100vh;
    position: sticky;
    top: 0;
    overflow-y: auto;
    border-left: 1px solid var(--line-color);
    background: var(--bg-gradient-left);
  }

  .sidebar-content {
    padding: 1.5rem 1rem;
  }

  .trending-section,
  .suggestions-section {
    margin-bottom: 2rem;
  }

  h3 {
    display: flex;
    align-items: center;
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--text-color);
  }

  h3 :global(svg) {
    margin-right: 0.5rem;
  }

  .trending-list,
  .suggestions-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .trending-item {
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    transition: background-color 0.2s ease;
  }

  .trending-item:hover {
    background-color: rgba(var(--primary-color), 0.1);
  }

  .trend-topic {
    font-weight: 600;
    color: var(--text-color);
  }

  .trend-posts {
    font-size: 0.85rem;
    color: var(--text-color);
    opacity: 0.7;
  }

  .suggestion-item {
    display: flex;
    align-items: start;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    transition: background-color 0.2s ease;
  }

  .suggestion-item:hover {
    background-color: rgba(var(--primary-color), 0.1);
  }

  .suggestion-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 0.75rem;
  }

  .suggestion-info {
    flex: 1;
  }

  .suggestion-name {
    font-weight: 600;
    color: var(--text-color);
  }

  .suggestion-username {
    font-size: 0.85rem;
    color: var(--text-color);
    opacity: 0.7;
    margin-bottom: 0.25rem;
  }

  .suggestion-bio {
    font-size: 0.85rem;
    color: var(--text-color);
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .follow-button {
    padding: 0.5rem 1rem;
    border-radius: 50px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    background-color: var(--primary-color);
    color: white;
    border: 1px solid var(--primary-color);
  }

  .follow-button.following {
    background-color: transparent;
    color: var(--primary-color);
  }

  .follow-button:hover {
    opacity: 0.9;
  }
</style>