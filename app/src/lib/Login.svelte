<script lang="ts">
    import { onMount } from 'svelte';
    import { pb, currentUser, checkPocketBaseConnection } from './pocketbase';

    let username: string = '';
    let password: string = '';
    let errorMessage: string = '';
    let usernameValid: boolean = true;
    let passwordValid: boolean = true;

    onMount(async () => {
        const isConnected = await checkPocketBaseConnection();
        if (!isConnected) {
            errorMessage = 'Unable to connect to the server. Please try again later.';
        }
    });

    function validateUsername(value: string) {
        usernameValid = value.length >= 3 && value.length <= 150;
    }

    function validatePassword(value: string) {
        passwordValid = value.length >= 8 && value.length <= 72;
    }

    async function login() {
        try {
            await pb.collection('users').authWithPassword(username, password);
            currentUser.set(pb.authStore.model);
            errorMessage = '';
        } catch (err) {
            console.error('Login error:', err);
            errorMessage = err.message || 'An error occurred during login';
        }
    }

    async function signUp() {
        if (!usernameValid || !passwordValid) {
            // errorMessage = 'Please correct the input errors before signing up.';
            return;
        }

        try {
            const data = {
                username,
                password,
                passwordConfirm: password,
                name: 'Hey',
            };
            console.log('Sending signup data:', data);
            const createdUser = await pb.collection('users').create(data);
            console.log('User created:', createdUser);
            await login();
            errorMessage = '';
        } catch (err) {
            console.error('Signup error:', err);
            if (err.response && err.response.data) {
                console.error('Response data:', JSON.stringify(err.response.data, null, 2));
                if (typeof err.response.data === 'object') {
                    errorMessage = Object.entries(err.response.data)
                        .map(([key, value]) => `${key}: ${value.message}`)
                        .join(', ');
                } else {
                    errorMessage = err.response.data.message || 'An error occurred during signup';
                }
            } else {
                errorMessage = err.message || 'An error occurred during signup';
            }
        }
    }

    function signOut() {
        pb.authStore.clear();
        currentUser.set(null);
    }
</script>

<div class="auth-container">
    {#if $currentUser}
        <p class="welcome-message">
            <strong>{$currentUser.username}</strong>
        </p>
        <button class="button button-signout" on:click={signOut}>⏏︎</button>
    {:else}
        <form on:submit|preventDefault class="auth-form">
            <div class="input-wrapper">
                <input
                    class="input"
                    class:invalid={!usernameValid}
                    placeholder="Username (3-150)"
                    type="text"
                    bind:value={username}
                    on:input={() => validateUsername(username)}
                    autocomplete="username"
                />
                {#if !usernameValid}
                    <span class="error-indicator">!</span>
                {/if}
            </div>
            <div class="input-wrapper">
                <input
                    class="input"
                    class:invalid={!passwordValid}
                    placeholder="Password (8-72)"
                    type="password"
                    bind:value={password}
                    on:input={() => validatePassword(password)}
                    autocomplete="current-password"
                />
                {#if !passwordValid}
                    <span class="error-indicator">!</span>
                {/if}
            </div>
            <div class="button-group">
                <button class="button button-signup" on:click={signUp}>Sign Up</button>
                <button class="button button-login" on:click={login}>Login</button>
            </div>
        </form>
    {/if}

    {#if errorMessage}
        <p class="error">{errorMessage}</p>
    {/if}
</div>

<style>
    .auth-container {
        height: 30px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        margin: 0 auto;
        padding: 5px;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        flex-grow: 1;
    }

    .auth-form {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        flex-grow: 1;
    }

    .input-wrapper {
        position: relative;
        flex-grow: 1;
    }

    .input {
        padding: 5px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
        flex-grow: 1;
        min-width: 0;
        width: 100px;
        height: 10px;
    }

    .input.invalid {
        border-color: #f44336;
    }

    .error-indicator {
        position: absolute;
        right: 5px;
        top: 50%;
        transform: translateY(-50%);
        color: #f44336;
        font-weight: bold;
        font-size: 12px;
    }

    .button-group {
        display: flex;
        gap: 5px;
    }

    .welcome-message {
        font-size: 16px;
        margin: 0;
        padding-right: 100px;
        display: flex;
        flex-direction: row;
        max-width: 300px;
        transform: scale(1.0);
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    }

    .welcome-message:hover {
        transform: scale(1.2);
    }

    .button {
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.3s ease;
        white-space: nowrap;
    }

    .button-signup {
        background-color: #292929;
        color: white;
    }

    .button-login {
        background-color: #3d3d3d;;
        color: white;
    }

    .button-signout {
        background-color: #110e0e;
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 34px;
        width: 34px;
        border-radius: 10px;
        font-size: 16px;
    }

    .button:hover {
        opacity: 0.8;
    }

    .error {
        color: #f44336;
        font-size: 10px;
        margin: 0;
        padding-left: 10px;
    }

    @media (max-width: 600px) {
        .auth-container {
            flex-direction: row;
            height: auto;
            padding: 10px;
            display: flex;

            align-items: center;
            justify-content: center;
        }

        form {
            flex-direction: row;
            width: auto;
            display: flex;

        }

        .button-group {
            width: 100%;
            justify-content: space-between;
        }

        .welcome-message, .error {
            width: 100%;
            text-align: center;
            padding: 5px 0;
        }
    }
</style>