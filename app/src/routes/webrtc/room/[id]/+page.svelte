<!-- src/routes/room/[id]/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import VideoGrid from '$lib/features/webrtc/components/VideoGrid.svelte';
  import Controls from '$lib/features/webrtc/components/Controls.svelte';
  import Chat from '$lib/features/webrtc/components/Chat.svelte';
  import { callStore } from '$lib/features/webrtc/stores/call-store';
  import { participantsStore } from '$lib/features/webrtc/stores/participants-store';
  import { chatStore } from '$lib/features/webrtc/stores/chat-store';

  const roomId = $page.params.id;
  let userId = '';
  let isJoining = false;
  let showJoinDialog = true;
  let error = '';

  // Generate a random user ID if not provided
  onMount(() => {
    if (browser) {
      // Try to get user ID from localStorage or generate one
      userId = localStorage.getItem('videoCall_userId') || 
               `User_${Math.random().toString(36).substring(2, 8)}`;
      
      // Initialize the call store
      callStore.init();
      
      // Check if we should auto-join (e.g., from URL params)
      const urlParams = new URLSearchParams(window.location.search);
      const autoJoin = urlParams.get('autoJoin');
      const urlUserId = urlParams.get('userId');
      
      if (urlUserId) {
        userId = urlUserId;
      }
      
      if (autoJoin === 'true') {
        showJoinDialog = false;
        joinRoom();
      }
    }
  });

  onDestroy(() => {
    // Clean up when leaving the page
    if ($callStore.isInCall) {
      callStore.leaveRoom();
    }
    callStore.destroy();
    participantsStore.clear();
    chatStore.clear();
  });

  async function joinRoom() {
    if (!userId.trim()) {
      error = 'Please enter a username';
      return;
    }

    isJoining = true;
    error = '';

    try {
      // Save user ID for future use
      if (browser) {
        localStorage.setItem('videoCall_userId', userId);
      }

      // Initialize participants store with WebRTC client
      participantsStore.initFromClient();

      // Join the room
      await callStore.joinRoom(roomId, userId);
      
      // Add system message to chat
      chatStore.addSystemMessage(`${userId} joined the room`);
      
      showJoinDialog = false;
      console.log(`Successfully joined room ${roomId} as ${userId}`);
    } catch (err) {
      console.error('Failed to join room:', err);
      error = err.message || 'Failed to join room';
    } finally {
      isJoining = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !isJoining) {
      joinRoom();
    }
  }

  function leaveRoom() {
    callStore.leaveRoom();
    goto('/webrtc/dashboard');
  }

  // Watch for call store errors
  $: if ($callStore.error) {
    error = $callStore.error;
    setTimeout(() => {
      callStore.clearError();
      error = '';
    }, 5000);
  }

  // Handle connection status changes
  $: if ($callStore.isInCall && showJoinDialog) {
    showJoinDialog = false;
  }
</script>

<svelte:head>
  <title>Video Call - Room {roomId}</title>
</svelte:head>

{#if showJoinDialog}
  <!-- Join Room Dialog -->
  <div class="join-overlay">
    <div class="join-dialog">
      <div class="join-header">
        <h1>Join Video Call</h1>
        <p>Room: <strong>{roomId}</strong></p>
      </div>

      <div class="join-form">
        <div class="input-group">
          <label for="username">Your Name</label>
          <input
            id="username"
            type="text"
            bind:value={userId}
            on:keydown={handleKeydown}
            placeholder="Enter your name"
            class="username-input"
            disabled={isJoining}
            autocomplete="name"
          />
        </div>

        {#if error}
          <div class="error-message">
            {error}
          </div>
        {/if}

        <div class="join-actions">
          <button
            class="join-btn"
            on:click={joinRoom}
            disabled={isJoining || !userId.trim()}
          >
            {#if isJoining}
              <svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Joining...
            {:else}
              Join Room
            {/if}
          </button>
          
          <button
            class="cancel-btn"
            on:click={() => goto('/')}
            disabled={isJoining}
          >
            Cancel
          </button>
        </div>
      </div>

      <div class="join-info">
        <h3>Before you join:</h3>
        <ul>
          <li>🎥 Make sure your camera and microphone are working</li>
          <li>🔊 Check your audio settings</li>
          <li>🌐 Ensure you have a stable internet connection</li>
          <li>💬 You can chat with other participants</li>
        </ul>
      </div>
    </div>
  </div>
{:else}
  <!-- Main Video Call Interface -->
  <div class="video-call-container">
    <!-- Connection Status Bar -->
    {#if $callStore.isConnecting}
      <div class="status-bar connecting">
        <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Connecting to room...
      </div>
    {:else if !$callStore.isInCall}
      <div class="status-bar error">
        ⚠️ Connection lost. Attempting to reconnect...
      </div>
    {:else}
      <div class="status-bar connected">
        ✅ Connected to room {roomId}
      </div>
    {/if}

    <!-- Main Content Area -->
    <div class="main-content">
      <!-- Video Grid -->
      <div class="video-area">
        <VideoGrid />
        
        <!-- Room Info Overlay -->
        <div class="room-info">
          <span class="room-id">Room: {roomId}</span>
          <span class="participant-count">
            {$participantsStore.length} participant{$participantsStore.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <!-- Sidebar with Chat -->
      <div class="sidebar">
        <Chat />
      </div>
    </div>

    <!-- Controls -->
    <Controls />

    <!-- Error Toast -->
    {#if error}
      <div class="error-toast">
        <span>{error}</span>
        <button on:click={() => error = ''}>×</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Join Dialog Styles */
  .join-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .join-dialog {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .join-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .join-header h1 {
    margin: 0 0 0.5rem 0;
    color: #1f2937;
    font-size: 1.75rem;
    font-weight: 700;
  }

  .join-header p {
    margin: 0;
    color: #6b7280;
    font-size: 1rem;
  }

  .join-form {
    margin-bottom: 2rem;
  }

  .input-group {
    margin-bottom: 1rem;
  }

  .input-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #374151;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .username-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  .username-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .username-input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
  }

  .error-message {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #fecaca;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .join-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .join-btn {
    flex: 1;
    background: #667eea;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .join-btn:hover:not(:disabled) {
    background: #5a67d8;
    transform: translateY(-1px);
  }

  .join-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .cancel-btn {
    background: #f3f4f6;
    color: #374151;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .join-info {
    background: #f8fafc;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .join-info h3 {
    margin: 0 0 1rem 0;
    color: #1f2937;
    font-size: 1rem;
    font-weight: 600;
  }

  .join-info ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #4b5563;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .join-info li {
    margin-bottom: 0.5rem;
  }

  /* Main Video Call Styles */
  .video-call-container {
    display: grid;
    grid-template-columns: 1fr 320px;
    height: 100vh;
    background: #1a1a1a;
  }

  .status-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 0.75rem 1rem;
    text-align: center;
    font-size: 0.875rem;
    font-weight: 600;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .status-bar.connecting {
    background: #f59e0b;
    color: white;
  }

  .status-bar.connected {
    background: #10b981;
    color: white;
  }

  .status-bar.error {
    background: #ef4444;
    color: white;
  }

  .main-content {
    display: contents;
  }

  .video-area {
    position: relative;
    background: #111;
    padding-top: 3rem; /* Account for status bar */
  }

  .room-info {
    position: absolute;
    top: 4rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    z-index: 10;
  }

  .room-id {
    font-weight: 600;
  }

  .participant-count {
    color: #9ca3af;
    font-size: 0.75rem;
  }

  .sidebar {
    background: #2a2a2a;
    border-left: 1px solid #333;
    display: flex;
    flex-direction: column;
    padding-top: 3rem; /* Account for status bar */
  }

  .error-toast {
    position: fixed;
    top: 4rem;
    left: 50%;
    transform: translateX(-50%);
    background: #dc2626;
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 100;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .error-toast button {
    background: none;
    border: none;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .video-call-container {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }

    .sidebar {
      border-left: none;
      border-top: 1px solid #333;
      height: 200px;
      padding-top: 0;
    }

    .room-info {
      top: 1rem;
      right: 1rem;
      font-size: 0.75rem;
    }

    .join-dialog {
      margin: 1rem;
      padding: 1.5rem;
    }

    .join-actions {
      flex-direction: column;
    }
  }
</style>