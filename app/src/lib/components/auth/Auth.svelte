<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';
    import { pb, currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
    import { Camera, LogIn, UserPlus, LogOutIcon } from 'lucide-svelte';
    import Profile from '../ui/Profile.svelte';
    import Terms from '$lib/components/overlays/Terms.svelte';
    import PrivacyPolicy from '$lib/components/overlays/PrivacyPolicy.svelte';
    import { t } from '$lib/stores/translationStore';
    import { spring } from 'svelte/motion';


    let email: string = '';
    let password: string = '';
    let errorMessage: string = '';
    let avatarUrl: string | null = null;
    let showProfileModal = false;
    let showTermsOverlay = false;
    let showPrivacyOverlay = false;

    let startY: number = 0;
    let currentY: number = 0;
    let isDragging: boolean = false;
    const SWIPE_THRESHOLD = 100;

    const yPosition = spring(0, {
        stiffness: 0.15,  
        damping: 0.7      
    });

    const dispatch = createEventDispatcher();

    function handleTouchStart(event: TouchEvent) {
        // Only initiate drag if touch starts in the top portion of the container
        const touch = event.touches[0];
        const element = event.currentTarget as HTMLElement;
        const rect = element.getBoundingClientRect();
        const touchY = touch.clientY - rect.top;
        
        // Only start dragging if touch begins in top 20% of container
        if (touchY < rect.height * 0.2) {
            startY = touch.clientY;
            isDragging = true;
            currentY = 0;
        }
    }
    function handleTouchMove(event: TouchEvent) {
        if (!isDragging) return;
        
        const deltaY = event.touches[0].clientY - startY;
        if (deltaY > 0) {  // Only allow downward dragging
            currentY = deltaY;
            yPosition.set(deltaY);
            
            // Add opacity based on drag distance
            const opacity = Math.max(0, 1 - (deltaY / window.innerHeight));
            event.currentTarget.style.opacity = opacity.toString();
        }
        
        event.preventDefault();
    }

    function handleTouchEnd() {
        if (!isDragging) return;
        
        isDragging = false;
        if (currentY > SWIPE_THRESHOLD) {
            // If dragged far enough down, close
            yPosition.set(window.innerHeight, { hard: false }).then(() => {
                dispatch('close');
            });
        } else {
            // Spring back if not dragged far enough
            yPosition.set(0);
            event.currentTarget.style.opacity = '1';
        }
    }
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



    function handleAuthSuccess() {
        dispatch('success');
    }

    async function login() {
        try {
            const authData = await pb.collection('users').authWithPassword(email, password);
            currentUser.set(authData.record);
            errorMessage = '';
            dispatch('success');
        } catch (err) {
            console.error('Login error:', err);
            errorMessage = err.message || 'An error occurred during login';
        }
    }

    async function signUp() {
        try {
            const data = {
                email,
                password,
                passwordConfirm: password,
                name: 'Hey',
            };
            const createdUser = await pb.collection('users').create(data);
            await login();
        } catch (err) {
            console.error('Signup error:', err);
            errorMessage = err.message || 'An error occurred during signup';
        }
    }

    async function logout() {
        try {
            await pb.authStore.clear();
            currentUser.set(null);
            dispatch('logout');
        } catch (err) {
            console.error('Logout error:', err);
        }
    }

    function toggleProfileModal() {
        showProfileModal = !showProfileModal;
    }

    function updateAvatarUrl() {
        if ($currentUser && $currentUser.avatar) {
            avatarUrl = pb.getFileUrl($currentUser, $currentUser.avatar);
        }
    }

    $: if ($currentUser && $currentUser.avatar) {
        updateAvatarUrl();
    }

    onMount(async () => {
        const isConnected = await checkPocketBaseConnection();
        if (!isConnected) {
            errorMessage = 'Unable to connect to the server. Please try again later.';
        }
        if ($currentUser && $currentUser.id) {
            updateAvatarUrl();
        }
    });
</script>

<div 
    class="auth-container"
    style="transform: translateY({$yPosition}px)"
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
>
    {#if $currentUser}
        <div class="user-info">
            <div class="avatar-container">
                {#if avatarUrl}
                    <img src={avatarUrl} alt="User avatar" class="avatar" />
                {:else}
                    <div class="avatar-placeholder">
                        <Camera size={24} />
                    </div>
                {/if}
            </div>
            <p class="welcome-message" on:click={toggleProfileModal}>
                <strong>{$currentUser.username || $currentUser.email}</strong>
            </p>
        </div>
    {:else}
        <div class="login-container">
            <!-- Swipe indicator -->
            <div class="credentials">
                <form on:submit|preventDefault class="auth-form">
                    <input
                        class="input"
                        type="email"
                        bind:value={email}
                        placeholder="Email"
                        required
                    />
                    <input
                        class="input"
                        type="password"
                        bind:value={password}
                        placeholder="Password"
                        required
                    />
                    <div class="button-group">
                        <button class="button button-signup" on:click={signUp}>
                            <UserPlus size={16} />
                            <span>{$t('profile.signup')}</span>
                        </button>
                        <button class="button button-login" on:click={login}>
                            <LogIn size={16} />
                            <span>{$t('profile.login')}</span>
                        </button>
                    </div>
                </form>
            </div>
            
            <div class="terms-privacy">
                <span>{$t('profile.clause')}</span>
                <button on:click={openTermsOverlay}>{$t('profile.terms')}</button>
                <span>&</span>
                <button on:click={openPrivacyOverlay}>{$t('profile.privacy')}</button>
            </div>
        </div>
    {/if}
    
    {#if errorMessage}
        <p class="error" transition:fade>{errorMessage}</p>
    {/if}
</div>

{#if showProfileModal}
    <Profile user={$currentUser} onClose={toggleProfileModal} />
    <button class="logout-button" on:click={logout} transition:fade={{ duration: 300 }}>
        <LogOutIcon size={24} />
        <span>Logout</span>
    </button>
{/if}

{#if showTermsOverlay}
    <Terms on:close={closeOverlay} />
{/if}

{#if showPrivacyOverlay}
    <PrivacyPolicy on:close={closeOverlay} />
{/if}

<style lang="scss">
	@use "src/styles/themes.scss" as *;    
    *{
        font-family: var(--font-family);

    }

    
    .auth-container {
        display: flex;
        background-color: #131313;
        color: #ffffff;
        border: 1px solid rgb(53, 53, 53);
        /* border-radius: 20px; */
        /* border-bottom-left-radius: 100%; */
        /* border-bottom-right-radius: 100%; */
        justify-content: center;
        align-items: center;
        gap: 20px;
        /* height: 50px; */
        padding: 10px 20px;
        /* width: 100%; */
        /* padding: 20px; */
        /* width: 100%; */
        /* width: 300px; */
        /* height: 40px; */

    }

    .login-container {
        display: flex;
        flex-direction: column;
    }

    .terms-privacy {
        font-size: 1rem;
        color: #ffffff;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 1rem;
        user-select: none;
    }

    .terms-privacy button {
        background: none;
        border: none;
        color: #6fdfc4;
        text-decoration: underline;
        cursor: pointer;
        font-size: 1rem;
        padding: 0;
        margin: 0;
        display: inline;
        width: auto;
    }

    .terms-privacy button:hover {
        color: #ffffff;
    }
    .user-info {
        display: flex;
        align-items: center;
        gap: 10px;
        user-select: none;
    }

    .avatar-container {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        overflow: hidden;
    }

    .avatar, .avatar-placeholder {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-placeholder {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #2c3e50;
    }

    .credentials {
        display: flex;
        flex-direction: row;
    }
    .welcome-message {
        cursor: pointer;
    }

    .auth-form {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        /* height: 100px; */
        gap: 3px;

    }



    .auth-form input {
        background-color: #8cff3f; /* Blue background color */
        color: #ffffff; /* White text color */
        /* height: 20px; Consistent height */
        padding: 10px; /* Padding for text */
        border-radius: 5px; /* Rounded corners */
        border: 1px solid #34495e; /* Subtle border */
        font-size: 16px; /* Readable font size */
        /* width: 90%; Full width of container */
        /* margin-left: 5%; */
        transition: border-color 0.3s, box-shadow 0.3s; /* Smooth transition for focus effect */
    }

.auth-form input:focus {
    outline: none; /* Remove default focus outline */
    border-color: #3498db; /* Highlight border color on focus */
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.25); /* Subtle glow effect */
    background-color: #34495e; /* Slightly lighter background on focus */
}

.auth-form input::placeholder {
    color: #95a5a6; /* Lighter color for placeholder text */
}

.auth-form input[type="email"],
.auth-form input[type="password"] {
    background-color: #08090a;
    /* ... other styles ... */
}



    .button {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 5px;
        padding: 10px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .button-signup {
        background-color: var(--tertiary-color);
        opacity: 0.8;
        width: 100%;
        display: flex;

    }

    .button-login {
        background-color: var(--bg-gradient-r);
        width: 100%;
        display: flex;
        opacity: 0.8;
    }

    .logout-button {
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        right: 2rem;
        top: 70px;
        gap: 5px;
        /* width: 100%; */
        padding: 10px;
        /* margin-top: 10px; */
        background-color: #e74c3c;
        border: none;
        border-radius: 5px;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
        font-size: 16px;
        z-index: 1000;
    }

    .error {
        color: #e74c3c;
        margin-top: 10px;
    }





.button-group {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        width: 250px;
        gap: 2px;
        /* margin-left: 5%; */
        /* margin-top: 10px; */
        /* width: 100%; */
        

    }

.button-group .button {
    /* background-color: #007bff; Button background color */
    color: white; /* Button text color */
    border: none; /* Remove default border */
    border-radius: 4px; /* Rounded corners */
    cursor: pointer; /* Pointer cursor on hover */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: all 0.3s ease;
}

/* Hover effects for buttons */
.button-group .button:hover {
    background-color: var(--tertiary-color); /* Darken background on hover */
    opacity: 1;
}



@media (max-width: 768px) {

    .auth-container {
        display: flex;
        background-color: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);        
        color: #ffffff;
        border: 1px solid rgb(53, 53, 53);
        /* border-radius: 20px; */
        /* border-bottom-left-radius: 100%; */
        /* border-bottom-right-radius: 100%; */
        justify-content: center;
        align-items: center;
        gap: 20px;
        height: 90vh;
        width: auto;
        margin-top: 4rem;
        margin-left: 1rem;
        margin-right: 1rem;
        border-radius: var(--radius-m);
        /* height: 50px; */
        // padding: 10px 20px;
        /* width: 100%; */
        /* padding: 20px; */
        // /* width: 100%; */
        /* width: 300px; */

        /* height: 40px; */

    }

    .login-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: auto;
    }

    .credentials {
        display: flex;
        flex-direction: row;
        width: 100%;
        
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        /* height: 100px; */
        gap: 3px;
        width: 100%;
        

    }

    form {
        width: 100%;
    }

    .auth-form input {
        background-color: #3f9fff; /* Blue background color */
        color: #ffffff; /* White text color */
        /* height: 20px; Consistent height */
        padding: 10px; /* Padding for text */
        border-radius: 5px; /* Rounded corners */
        border: 1px solid #34495e; /* Subtle border */
        font-size: 1.5rem; /* Readable font size */
        width: 100%;
        /* margin-left: 5%; */
        transition: border-color 0.3s, box-shadow 0.3s; /* Smooth transition for focus effect */
    }

    .button-group {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 2px;
        /* margin-left: 5%; */
        /* margin-top: 10px; */
        /* width: 100%; */
        

    }

    .button-group .button {
        /* background-color: #007bff; Button background color */
        color: white; /* Button text color */
        border: none; /* Remove default border */
        border-radius: 4px; /* Rounded corners */
        cursor: pointer; /* Pointer cursor on hover */
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        transition: all 0.3s ease;
    }

    .terms-privacy {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        font-size: 1rem;
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
        font-size: 1rem;
        padding: 0;
        margin: 0;
        display: inline;
        width: auto;
    }

}

</style>