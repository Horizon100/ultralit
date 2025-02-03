<script lang="ts">
	import { Bot } from 'lucide-svelte';

	export let role: 'user' | 'assistant' | 'thinking';
	export let avatarUrl: string | null;
	export let username: string;
	export let created: string;
</script>

<div class="message-header">
	{#if role === 'user'}
		<div class="avatar-container">
			{#if avatarUrl}
				<img src={avatarUrl} alt="User avatar" class="avatar" />
			{:else}
				<div class="avatar-placeholder">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="feather feather-user"
						><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"
						></circle></svg
					>
				</div>
			{/if}
		</div>
		<span class="role">{username}</span>
		<div class="message-time">
			{#if created}
				{new Date(created).toLocaleTimeString()}
			{:else}
				Time not available
			{/if}
		</div>
	{:else if role === 'thinking'}
		<span class="role">
			<Bot size="50" color="white" />
		</span>
	{/if}
</div>

<style lang="scss">
	.message-header {
		display: flex;
		gap: 10px;
		justify-content: left;
		align-items: center;
		width: 100%;
	}
</style>
