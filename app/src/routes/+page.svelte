<script lang="ts">
    import { onMount } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { currentUser } from '$lib/pocketbase';
    import Auth from '$lib/components/auth/Auth.svelte';
    import Paper from '$lib/components/network/Paper.svelte';
    import { agentStore } from '$lib/stores/agentStore';
    import { goto } from '$app/navigation';
    import Builder from '$lib/components/ui/Builder.svelte'


    $: user = $currentUser;

    function handleGetStarted() {
        if (user) {
            goto('/launcher');
        } else {
            // You might want to show a login prompt or redirect to a login page
            console.log('Please log in to access the launcher.');
        }
    }

    onMount(() => {
        user = $currentUser;
    });
</script>



{#if user}
<div in:fly="{{ y: 200, duration: 500 }}" out:fade="{{ duration: 300 }}">
    <p>Redirecting to Launcher...</p>
    {handleGetStarted()}
</div>
{:else}
<div class="hero-container"in:fly="{{ y: -200, duration: 500 }}" out:fade="{{ duration: 300 }}">
    <div class="half-container">
      <h2>Unlock Unmatched Efficiency with AI-Driven Goal Management.</h2>
      <Builder/>
      <p>We optimize your workflow with AI that anticipates and accelerates your progress.</p>
    </div>
</div>
{/if}


<style>
    * {
        font-family: 'Source Code Pro', monospace;
    }

    .hero-container {
        justify-content: center;
        align-items: center;
        margin-left: auto;
        margin-right: auto;
        margin-top: 5vh;
        width: 80%;
        max-width: 1200px;
        height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .half-container {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        text-align: center;
        background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%);
        padding: 2rem;
        height: 100%;
        overflow: hidden;
    }

    h2 {
        font-size: 2.5rem;
        color: #fff;
        margin-bottom: 2rem;
    }

    p {
        font-size: 1.2rem;
        color: #fff;
        margin-top: 2rem;
    }

    @media (max-width: 1199px) {
        .hero-container {
            width: 90%;
        }

        h2 {
            font-size: 2rem;
        }
    }

    @media (max-width: 991px) {
        .hero-container {
            width: 95%;
        }

        h2 {
            font-size: 1.8rem;
        }
    }

    @media (max-width: 767px) {
        .hero-container {
            width: 100%;
            margin-top: 2vh;
        }

        .half-container {
            padding: 1rem;
        }

        h2 {
            font-size: 1.5rem;
        }

        p {
            font-size: 1rem;
        }
    }
</style>

