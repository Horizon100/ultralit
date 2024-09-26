<script lang="ts">
    import { onMount } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { currentUser } from '$lib/pocketbase';
    import Auth from '$lib/components/auth/Auth.svelte';
    import Paper from '$lib/components/network/Paper.svelte';
    import { agentStore } from '$lib/stores/agentStore';
    import { goto } from '$app/navigation';
    import Builder from '$lib/components/ui/Builder.svelte'
    import SarcasticAuthPopup from '$lib/components/auth/SarcasticAuthPopup.svelte';
    import Headmaster from '$lib/assets/illustrations/headmaster2.png';
    import TypeWriter from '$lib/components/ui/TypeWriter.svelte';

    let showAuthPopup = false;
    let showH2 = false;
    let showH3 = false;
    let showButton = false;
    let showTypeWriter = false;

    $: user = $currentUser;
    
    function handleGetStarted() {
        if (user) {
            goto('/ask');
        } else {
            showAuthPopup = true;
        }
    }

    function checkLoginStatus() {
        showAuthPopup = true;
    }

    function closeAuthPopup() {
        showAuthPopup = false;
    }

    onMount(() => {
        user = $currentUser;
        setTimeout(() => showH2 = true, 500);
        setTimeout(() => showH3 = true, 1000);
        setTimeout(() => showButton = true, 1500);
        setTimeout(() => showTypeWriter = true, 2000); // Show TypeWriter 500ms after the button
    });

    const introText = `Welcome to the future of goal achievement. Our cutting-edge AI-driven platform revolutionizes the way you set, track, and accomplish your objectives. By harnessing the power of artificial intelligence, we provide a personalized experience that adapts to your unique working style and aspirations. Our system doesn't just help you manage tasks; it anticipates challenges, suggests optimized strategies, and accelerates your progress towards success. Whether you're a professional aiming for career growth, an entrepreneur building a business, or an individual pursuing personal development, our intuitive interface and smart algorithms work tirelessly to keep you focused, motivated, and ahead of the curve. Experience the transformative power of AI-enhanced productivity and watch as your goals transform from distant dreams into tangible realities.`;
</script>

<img src={Headmaster} alt="Landing illustration" class="illustration" />
{#if user}
    <div class="hero-container" in:fly="{{ y: -200, duration: 500 }}" out:fade="{{ duration: 300 }}">
        <div class="half-container">
            <h2>Welcome Back!</h2>
            <p>Let's start...</p>
            <button on:click={() => goto('/launcher')}>Go to Launcher</button>
        </div>
    </div>
{:else}
    <div class="hero-container" in:fly="{{ y: -200, duration: 500 }}" out:fade="{{ duration: 300 }}">
        <div class="half-container">
            {#if showH2}
                <h2 in:fly="{{ y: -50, duration: 500, delay: 500 }}" out:fade="{{ duration: 300 }}">
                    Unlock Unmatched Efficiency with AI-Driven Goal Management
                </h2>
            {/if}
            {#if showH3}
                <h3 in:fly="{{ y: -50, duration: 500, delay: 500 }}" out:fade="{{ duration: 300 }}">
                    We optimize your workflow with AI that anticipates and accelerates your progress
                </h3>
            {/if}
            {#if showButton}
                <button 
                    on:click={handleGetStarted}
                    in:fly="{{ y: 50, duration: 500, delay: 500 }}" out:fly="{{ duration: 300 }}"
                >
                    Get Started
                </button>
            {/if}
            {#if showTypeWriter}
                <div in:fade="{{ duration: 500 }}">
                    <TypeWriter text={introText} speed={20} />
                </div>
            {/if}
        </div>
    </div>
{/if}


<style>
    * {
        /* font-family: 'Source Code Pro', monospace; */
        font-family: 'Merriweather', serif;
    }

    .hero-container {
        justify-content: center;
        align-items: center;
        margin-left: auto;
        margin-right: auto;
        margin: 1rem;
        width: 96%;
        margin-left:2%;
        /* max-width: 1200px; */
        height: 94vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background-color: rgb(0, 0, 0);
        border-radius: 40px;
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
        width: 50%;
        overflow: hidden;
    }

    h2 {
        margin-top: 25%;
        font-size: 80px;
        color: #fff;
        margin-bottom: 2rem;

    }

    h3 {
        font-size: 30px;
        color: #fff;
        margin-bottom: 2rem;
        font-weight: 600;

    }

    p {
        display: flex;
        line-height: 1.5;
        text-align: justify;
        font-size: 1.2rem;
        color: #fff;
        margin-top: 2rem;
        font-size: 24px;
    }

    button {
        display: flex;
        align-items: center;
        width: 50%;
        gap: 5px;
        font-size: 30px;
        justify-content: center;
        /* border-radius: 20px; */
        padding: 20px 40px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all ease 0.3s;
        
    }

    button:hover {
        scale: 1.4;
    }

    .illustration {
        position: absolute;
        width: 95%;
        height: auto;
        left: 5%;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.025;
        z-index: 1;
        pointer-events: none;
    }

    @media (max-width: 1199px) {
        .hero-container {
            width: 90%;
        }

        .half-container {
            width: 80%;
        }

        h2 {
            /* font-size: 2rem; */
        }
    }

    @media (max-width: 991px) {
        .hero-container {
            width: 95%;
        }

        h2 {
            font-size: 60px;
        }
    }

    @media (max-width: 767px) {
        .hero-container {
            width: 100%;
            margin-top: 2vh;
        }

        .half-container {
            padding: 1rem;
            width: 86%;
            /* height: 60%; */
        }

        h2 {
            font-size: 40px;
        }

        p {
            font-size: 1rem;
        }
    }
</style>

