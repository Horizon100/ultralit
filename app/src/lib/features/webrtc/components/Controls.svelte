<!-- Updated src/lib/components/Controls.svelte -->
<script lang="ts">
    import { callStore, toggleVideo, toggleAudio } from '$lib/features/webrtc/stores/call-store';
    export let compact = false;

    async function handleScreenShare() {
        if ($callStore.isScreenSharing) {
            await callStore.stopScreenShare();
        } else {
            await callStore.startScreenShare();
        }
    }

    async function handleLeaveCall() {
        await callStore.leaveRoom();
        // Navigate back or show confirmation
        if (typeof window !== 'undefined') {
            window.history.back();
        }
    }
</script>

<div class="controls" class:compact>
    <button 
        class="control-btn {$callStore.isVideoEnabled ? 'active' : 'inactive'}"
        on:click={toggleVideo}
        title={$callStore.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        disabled={!$callStore.isInCall}
    >
        {#if $callStore.isVideoEnabled}
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
        {:else}
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
        {/if}
    </button>
    
    <button 
        class="control-btn {$callStore.isAudioEnabled ? 'active' : 'inactive'}"
        on:click={toggleAudio}
        title={$callStore.isAudioEnabled ? 'Mute' : 'Unmute'}
        disabled={!$callStore.isInCall}
    >
        {#if $callStore.isAudioEnabled}
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
        {:else}
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
        {/if}
    </button>
    
    <button 
        class="control-btn danger" 
        title="Leave call"
        on:click={handleLeaveCall}
        disabled={!$callStore.isInCall}
    >
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18" />
        </svg>
    </button>
    
    {#if !compact}
        <button 
            class="control-btn {$callStore.isScreenSharing ? 'active' : 'secondary'}" 
            title={$callStore.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            on:click={handleScreenShare}
            disabled={!$callStore.isInCall}
        >
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
        </button>
        
        <button class="control-btn secondary" title="Settings" disabled>
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        </button>
    {/if}
</div>

<style lang="scss">
	:root {
		font-family: var(--font-family);
	}	
	* {
		font-family: var(--font-family);
	}	  
    .controls {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 1rem;
        background: rgba(0, 0, 0, 0.8);
        padding: 1rem;
        border-radius: 2rem;
        backdrop-filter: blur(10px);
        border: 1px solid #333;
        z-index: 100;
    }
    
    .controls.compact {
        position: static;
        transform: none;
        background: transparent;
        padding: 0.5rem;
        border-radius: 0.5rem;
        gap: 0.5rem;
        justify-content: center;
        z-index: auto;
    }

    .control-btn {
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .controls.compact .control-btn {
        width: 2rem;
        height: 2rem;
    }
    
    .icon {
        width: 1.25rem;
        height: 1.25rem;
    }
    
    .controls.compact .icon {
        width: 1rem;
        height: 1rem;
    }

    .control-btn.active {
        background: #10b981;
        color: var(--text-color);
    }

    .control-btn.inactive {
        background: #ef4444;
        color: var(--text-color);
    }

    .control-btn.danger {
        background: #dc2626;
        color: var(--text-color);
    }
    
    .control-btn.secondary {
        background: #374151;
        color: #9ca3af;
    }
    
    .control-btn.secondary:hover:not(:disabled) {
        background: #4b5563;
        color: var(--text-color);
    }

    .control-btn:hover:not(:disabled) {
        transform: scale(1.05);
    }
    
    .controls.compact .control-btn:hover:not(:disabled) {
        transform: scale(1.1);
    }

    .control-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
    }
</style>
