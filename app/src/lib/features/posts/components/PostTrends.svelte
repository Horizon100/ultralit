<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { t } from '$lib/stores/translationStore';
	import { fly } from 'svelte/transition';
	import AgentsConfig from '$lib/features/agents/components/AgentsConfig.svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	const dispatch = createEventDispatcher();

	// App features to highlight
	const appFeatures = [
		{
			title: 'AI Conversations',
			description: 'Start intelligent chats with our AI system'
		},
		{
			title: 'Project Collaboration',
			description: 'Create projects and invite teammates'
		},
		{
			title: 'Task Management',
			description: 'Organize and track your work efficiently'
		},
		{
			title: 'Knowledge Network',
			description: 'Connect your ideas in a visual network'
		},
		{
			title: 'Notes System',
			description: 'Keep your thoughts organized and accessible'
		}
	];

	/*
	 * Getting started steps
	 * export let gettingStarted = [
	 *   { step: $t('getting_started.create_project', 'Create your first project'), completed: false },
	 *   { step: $t('getting_started.start_thread', 'Start a conversation thread'), completed: false },
	 *   { step: $t('getting_started.try_prompts', 'Try out different prompt types'), completed: false },
	 *   { step: $t('getting_started.explore_canvas', 'Explore the canvas feature'), completed: false },
	 *   { step: $t('getting_started.invite_members', 'Invite team members'), completed: false }
	 * ];
	 */

	/*
	 * Sample trending topics - replace with real data later
	 * export let trendingTopics = [
	 *   { topic: '#AIRevolution', posts: '125K' },
	 *   { topic: '#TechInnovation', posts: '89K' },
	 *   { topic: '#MachineLearning', posts: '67K' },
	 *   { topic: '#DigitalTransformation', posts: '45K' },
	 *   { topic: '#FutureOfWork', posts: '34K' }
	 * ];
	 */

	// Sample suggested users - replace with real data later
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
</script>

<aside class="right-sidebar" transition:fly={{ x: 300, duration: 300 }}>
	<div class="sidebar-content">
		<AgentsConfig />

		<!-- App Features Highlight -->
		<!-- <section class="features-section">
			<h3>
				{$t('features.homeIntro.title')}
			</h3>
			<ul class="features-list">
				{#each appFeatures as feature}
					<li class="feature-item">
						<div class="feature-title">{feature.title}</div>
						<div class="feature-description">{feature.description}</div>
					</li>
				{/each}
			</ul>
		</section> -->

		<!-- Getting Started Guide -->
		<!-- <section class="getting-started-section">
      <h3>
        <Compass size={20} />
        {$t('sidebar.getting_started', 'Getting Started')}
      </h3> -->
		<!-- <ul class="getting-started-list">
        {#each gettingStarted as step, index}
          <li class="getting-started-item">
            <label class="step-checkbox">
              <input 
                type="checkbox" 
                checked={step.completed} 
                on:change={() => markStepCompleted(index)}
              />
              <span class="step-label">{step.step}</span>
            </label>
          </li>
        {/each}
      </ul> -->

		<!-- Invite Section -->
		<!-- <div class="invite-section">
        <h4>
          <Share2 size={16} />
          {$t('sidebar.grow_network', 'Grow Your Network')}
        </h4>
        <p class="invite-text">{$t('sidebar.invite_colleagues', 'Invite colleagues to join you and start collaborating')}</p>
        <button class="invite-button" on:click={shareInvite}>
          {$t('sidebar.share_invite', 'Share Invite Link')}
        </button>
      </div>
    </section> -->

		<!-- Trending Topics -->
		<!-- <section class="trending-section">
      <h3>
        <TrendingUp size={20} />
        {$t('sidebar.trending', 'Trending')}
      </h3>
      <ul class="trending-list">
        {#each trendingTopics as trend}
          <li class="trending-item">
            <div class="trend-topic">{trend.topic}</div>
            <div class="trend-posts">{trend.posts} {$t('sidebar.posts', 'posts')}</div>
          </li>
        {/each}
      </ul>
    </section> -->

		<!-- Suggested Users -->
		<!-- <section class="suggestions-section">
      <h3>
        <Users size={20} />
        {$t('sidebar.suggested_for_you', 'Suggested for you')}
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
              {user.following ? $t('sidebar.following', 'Following') : $t('sidebar.follow', 'Follow')}
            </button>
          </li>
        {/each}
      </ul>
    </section> -->
	</div>
</aside>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.right-sidebar {
		width: 250px;
		height: 100vh;
		position: sticky;
		top: 0;
		overflow-y: auto;
		// border-left: 1px solid var(--line-color);
		// background: var(--bg-gradient-left);
	}

	.sidebar-content {
		padding: 1.5rem 1rem;
	}

	.features-section,
	.getting-started-section,
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

	h4 {
		display: flex;
		align-items: center;
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--text-color);
	}

	h3 :global(svg),
	h4 :global(svg) {
		margin-right: 0.5rem;
	}

	.features-list,
	.getting-started-list,
	.trending-list,
	.suggestions-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.feature-item,
	.trending-item {
		padding: 0.75rem;
		border-radius: 8px;
		margin-bottom: 0.5rem;
		transition: background-color 0.2s ease;
	}

	.feature-item:hover,
	.trending-item:hover {
		background-color: rgba(var(--primary-color), 0.1);
	}

	.feature-title,
	.trend-topic {
		font-weight: 600;
		color: var(--text-color);
	}

	.feature-description,
	.trend-posts {
		font-size: 0.85rem;
		color: var(--text-color);
		opacity: 0.7;
		line-height: 1.4;
	}

	.getting-started-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--line-color);
	}

	.getting-started-item:last-child {
		border-bottom: none;
	}

	.step-checkbox {
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	.step-label {
		margin-left: 0.5rem;
		color: var(--text-color);
		font-size: 0.9rem;
	}

	.invite-section {
		margin-top: 1.5rem;
		padding: 1rem;
		border-radius: 8px;
		background-color: rgba(var(--primary-color), 0.1);
	}

	.invite-text {
		font-size: 0.85rem;
		color: var(--text-color);
		margin-bottom: 1rem;
	}

	.invite-button {
		padding: 0.5rem 1rem;
		border-radius: 50px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		background-color: var(--primary-color);
		color: var(--text-color);
		border: 1px solid var(--primary-color);
		width: 100%;
	}

	.invite-button:hover {
		opacity: 0.9;
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
		color: var(--text-color);
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
