<script lang="ts">
    import { onMount } from 'svelte';
    import { fade, fly, blur, scale, slide } from 'svelte/transition';
    import { spring } from 'svelte/motion';
    import { quintOut } from 'svelte/easing';
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
    import { page } from '$app/stores';
    import AIChat from '$lib/components/ai/AIChat.svelte';
    import horizon100 from '$lib/assets/horizon100.svg';
    import { Mail, Send, Github, X, ChevronDown } from 'lucide-svelte';
    import Terms from '$lib/components/overlays/Terms.svelte';
    import PrivacyPolicy from '$lib/components/overlays/PrivacyPolicy.svelte';
    import FeatureCard from '$lib/components/ui//FeatureCard.svelte';
	import { showLoading } from '../lib/stores/loadingStore';


    // export let userId: string = crypto.randomUUID();
    let threads: Threads[];
    let attachment: Attachment | null = null;
    let dialogAiModel: AIModel | null = null;

    let showContent = false;

    let showAuthPopup = false;
    let showFade = false;
    let showLogo = false;
    let showH1 = false;
    let showH2 = false;
    let showH3 = false;
    let showButton = false;
    let showTypeWriter = false;
    let isLoading = false;

    let showAuth = false;

    let logoSize = spring(80);
    let logoMargin = spring(0);


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

    let userCount = 0;

    async function fetchUserCount() {
        try {
            const resultList = await pb.collection('users').getList(1, 1, {
                sort: '-created',
            });
            userCount = resultList.totalItems;
        } catch (error) {
            console.error('Error fetching user count:', error);
        }
    }

    let showTermsOverlay = false;
    let showPrivacyOverlay = false;
    let showArrowOverlay = false;

    function openTermsOverlay() {
        showTermsOverlay = true;
    }

    function openPrivacyOverlay() {
        showPrivacyOverlay = true;
    }

    function closeOverlay() {
        showTermsOverlay = false;
        showPrivacyOverlay = false;
    }

    function subscribeToNewsletter() {
        // Implement newsletter subscription logic
    }

    
    function handleOverlayClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            showAuth = false;
            showArrowOverlay = false;
        }
    }

    onMount(async () => {
        if (!pb.authStore.isValid) {
            // Set showContent to true for non-logged-in users
            showContent = true;
        }
        // Rest of your onMount logic
        user = $currentUser;
        currentTip = getRandomTip();
        setTimeout(() => showFade = true, 200);
        setTimeout(() => {
            showLogo = true;
            // After a short delay, shrink the logo and move it up
            setTimeout(() => {
                logoSize.set(0); // Shrink to 20% of container height
                logoMargin.set(0); // Move up by adding negative margin
            }, 300); // Adjust this delay as needed
        }, 150);

        // Adjust other elements' appearance timing
        setTimeout(() => showH1 = true, 400);
        setTimeout(() => showH2 = true, 450);
        setTimeout(() => showH3 = true, 800);
        setTimeout(() => showButton = true, 1000);
        setTimeout(() => showTypeWriter = true, 500);

        await fetchUserCount();

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


    const introText = `vRazum makes collaborating fun and seamless, whether you’re brainstorming with friends or building a global community. Customize your space to chat, create, and work together in real time.
`;

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

    function toggleAuth() {
        showAuth = !showAuth;  
        showArrowOverlay = !showArrowOverlay;

    }

    function toggleIntro () {
        showArrowOverlay = !showArrowOverlay;
    }
</script>

{#if user}
    <div class="hero-container"  in:fly="{{ y: -200, duration: 100 }}" out:fade="{{ duration: 300 }}">
        {#if showFade}
            <img src={Headmaster} alt="Landing illustration" class="illustration" in:fade="{{ duration: 2000 }}"/>
        {/if}
        <div class="half-container" in:fade="{{ duration: 777 }}" out:fade="{{ duration: 300 }}">
            <div class="split-container">
                {#if showH2}
                <h2 in:fly="{{ y: -50, duration: 500, delay: 300 }}" out:fade="{{ duration: 300 }}">Welcome Back <span class="user-name">{$currentUser?.name || 'User'}</span>!
                </h2>
            {/if}
            {#if showH3}
                <h3 in:fly="{{ y: -50, duration: 500, delay: 400 }}" out:fade="{{ duration: 300 }}">{currentTip}</h3>
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
    </div>
    {:else}
    <div class="hero-container" in:fly="{{ y: -200, duration: 500 }}" out:fade="{{ duration: 300 }}">
        {#if showFade}
            <img src={Headmaster} alt="Landing illustration" class="illustration" in:fade="{{ duration: 2000 }}"/>
        {/if}
        <div class="half-container">
            <div class="content-wrapper">
                {#if showLogo}
                <div 
                    class="logo-container"
                    style="height: {$logoSize}%; margin-top: {$logoMargin}%;"
                    in:fade="{{ duration: 2000, delay: 0 }}" out:fade="{{ duration: 100 }}"
                >
                    <img 
                        src={horizon100} 
                        alt="Horizon100" 
                        class="logo" 
                        in:fade="{{ duration: 100 }}"
                    />
                </div>
                {/if}

                {#if showH2}
                    <h1 in:fly="{{ y: -50, duration: 500, delay: 200 }}" out:fade="{{ duration: 300 }}">
                        LEVEL UP YOUR CONVERSATIONS WITH AI
                    </h1>
                {/if}
                {#if showTypeWriter}
                    <div in:fade="{{ duration: 500, delay: 500 }}">
                        <TypeWriter text={introText} minSpeed={1} maxSpeed={10} />
                    </div>
                {/if}
                {#if showButton}
                    <div class="footer-container" in:fly="{{ y: -50, duration: 500, delay: 200 }}" out:fade="{{ duration: 300 }}">
                        {#if !showAuth}
                            <button 
                                on:click={toggleAuth}
                                in:fly="{{ y: 50, duration: 500, delay: 400 }}" out:fly="{{ y: 50, duration: 500, delay: 400 }}"
                            >
                                Get Started
                            </button>
                        {/if}
                        <!-- <div class="terms-privacy">
                            <span>By using vRazum you automatically agree to our</span>
                            <button on:click={openTermsOverlay}>
                                Terms
                            </button>
                            <span>and</span>
                            <button on:click={openPrivacyOverlay}>
                                Privacy Policy
                            </button>
                        </div> -->

                        <div class="cta-buttons">
                            <button on:click={subscribeToNewsletter}>
                                <Mail size="30"/>
                                Subscribe
                            </button>
                            <a href="https://t.me/vrazum" target="_blank" rel="noopener noreferrer">
                                <button>
                                    <Send size="30"/>
                                    Telegram
                                </button>
                            </a>
                            <a href="https://github.com/Horizon100/ultralit" target="_blank" rel="noopener noreferrer">
                                <button>
                                    <Github size="30"/>
                                    GitHub
                                </button>
                            </a>

                        </div>
                        <div class="testimonial">
                            <p> {userCount} Users</p>
                        </div>
                    </div>
                {/if}

                {#if showH2}

                <div id="features" class="section">
                    <h2>Features</h2>
                    <div class="feature-cards">
                        <FeatureCard 
                            title="Advanced AI-powered conversations" 
                            features={[
                                "Natural language processing",
                                "Contextual understanding",
                                "Multi-turn conversations",
                                "Custom AI models",
                                "Sentiment analysis"
                            ]}
                            isPro={true}
                        />
                        <FeatureCard 
                            title="Real-time collaboration tools" 
                            features={[
                                "Shared workspaces",
                                "Live editing",
                                "Version control",
                                "Comment threads",
                                "Task assignments"
                            ]}
                        />
                        <FeatureCard 
                            title="Customizable workspace" 
                            features={[
                                "Personalized layouts",
                                "Theme customization",
                                "Widget integration",
                                "Keyboard shortcuts",
                                "Custom branding options"
                            ]}
                            isPro={true}
                        />
                        <FeatureCard 
                            title="Integrated project management" 
                            features={[
                                "Kanban boards",
                                "Gantt charts",
                                "Time tracking",
                                "Resource allocation",
                                "Automated reports"
                            ]}
                        />
                        <FeatureCard 
                            title="Secure data encryption" 
                            features={[
                                "End-to-end encryption",
                                "Two-factor authentication",
                                "Regular security audits",
                                "Compliance certifications",
                                "Data backup and recovery"
                            ]}
                            isPro={true}
                        />
                        <FeatureCard 
                            title="Advanced analytics" 
                            features={[
                                "Real-time dashboards",
                                "Custom report builder",
                                "Data visualization tools",
                                "Predictive analytics",
                                "Integration with BI tools"
                            ]}
                            isPro={true}
                        />
                    </div>
                </div>

                {/if}

                {#if showButton}

                <div id="pricing" class="section">
                    <h2>Pricing</h2>
                    <div class="pricing-plans">
                        <div class="card">
                            <h3>Basic</h3>
                            <p class="price">$9.99/month</p>
                            <ul>
                                <li>Up to 5 users</li>
                                <li>Basic AI features</li>
                                <li>5GB storage</li>
                            </ul>
                        </div>
                        <div class="card">
                            <h3>Pro</h3>
                            <p class="price">$24.99/month</p>
                            <ul>
                                <li>Up to 20 users</li>
                                <li>Advanced AI features</li>
                                <li>50GB storage</li>
                            </ul>
                        </div>
                        <div class="card">
                            <h3>Enterprise</h3>
                            <p class="price">Contact us</p>
                            <ul>
                                <li>Unlimited users</li>
                                <li>Custom AI solutions</li>
                                <li>Unlimited storage</li>
                            </ul>
                        </div>
                    </div>
                </div>
                {/if}

            </div>
        </div>
    </div>
{/if}


{#if showTermsOverlay}
    <Terms on:close={closeOverlay} />
{/if}

{#if showPrivacyOverlay}
    <PrivacyPolicy on:close={closeOverlay} />
{/if}


{#if showArrowOverlay}
    <div class="arrow-overlay" transition:fly="{{ y: 200, duration: 300, easing: quintOut }}">
        <div class="arrow"></div>
    </div>
{/if}

{#if showAuth}
    <div class="auth-overlay" on:click={handleOverlayClick} transition:fly="{{ y: -200, duration: 300 }}">
        <div class="auth-content">
            <button class="close-button" 
            on:click={() => {
                showAuth = false;
                showArrowOverlay = false;
            }}
            in:fly="{{ y: 50, duration: 500, delay: 400 }}" out:fly="{{ y: 50, duration: 500, delay: 400 }}"
            >
                <X size={24} />
            </button>
            
            <Auth on:close={() => {
                showAuth = false;
                showArrowOverlay = false;
            }} />
        </div>
    </div>
{/if}

<style>
    * {
        /* font-family: 'Source Code Pro', monospace; */
        /* font-family: 'Merriweather', serif; */
        font-family: Georgia, 'Times New Roman', Times, serif;

    }

    .section {
        padding: 1rem;
        margin-top: 2rem;
        text-align: center;
    }


    .hero-container {
        position: absolute;
        justify-content: center;
        align-items: center;
        margin-left: auto;
        margin-right: auto;
        width: 96%;
        top: 60px;
        margin-left: 2%;
        height: calc(100vh - 160px); /* Adjust height to account for header */
        display: flex;
        flex-direction: column;
        overflow-y: auto; /* Change this to allow vertical scrolling */
        overflow-x: hidden; /* Prevent horizontal scrolling */
        background-color: rgb(0, 0, 0);
        border-radius: 40px;
        scrollbar-width: thin;
        scrollbar-color: transparent transparent;
    }

    .half-container {
        display: flex;
        flex-direction: column;
        align-items: right;
        text-align: right;
        background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%);
        padding: 2rem;
        height: 100%;
        width: 100%;
        overflow-y: visible; /* Allow content to overflow vertically */
    }

    .content-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        width: 100%;
        margin-top: 20%;
        /* Remove fixed height to allow content to expand */
    }
    .split-container {
        display: flex;
        flex-direction: column;
        width: 98%;
        /* height: 40%; */
    }

	.auth-overlay {
        position: fixed;
        left: 0;
        width: 100%;
        height: 100%;
        /* background-color: rgba(0, 0, 0, 0.5); */
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .auth-content {
        position: fixed;
		top: 0;
        /* background-color: #2b2a2a; */
        /* padding: 2rem; */
        width: 100%;
        /* max-width: 500px; */
        height: auto;
        overflow-y: auto;
    }

    .close-button {
        position: fixed;
        top: 0;
        left: 10px;
        width: 30px;
        height: 30px;
        border: none;
        color: white;
        cursor: pointer;
        background: none;
        display: flex;
		justify-content: center;
		text-align: center;
		font-size: 1rem;
		border-radius: 8px;
		padding: 5px;
        transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);

    }

    .close-button:hover {
	  opacity: 0.8;
	  background-color: rgb(62, 137, 194);
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



    h1 {
        /* margin-top: 25%; */
        font-size: 4rem;
        color: #fff;
        margin-bottom: 2rem;
        width: 50%;
        text-align: left;

    }
    h2 {
        /* margin-top: 25%; */
        font-size: 3rem;
        font-weight: 500;
        color: #fff;
        margin-bottom: 2rem;
        width: 100%;


    }

    h3 {
        font-size: 1.5rem;
        color: #959595;
        margin-bottom: 2rem;
        font-weight: 300;
        width: 100%;
        font-style: italic;

    }

    p {
        display: flex;
        line-height: 1.5;
        text-align: justify;
        color: #fff;
        font-size: 24px;
        width: 50%;
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
        transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
        background-color: #6fdfc4;
        filter: drop-shadow(0 0 10px rgba(111, 223, 196, 0.7));

    }

    button:hover {
        background-color: #ffffff;
        color: rgb(0, 0, 0);
        font-size: 60px;
    }

    .illustration {
        position: absolute;
        width: 96%;
        height: auto;
        left: 4%;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.025;
        z-index: 1;
        pointer-events: none;
    }


  


    .logo-container {
        display: flex;
        justify-content: center;
        align-items: center;
        transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
        width: 100%;
    }

    .logo {
        max-height: 100%;
        max-width: 100%;
        object-fit: contain;
    }

    h1, h2, h3, button {
        margin-top: 1rem;
    }

    .footer-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        justify-content: center;
        align-items: center;
    }

    .terms-privacy {
        font-size: 1.3rem;
        color: #ffffff;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 1rem;
    }

    .terms-privacy button {
        background: none;
        border: none;
        color: #6fdfc4;
        text-decoration: underline;
        cursor: pointer;
        font-size: 1.3rem;
        padding: 0;
        margin: 0;
        display: inline;
        width: auto;
    }

    .terms-privacy button:hover {
        color: #ffffff;
    }

    .testimonial {
        display: flex;
        flex-direction: row;
        text-align: center;
        justify-content: center;
        align-items: center;

    }


    .testimonial p {
        font-size: 1.5rem;
        color: #ffffff;
        text-align: center;
        width: 100px;
        font-style: italic;
        

    }

    .cta-buttons {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        margin-top: 1rem;
        width: 50%;
    }

    .cta-buttons button {
        font-size: 1.2rem;
        padding: 10px 20px;
        background-color: #6fdfc4;
        color: black;
        justify-content: left;
        transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
        filter: drop-shadow(0 0 10px rgba(111, 223, 196, 0.7));

        height: 60px;
        width: 150px;
        gap: auto;

    }

    .cta-buttons button:hover {
        background-color: #ffffff;
        color: rgb(0, 0, 0);
        transform: scale(0.9);   
 
    }

    .arrow-overlay {
        position: fixed;
        top: 100px;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        pointer-events: none;
        z-index: 1001; /* Ensure it's above other elements */
    }

    .arrow {
        width: 0;
        height: 0;
        border-left: 50px solid transparent;
        border-right: 50px solid transparent;
        border-bottom: 70px solid #6fdfc4;
        margin-top: 40px;
        animation: bounce 1s infinite;
        filter: drop-shadow(0 0 10px rgba(111, 223, 196, 0.7));
    }

    ul {
        list-style-type: none;
        padding: 0;
    }

    li {
        margin-bottom: 1rem;
        font-size: 1.2rem;
    }

    .pricing-plans {
        display: flex;
        justify-content: space-around;
        flex-wrap: wrap;
        
    }

    .card {
        background-color: #2b2a2a;
        border-radius: 10px;
        padding: 2rem;
        margin: 1rem;
        text-align: center;
        transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
        width: calc(33.333% - 2rem); /* 3 cards per row on larger screens */
        min-width: 250px; /* Minimum width for cards */
        margin: 1rem;
    }

    .card:hover {
        background-color: rgb(255, 255, 255);
    }

    .card h3 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
        width: 100%;
        text-align: center;
        justify-content: center;
        align-items: center;
    }

    .price {
        font-size: 1.8rem;
        color: #6fdfc4;
        margin-bottom: 1rem;
        width: 100%;
        text-align: center;
        justify-content: center;
        align-items: center;
    }

    .pricing-plans, .cta-buttons, .footer-container {
        max-width: 100%;
        overflow-x: hidden;
        
    }
    @keyframes bounce {
        0%, 100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-30px);
        }
    }
    @media (max-width: 767px) {
        .cta-buttons {
            flex-direction: column;
            align-items: center;
        }


    }

    @media (max-width: 1199px) {
        .hero-container {
            width: 96%;
            margin-left: 1rem;
        }

        .half-container {
            width: 96%;
            align-items: center;
            text-align: center;
        }



        h1, h2, h3, button {
            width: 100%;
        }

    }

    @media (max-width: 991px) {

        .card {
            width: calc(50% - 2rem); /* 2 cards per row on medium screens */
        }
        h2 {
            font-size: 60px;
        }
    }

    @media (max-width: 767px) {
        .hero-container {
            width: 96%;
            margin-left: 1%;
        }

        .half-container {
            padding: 1rem;
            width: 92%;
            /* height: 60%; */
        }

        .arrow-overlay {
            top: 200px;

        }


        h1 {
            font-size: 2rem;
        }

        h2 {
            font-size: 30px;
        }

        p {
            font-size: 1rem;
        }

        .terms-privacy {
            font-size: 1rem;
        }
        .terms-privacy button {
            font-size: 1rem;
        }

        .pricing-plans {
            flex-direction: column;
            align-items: center;
        }

        .card {
            width: 100%; /* 1 card per row on small screens */
        }
    }
</style>

