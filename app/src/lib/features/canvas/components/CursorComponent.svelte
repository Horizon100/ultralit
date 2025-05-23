<script lang="ts">
	import type { CursorPosition } from '$lib/types/types';
	import { currentUser } from '$lib/pocketbase';

	export let cursor: CursorPosition;
	export let transform: { scale: number; offsetX: number; offsetY: number };

	$: userName = cursor.name || 'Unknown User';
	$: avatarUrl = null; // We don't have avatar information in real-time data
</script>

<div
	class="cursor"
	style="left: {cursor.position.x * transform.scale + transform.offsetX}px; top: {cursor.position
		.y *
		transform.scale +
		transform.offsetY}px;"
>
	<div class="cursor-pointer"></div>
	<div class="cursor-info">
		<div class="avatar-placeholder"></div>
		<span class="cursor-name">{userName}</span>
	</div>
</div>

<style>
	.cursor {
		position: absolute;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.cursor-pointer {
		width: 10px;
		height: 10px;
		background: red;
		border: 2px solid #000;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}

	.cursor-info {
		display: flex;
		align-items: center;
		background-color: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 2px 5px;
		border-radius: 3px;
		font-size: 12px;
		white-space: nowrap;
		transform: translateY(-100%);
	}

	.avatar-placeholder {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		margin-right: 5px;
		background-color: blue;
	}

	.cursor-name {
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
