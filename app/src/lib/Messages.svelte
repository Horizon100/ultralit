<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { currentUser, pb } from './pocketbase';
    import type { UnsubscribeFunc, Record } from 'pocketbase';
    import Icon from '@iconify/svelte';
    import { Spinner } from 'flowbite-svelte';

    interface Message extends Record {
        text: string;
        user: string;
        created: string;
        reactions: Record<string, number>; // Storing reactions with count
        expand?: {
            user?: {
                username: string;
            };
        };
    }

    interface UserStats {
        username: string;
        messageCount: number;
    }

    let newMessage: string = '';
    let messages: Message[] = [];
    let userStats: UserStats[] = [];
    let onlineUsers: number = 0;
    let totalMessages: number = 0;
    let unsubscribe: UnsubscribeFunc;
    let textareaRef: HTMLTextAreaElement;
    let messagesContainer: HTMLDivElement;
    let copiedMessageId: string | null = null;
    let connectionStatus: string = 'Initializing...';
    let isLoading: boolean = false; // Loader state
    let mostActiveUsers: { username: string, count: number }[] = [];


    onMount(async () => {
        console.log("Component mounted");
        connectionStatus = 'Connecting...';
        isLoading = true; // Show loader

        try {
            // Get initial messages
            const resultList = await pb.collection('messages').getList<Message>(1, 200, {
                sort: 'created',
                expand: 'user',
            });
            messages = resultList.items;
            totalMessages = messages.length;
            isLoading = false;
            updateMostActiveUsers();


            // Fetch user stats
            const usersList = await pb.collection('users').getFullList<UserStats>({
                expand: 'user',
            });
            userStats = usersList.map(user => ({
                username: user.expand?.user?.username || 'unknown',
                messageCount: user.messageCount
            }));
            userStats.sort((a, b) => b.messageCount - a.messageCount); // Sort by message count
            onlineUsers = usersList.filter(user => user.online).length;

            // Subscribe to realtime messages
            console.log("Setting up real-time subscription...");
            unsubscribe = await pb
                .collection('messages')
                .subscribe<Message>('*', async ({ action, record }) => {
                    console.log("Realtime event received:", action, record);
                    if (action === 'create') {
                        try {
                            // Fetch associated user
                            const user = await pb.collection('users').getOne(record.user);
                            record.expand = { user };
                            messages = [...messages, record];
                            totalMessages = messages.length;
                            updateMostActiveUsers();
                            scrollToBottom();
                        } catch (error) {
                            console.error("Error fetching user for new message:", error);
                        }
                    }
                    if (action === 'delete') {
                        messages = messages.filter((m) => m.id !== record.id);
                        totalMessages = messages.length;
                        updateMostActiveUsers();

                        console.log("Message deleted:", record.id);
                    }
                    messages = [...messages]; // Force Svelte to re-render

                    // Update user stats
                    const updatedUsersList = await pb.collection('users').getFullList<UserStats>();
                    userStats = updatedUsersList.map(user => ({
                        username: user.expand?.user?.username || 'unknown',
                        messageCount: user.messageCount
                    }));
                    userStats.sort((a, b) => b.messageCount - a.messageCount); // Sort by message count
                    onlineUsers = updatedUsersList.filter(user => user.online).length;
                },
                {
                    onSubscriptionError: (err) => {
                        console.error("Subscription error:", err);
                        connectionStatus = `Subscription error: ${err.message}`;
                    }
                });
            connectionStatus = 'Connected';
            console.log("Realtime subscription set up successfully");
        } catch (error) {
            console.error("Error in onMount:", error);
            isLoading = false; // Hide spinner in case of error
        }
    });

    onDestroy(() => {
        console.log("Component unmounting, unsubscribing from realtime updates");
        unsubscribe?.();
    });

    async function sendMessage() {
        if (!newMessage.trim() || !$currentUser) return;
        try {
            const data = {
                text: newMessage,
                user: $currentUser.id,
            };
            const createdMessage = await pb.collection('messages').create<Message>(data);
            console.log("Message sent:", createdMessage);
            newMessage = '';
            resetTextareaHeight();
            scrollToBottom();
        } catch (error) {
            console.error("Error sending message:", error);
            // You might want to show an error message to the user here
        }
    }

    function adjustTextareaHeight() {
        if (textareaRef) {
            textareaRef.style.height = 'auto';
            textareaRef.style.height = Math.min(textareaRef.scrollHeight, 150) + 'px';
        }
    }

    function resetTextareaHeight() {
        if (textareaRef) {
            textareaRef.style.height = 'auto';
        }
    }

    function scrollToBottom() {
        setTimeout(() => {
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 0);
    }

    function copyMessageContent(messageId: string, content: string) {
        navigator.clipboard.writeText(content).then(() => {
            copiedMessageId = messageId;
            setTimeout(() => {
                copiedMessageId = null;
            }, 2000);
        });
    }

    function getRandomBrightColor(username: string): string {
        const hash = username.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const h = hash % 360;
        return `hsl(${h}, 70%, 60%)`;
    }

    // Dragging functions
    function handleDragStart(event: MouseEvent | TouchEvent) {
        if (event.target instanceof HTMLElement && event.target.closest('.messages-container')) {
            isDragging = true;
            startX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
            startY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
            const rect = messagesContainer.getBoundingClientRect();
            startTop = rect.top;
            startLeft = rect.left;
            event.preventDefault();
        }
    }

    function handleDragMove(event: MouseEvent | TouchEvent) {
        if (!isDragging) return;
        const currentX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
        const currentY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        messagesContainer.style.top = `${startTop + deltaY}px`;
        messagesContainer.style.left = `${startLeft + deltaX}px`;
    }

    function handleDragEnd() {
        if (!isDragging) return;
        isDragging = false;
    }

    function updateMostActiveUsers() {
        // Calculate the most active users
        const userMessageCounts: { [username: string]: number } = {};
        messages.forEach(message => {
            const username = message.expand?.user?.username || 'unknown';
            userMessageCounts[username] = (userMessageCounts[username] || 0) + 1;
        });

        mostActiveUsers = Object.entries(userMessageCounts)
            .map(([username, count]) => ({ username, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
    }

    function addReaction(message: Message, emoji: string) {
        // Add reaction logic
        const currentReactions = message.reactions || {};
        message.reactions = {
            ...currentReactions,
            [emoji]: (currentReactions[emoji] || 0) + 1,
        };
        // Force re-render
        messages = [...messages];
    }

    function showReactions(messageId: string) {
        const reactionsEl = document.querySelector(`#reactions-${messageId}`);
        if (reactionsEl) {
            reactionsEl.classList.add('show');
        }
    }

    function hideReactions(messageId: string) {
        const reactionsEl = document.querySelector(`#reactions-${messageId}`);
        if (reactionsEl) {
            reactionsEl.classList.remove('show');
       }
    }
</script>

{#if isLoading}
    <div class="spinner-container">
        <Spinner class="me-3" size="4" color="white" />
    </div>
{/if}

<div class="top-stats">
    <p class="stats-item">Online Users: {onlineUsers}</p>
    <div>Total Messages: {totalMessages}</div>
    <div>
        Most Active Users:
        {#each mostActiveUsers as { username, count }}
            <div>🗿{username}: {count} messages</div>
        {/each}
    </div>
</div>

<div class="messages-container" on:mousedown={handleDragStart} on:mousemove={handleDragMove} on:mouseup={handleDragEnd} on:touchstart={handleDragStart} on:touchmove={handleDragMove} on:touchend={handleDragEnd}>
    <p class="connection-status">Connection status: {connectionStatus}</p>

    <div class="messages" bind:this={messagesContainer}>
        {#each messages as message (message.id)}
            <div class="msg">
                <div class="msg-header">
                    <img
                        class="avatar"
                        src={`https://avatars.dicebear.com/api/identicon/${message.expand?.user?.username || 'unknown'}.svg`}
                        alt="avatar"
                        width="20px"
                    />
                    <small class="username" style="color: {getRandomBrightColor(message.expand?.user?.username || 'unknown')}">
                        {message.expand?.user?.username || 'unknown'}
                    </small>
                </div>
                <div class="msg-content" on:dblclick={() => copyMessageContent(message.id, message.text)} role="button" tabindex="0">

                    <p class="msg-text">{message.text}</p>
                    {#if copiedMessageId === message.id}
                        <div class="tooltip">Copied!</div>
                    {/if}
                    <p class="msg-time">
                        {new Date(message.created).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                    <div id="reactions-{message.id}" class="reactions">

                        <span on:click={() => addReaction(message, '🔗')}>🔗</span>
                        <span on:click={() => addReaction(message, '⏱️')}>⏱️</span>
                        <span on:click={() => addReaction(message, '📌')}>📌</span>
                        <span on:click={() => addReaction(message, '🗑️')}>🗑️</span>
                        {#each Object.entries(message.reactions || {}) as [emoji, count]}
                            <div class="reaction">
                                {emoji} {count}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        {/each}
    </div>

    {#if $currentUser}
        <form on:submit|preventDefault={sendMessage}>
            <textarea
                bind:this={textareaRef}
                bind:value={newMessage}
                on:input={adjustTextareaHeight}
                placeholder="Message"
                rows="1"
            ></textarea>
            <button type="submit">
                <Icon icon="mdi:arrow-up" />
            </button>
        </form>
    {:else}
        <p class="login-message">Please log in to send messages.</p>
    {/if}
</div>

<style>
    .top-stats {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background-color: #303030;
        padding: 10px;
        z-index: 1006;
        color: #fff;
        border-bottom: 1px solid #404040;
    }

    .stats-item {
        margin: 0;
        font-size: 14px;
    }

    .top-users {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }

    .top-users li {
        font-size: 12px;
    }

    .messages-container {
        display: flex;
        flex-direction: column;
        height: calc(100% - 100px); /* Adjust height based on top-stats and form height */
        overflow: hidden;
        position: relative;
        margin-left: 15px;
        margin-top: 60px; /* Space for top-stats */
    }

    .messages {
        flex-grow: 1;
        overflow-y: auto;
        padding: 10px;
        margin-bottom: 60px; /* Adjust based on your form height */
    }

    .msg {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
        background-color: #292929;
        border-radius: 10px;
        padding: 10px;
    }

    .msg-header {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
        padding: 2px;
    }

    .avatar {
        margin-right: 10px;
        border-radius: 20px;
    }

    .username {
        font-weight: bold;
    }

    .msg-content {
        display: flex;
        flex-wrap: wrap;
        position: relative;
        cursor: pointer;
    }

    .msg-text {
        margin: 0;
        font-size: 12px;
        word-break: break-word;
        width: 100%;
        padding: 5px;
    }

    .msg-time {
        position: absolute;
        bottom: 5px;
        right: 10px;
        font-size: 10px;
        color: #aaa;
    }

    form {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 15px;
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        background-color: #303030;
        z-index: 1000;
        text-align: center;
        justify-content: center;
    }

    textarea {
        flex-grow: 1;
        padding: 5px;
        margin-right: 10px;
        border: 1px solid #404040;
        border-radius: 4px;
        resize: none;
        overflow-y: auto;
        min-height: 20px;
        max-height: 150px;
    }

    button {
        padding: 5px 10px;
        background-color: #6fdfc3;
        color: black;
        border: none;
        cursor: pointer;
        border-radius: 20px;
        transition: transform 0.1s ease-in-out;
    }

    button:hover {
        background-color: #4a9885;
        transition: all 0.3s;
    }

    .login-message {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 10px;
        background-color: #1c1c1c;
        text-align: center;
        z-index: 1000;
    }

    .tooltip {
        position: absolute;
        background-color: #333;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        top: -20px;
        right: 0;
        opacity: 0;
        animation: fadeInOut 2s ease-in-out;
    }

    .connection-status {
        text-align: center;
        font-size: 10px;
        padding: 5px;
        background-color: #333;
        color: #fff;
        position: sticky;
        top: 0;
        z-index: 1000;
    }

    .reactions {
        display: flex;
        gap: 5px;
        margin-top: 5px;
        opacity: 0;
        transition: opacity 0.1s ease-in-out;
        flex-wrap: wrap;;
    }

    .reactions:hover {
        opacity: 1;
    }

    .reaction {
        display: flex;
        align-items: center;
        gap: 3px;
    }

    .reaction span {
        font-size: 14px;
    }

    .reactions.show {
        opacity: 1;
    }

    @keyframes fadeInOut {
        0%, 100% { opacity: 0; }
        10%, 90% { opacity: 1; }
    }

    .spinner-container {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
        display: flex;
        position: fixed;
        top: 50%;
        left: 50%;
    }

 

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

</style>