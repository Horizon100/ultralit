<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    function close() {
        dispatch('close');
    }
</script>

<div class="overlay" on:click|self={close}>
    <div class="content">
        <h2>Terms of Service</h2>
        <p>
            These are the Terms of Service for vRazum. By using our service, you agree to these terms.
            <!-- Add more content here -->
        </p>
        <button on:click={close}>Close</button>
    </div>
</div>

<style>
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .content {
        background-color: #ffffff;
        padding: 2rem;
        border-radius: 10px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
    }

    h2 {
        color: #000000;
    }

    p {
        color: #333333;
    }

    button {
        background-color: #6fdfc4;
        color: #000000;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 5px;
        cursor: pointer;
        margin-top: 1rem;
    }

    button:hover {
        background-color: #5fc4ab;
    }
</style>