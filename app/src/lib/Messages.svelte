<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { currentUser, pb } from './pocketbase';
    import type { Record } from 'pocketbase';
    import Icon from '@iconify/svelte';



    let newMessage: string = '';
    let messages: Message[] = [];
    let unsubscribe: (() => void) | undefined;
    let textareaRef: HTMLTextAreaElement;

    onMount(async () => {
        // Get initial messages
        const resultList = await pb.collection('messages').getList(1, 50, {
            sort: 'created',
            expand: 'user',
        });
        messages = resultList.items;

        // Subscribe to realtime messages
        unsubscribe = await pb
            .collection('messages')
            .subscribe<Message>('*', async ({ action, record }) => {
                if (action === 'create') {
                    // Fetch associated user
                    const user = await pb.collection('users').getOne(record.user);
                    record.expand = { user };
                    messages = [...messages, record];
                }
                if (action === 'delete') {
                    messages = messages.filter((m) => m.id !== record.id);
                }
            });
    });

    // Unsubscribe from realtime messages
    onDestroy(() => {
        unsubscribe?.();
    });

    async function sendMessage() {
        const data = {
            text: newMessage,
            user: $currentUser.id,
        };
        const createdMessage = await pb.collection('messages').create(data);
        newMessage = '';
    }

    function adjustTextareaHeight() {
        if (textareaRef) {
            textareaRef.style.height = 'auto';
            textareaRef.style.height = textareaRef.scrollHeight + 'px';
        }
    }
</script>

<div class="messages">
    {#each messages as message (message.id)}
        <div class="msg">
            <img
                class="avatar"
                src={`https://avatars.dicebear.com/api/identicon/${message.expand?.user?.username || 'unknown'}.svg`}
                alt="avatar"
                width="40px"
            />
            <div>
                <small>
                    {message.expand?.user?.username || 'unknown'}
                </small>
                <p class="msg-text">{message.text}</p>
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
    <p>Please log in to send messages.</p>
{/if}

<style>
    form {
    padding: 10px;
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    width: 100%;
    position: fixed; /* Use fixed positioning */
    bottom: 0;       /* Align to the bottom of the viewport */
    background-color: #1c1c1c;
    overflow: hidden; /* Hide any overflow */
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.2); /* Optional: Add shadow for better visibility */
    z-index: 1000; /* Ensure it stays above other content */
    }

    .messages {
        display: flex;
        flex-direction: column;
        padding: 10px;
        margin-left: 10px;
        margin-bottom: 20px;
    }

    .msg {
        display: flex;
        align-items: start;
        margin-bottom: 10px;
        background-color: #292929;
        border-radius: 10px;
        padding: 5px;
    }s

    .avatar {
        margin-right: 10px;
        border-radius: 20px;
        padding: 10px;
    }

    .msg-text {
        margin: 5px 0 0;
        font-size: 12px;
        background-color: #292929;
        padding: 10px;
        border-radius: 10px;
    }

    textarea {
        flex-grow: 1;
        padding: 5px;
        margin-right: 10px;
        border: 1px solid #404040;
        border-radius: 4px;
        resize: none;
        overflow-y: hidden;
        min-height: 20px;
        max-height: 350px;
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
</style>