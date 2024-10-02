<script lang="ts">
    import { onMount } from 'svelte';
    import { fade, fly, blur, scale } from 'svelte/transition';
    import { currentUser } from '$lib/pocketbase';
    import { elasticOut, elasticIn } from 'svelte/easing';
    import Auth from '$lib/components/auth/Auth.svelte';
    import Paper from '$lib/components/network/Paper.svelte';
    import { agentStore } from '$lib/stores/agentStore';
    import { goto } from '$app/navigation';
    import Builder from '$lib/components/ui/Builder.svelte'
    import SarcasticAuthPopup from '$lib/components/auth/SarcasticAuthPopup.svelte';
    import Headmaster from '$lib/assets/illustrations/headmaster2.png';
    import TypeWriter from '$lib/components/ui/TypeWriter.svelte';
    import Dialog from '$lib/components/ai/Dialog.svelte';
    import type { User, Node, NodeConfig, AIModel, NetworkData, Task, PromptType, Attachment, Threads, Messages} from '$lib/types';
    import { threadsStore } from '$lib/stores/threadsStore';
    import { pb } from '$lib/pocketbase';
    import { navigating } from '$app/stores';
    import { isNavigating } from '$lib/stores/navigationStore';
    
    let showAuthPopup = false;
    let showFade = false;
    let showH2 = false;
    let showH3 = false;
    let showButton = false;
    let showTypeWriter = false;
    let isLoading = false;
    // export let userId: string = crypto.randomUUID();
    let threads: Threads[];
    let attachment: Attachment | null = null;


    let dialogAiModel: AIModel | null = null;


    $: user = $currentUser;
    
    function handleGetStarted() {
        if (user) {
            // goto('/ask');
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

    function getRandomTip() {
        return productivityTips[Math.floor(Math.random() * productivityTips.length)];
    }

    function handleDialogSubmit(event: CustomEvent) {
        const { seedPrompt, aiModel, promptType } = event.detail;
        // Handle the submitted data, e.g., create a new thread
        handleSeedPromptSubmit(seedPrompt, aiModel, promptType);
        // goto('/ask');

    }

    let newThreadName = '';
    let newThreadId: string | null = null;
    let showConfirmation = false;


    async function handleSeedPromptSubmit(seedPrompt: string, aiModel: AIModel, promptType: PromptType) {
    console.log("handleSeedPromptSubmit called");
    if (!$currentUser) {
        console.error("User is not authenticated");
        return;
    }
    if (seedPrompt.trim() || attachment) {
        isLoading = true;
        try {
        // Create new thread
        const newThread = await threadsStore.addThread({ op: $currentUser.id, name: `Thread ${threads?.length ? threads.length + 1 : 1}` });
        if (newThread && newThread.id) {
            threads = [...(threads || []), newThread];
            await threadsStore.setCurrentThread(newThread.id);  
            newThreadName = newThread.name;
            newThreadId = newThread.id;

            // Add the seed prompt as the first message
            if (seedPrompt.trim()) {
            const firstMessage = await threadsStore.addMessage({
                thread: newThread.id,
                text: seedPrompt.trim(),
                type: 'human',
                user: $currentUser.id,
            });
            console.log("First message added:", firstMessage);
            }
            
            showConfirmation = true;
            // handleConfirmation();
        } else {
            console.error("Failed to create new thread: Thread object is undefined or missing id");
        }
        } catch (error) {
        console.error("Error creating new thread:", error);
        // Handle the error appropriately (e.g., show an error message to the user)
        } finally {
        isLoading = false;
        }
    }
    }
    onMount(async () => {
        if (!pb.authStore.isValid) {
            // Redirect to login or show an error message
            return;
        }
        // Rest of your onMount logic
        user = $currentUser;
        currentTip = getRandomTip();
        setTimeout(() => showFade = true, 50);
        setTimeout(() => showH2 = true, 50);
        setTimeout(() => showH3 = true, 150);
        setTimeout(() => showButton = true, 300);
        setTimeout(() => showTypeWriter = true, 2000);
    });


  onMount(() => {
        const unsubscribe = navigating.subscribe((navigationData) => {
            if (navigationData) {
                isNavigating.set(true);
            } else {
                // Add a small delay before hiding the spinner to ensure content is ready
                setTimeout(() => {
                    isNavigating.set(false);
                }, 300);
            }
        });

        return () => {
            unsubscribe();
        };
    });


    const introText = `Welcome to the future of goal achievement. Our cutting-edge AI-driven platform revolutionizes the way you set, track, and accomplish your objectives. By harnessing the power of artificial intelligence, we provide a personalized experience that adapts to your unique working style and aspirations. Our system doesn't just help you manage tasks; it anticipates challenges, suggests optimized strategies, and accelerates your progress towards success. Whether you're a professional aiming for career growth, an entrepreneur building a business, or an individual pursuing personal development, our intuitive interface and smart algorithms work tirelessly to keep you focused, motivated, and ahead of the curve. Experience the transformative power of AI-enhanced productivity and watch as your goals transform from distant dreams into tangible realities.`;

    const productivityTips = [
        "Use AI to brainstorm ideas and overcome creative blocks.",
        "Leverage LLMs for quick research summaries on complex topics.",
        "Automate routine tasks with AI agents to focus on high-value work.",
        "Utilize AI-powered writing assistants to improve your communication.",
        "Create personalized learning plans with AI to upskill efficiently.",
        "Use AI for data analysis to uncover insights and make informed decisions.",
        "Implement AI-driven time management tools to optimize your schedule.",
        "Employ AI chatbots for customer service to save time and improve response rates.",
        "Use AI to proofread and edit your documents for error-free work.",
        "Leverage AI for market research and trend analysis to stay ahead of the curve.",
        "Utilize AI-powered translation tools to break language barriers in global projects.",
        "Implement AI-driven project management tools for better task allocation and deadlines.",
        "Use AI to generate code snippets and accelerate software development.",
        "Employ AI for personalized content recommendations to stay updated in your field.",
        "Utilize AI-powered voice assistants for hands-free task management.",
        "Leverage AI for financial forecasting and budget optimization.",
        "Use AI-driven tools for social media management and content creation.",
        "Implement AI for predictive maintenance to prevent workflow disruptions.",
        "Utilize AI for rapid prototyping and design iterations.",
        "Employ AI-powered analytics to track and improve your productivity metrics."
    ];

    let currentTip = '';


</script>

<img src={Headmaster} alt="Landing illustration" class="illustration" />
{#if user}
    <div class="hero-container"  in:fly="{{ y: -200, duration: 100 }}" out:fade="{{ duration: 300 }}">
        {#if showFade}

        <div class="half-container" in:fade="{{ duration: 777 }}" out:fade="{{ duration: 300 }}">
            <div class="split-container">
                {#if showH2}
                <h2 in:fly="{{ y: -50, duration: 500, delay: 300 }}" out:fade="{{ duration: 300 }}">Welcome Back <span class="user-name">{$currentUser?.name || 'User'}</span>!
                </h2>
            {/if}
            {#if showH3}
                <p in:fly="{{ y: -50, duration: 500, delay: 400 }}" out:fade="{{ duration: 300 }}">{currentTip}</p>
            {/if}
            </div>


            {#if showButton}
                <div class="dialog-overlay" in:fly="{{ y: 500, duration: 500, delay: 500 }}" out:fade="{{ duration: 300 }}">
                    <div 
                    class="dialog-container"
                    in:scale={{
                        duration: 700,
                        delay: 300,
                        opacity: 0,
                        start: 0.5,
                        // easing: elasticOut,
                    }}
                    out:scale={{
                        duration: 300,
                        opacity: 0,
                        start: 1.2
                    }}
                    >
                    <Dialog 
                    on:submit={handleDialogSubmit}
                    x={0}
                    y={0}
                    aiModel={{}} 
                  />
                    </div>
                </div>
            {/if}
            <!-- <button on:click={() => goto('/launcher')}>Go to Launcher</button> -->

        </div>
        {/if}

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
                    <TypeWriter text={introText} minSpeed={20} maxSpeed={20} />
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
        position: absolute;

        justify-content: center;
        align-items: center;
        margin-left: auto;
        margin-right: auto;
        /* margin: 1rem; */
        width: 96%;
        top: 60px;

        right: 2%;
        /* max-width: 1200px; */
        /* margin-top: 80px; */
        height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background-color: rgb(0, 0, 0);
        border-radius: 40px;
    }

    .half-container {
        display: flex;
        flex-direction: column;
        /* justify-content: flex-start; */
        align-items: center;
        text-align: center;
        background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%);
        padding: 2rem;
        /* margin-top: 10%; */
        height: 90%;
        width: 100%;
        overflow: hidden;
    }

    .split-container {
        display: flex;
        flex-direction: column;
        height: 40%;
    }


    .dialog-container {
        display: flex;
        position: relative;
        width: 100%;
        height: 60%;
    }

    .dialog-container {
        display: flex;
        height: 60vh;
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

