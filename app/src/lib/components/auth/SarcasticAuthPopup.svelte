<script lang="ts">
    
    import { onMount, createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';
    import { pb, currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
    import { Camera, LogIn, UserPlus, LogOutIcon } from 'lucide-svelte';
    import Profile from '../ui/Profile.svelte';

    let email: string = '';
    let password: string = '';
    let errorMessage: string = '';
    let avatarUrl: string | null = null;
    let showProfileModal = false;

    const dispatch = createEventDispatcher();

    onMount(async () => {
        const isConnected = await checkPocketBaseConnection();
        if (!isConnected) {
            errorMessage = 'Unable to connect to the server. Please try again later.';
        }
        if ($currentUser && $currentUser.id) {
            updateAvatarUrl();
        }
    });

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
</script>

<div class="auth-container">
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
        <button class="logout-button" on:click={logout}>
            <LogOutIcon size={24} />
            <span>Logout</span>
        </button>
    {:else}
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
                    <span>Sign Up</span>
                </button>
                <button class="button button-login" on:click={login}>
                    <LogIn size={16} />
                    <span>Login</span>
                </button>
            </div>
        </form>
    {/if}
    
    {#if errorMessage}
        <p class="error" transition:fade>{errorMessage}</p>
    {/if}
</div>

{#if showProfileModal}
    <Profile user={$currentUser} onClose={toggleProfileModal} />
{/if}

<style>
    .auth-container {
        background-color: #131313;
        color: #ffffff;
        /* padding: 20px; */
        border-radius: 10px;
        width: 100%;
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 10px;
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

    .welcome-message {
        cursor: pointer;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 3px;

    }

    .input {
        padding: 10px;
        border-radius: 5px;
        border: none;
        background-color: #2c3e50;
        color: white;
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
        background-color: #27ae60;
        width: 49%;
        display: flex;

    }

    .button-login {
        background-color: #3498db;
        width: 49%;
        display: flex;

    }

    .logout-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        padding: 10px;
        margin-top: 10px;
        background-color: #e74c3c;
        border: none;
        border-radius: 5px;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .error {
        color: #e74c3c;
        margin-top: 10px;
    }

    input {
        /* background-color: red; */
        height: 100px;
        color: red;
    }

    input.textarea {
    background-color: lightblue; /* Replace with your desired color */
    color: black; /* Adjust text color to ensure readability */
    height: 40px; /* Adjust height as needed */
    padding: 10px; /* Add some padding for better appearance */
    border-radius: 4px; /* Optional: rounded corners */
    border: 1px solid #ccc; /* Optional: border color */
    margin-bottom: 10px; /* Space between inputs */
}

/* Style for the password input */
input.input {
    background-color: lightgreen; /* Replace with your desired color */
    color: black; /* Adjust text color to ensure readability */
    height: 40px; /* Adjust height as needed */
    padding: 10px; /* Add some padding for better appearance */
    border-radius: 4px; /* Optional: rounded corners */
    border: 1px solid #ccc; /* Optional: border color */
    margin-bottom: 10px; /* Space between inputs */
    font-size: 20px;
}

.button-group {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        /* margin-top: 10px; */
        /* width: 100%; */
        

    }

.button-group .button {
    background-color: #007bff; /* Button background color */
    color: white; /* Button text color */
    border: none; /* Remove default border */
    border-radius: 4px; /* Rounded corners */
    cursor: pointer; /* Pointer cursor on hover */
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Hover effects for buttons */
.button-group .button:hover {
    background-color: #0056b3; /* Darken background on hover */
}

</style>