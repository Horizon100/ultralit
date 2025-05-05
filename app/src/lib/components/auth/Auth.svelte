<script lang="ts">
	import { onMount, createEventDispatcher, tick } from 'svelte';
	import { fade, slide, fly } from 'svelte/transition';
	import { currentUser, checkPocketBaseConnection, updateUser, signIn, signUp as registerUser, signOut, pocketbaseUrl } from '$lib/pocketbase';
	import { Camera, LogIn, UserPlus, LogOut, Send, SignalHigh, MailPlus } from 'lucide-svelte';
	import Profile from '$lib/components/ui/Profile.svelte';
	import Terms from '$lib/components/overlays/Terms.svelte';
	import PrivacyPolicy from '$lib/components/overlays/PrivacyPolicy.svelte';
	import { t } from '$lib/stores/translationStore';
	import { spring } from 'svelte/motion';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import horizon100 from '$lib/assets/horizon100.svg';
	import GoogleAuth from '$lib/components/buttons/GoogleAuth.svelte';
	import type { User } from '$lib/types/types';
	// Form state
	let email: string = '';
	let password: string = '';
	let errorMessage: string = '';
	let avatarUrl: string | null = null;
	let showProfileModal: boolean = false;
	let showTermsOverlay: boolean = false;
	let showPrivacyOverlay: boolean = false;
	let isWaitlistMode: boolean = false;
	let isLoading: boolean = false;
	let connectionChecked: boolean = false;

	// Touch interaction state
	let startY: number = 0;
	let currentY: number = 0;
	let isDragging: boolean = false;
	const SWIPE_THRESHOLD = 100;

	const yPosition = spring(0, {
		stiffness: 0.15,
		damping: 0.7
	});

	const dispatch = createEventDispatcher();

	function handleTouchStart(event: TouchEvent): void {
		if (!browser) return;
		
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

	function handleTouchMove(event: TouchEvent): void {
		if (!browser || !isDragging) return;

		const deltaY = event.touches[0].clientY - startY;
		if (deltaY > 0) {
			// Only allow downward dragging
			currentY = deltaY;
			yPosition.set(deltaY);

			// Add opacity based on drag distance
			const opacity = Math.max(0, 1 - deltaY / window.innerHeight);
			const target = event.currentTarget as HTMLElement;
			target.style.opacity = opacity.toString();
		}

		event.preventDefault();
	}

	function handleTouchEnd(event: TouchEvent): void {
		if (!browser || !isDragging) return;

		isDragging = false;
		if (currentY > SWIPE_THRESHOLD) {
			// If dragged far enough down, close
			yPosition.set(window.innerHeight, { hard: false }).then(() => {
				dispatch('close');
			});
		} else {
			// Spring back if not dragged far enough
			yPosition.set(0);
			const target = event.currentTarget as HTMLElement;
			target.style.opacity = '1';
		}
	}

	function openTermsOverlay(): void {
		showTermsOverlay = true;
	}

	function openPrivacyOverlay(): void {
		showPrivacyOverlay = true;
	}

	function openJoinWaitlistOverlay(): void {
		isWaitlistMode = !isWaitlistMode;
		// Clear fields when switching modes
		email = '';
		password = '';
		errorMessage = '';
	}

	function closeOverlay(): void {
		showTermsOverlay = false;
		showPrivacyOverlay = false;
	}

	async function login(): Promise<void> {
		if (!browser) return;
		
		errorMessage = '';
		isLoading = true;
		
		try {
			if (!email || !password) {
				errorMessage = 'Email and password are required';
				isLoading = false;
				return;
			}
			
			const authData = await signIn(email, password);
			if (authData) {
				errorMessage = '';
				// Wait for UI to update before dispatching the success event
				await tick();
				dispatch('success');
			} else {
				errorMessage = 'Login failed. Please check your credentials.';
			}
		} catch (err) {
			console.error('Login error:', err);
			errorMessage = err instanceof Error ? err.message : 'An error occurred during login';
		} finally {
			isLoading = false;
		}
	}

	async function signUp(): Promise<void> {
    if (!browser) return;
    
    errorMessage = '';
    isLoading = true;
    
    try {
        if (!email || !password) {
            errorMessage = 'Email and password are required';
            isLoading = false;
            return;
        }
        
        console.log('Attempting signup with:', email, password ? '(password provided)' : '(no password)');
        
        const createdUser = await registerUser(email, password);
        if (createdUser) {
            // Login with the newly created credentials
            await login();
        } else {
            // Handle null return from registerUser like you do in login
            errorMessage = 'Signup failed. Please try again.';
        }
    } catch (err) {
        // This catch should now only trigger for unexpected errors
        console.error('Unexpected signup error:', err);
        errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during signup';
    } finally {
        isLoading = false;
    }
}

	async function handleWaitlistSubmission(): Promise<void> {
		if (!browser) return;
		
		errorMessage = '';
		isLoading = true;
		
		try {
			if (!email) {
				errorMessage = 'Email is required';
				isLoading = false;
				return;
			}
			
			// Implementation for waitlist submission
			const response = await fetch('/api/verify/waitlist', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email })
			});
			
			if (response.ok) {
				dispatch('waitlist-success', { email });
				isWaitlistMode = false;
			} else {
				let errorText = 'Failed to join waitlist. Please try again.';
				try {
					const data = await response.json();
					errorText = data.message || data.error || errorText;
				} catch (e) {
					// Use default error message if JSON parsing fails
				}
				errorMessage = errorText;
			}
		} catch (err) {
			console.error('Waitlist submission error:', err);
			errorMessage = err instanceof Error ? err.message : 'An error occurred while joining the waitlist';
		} finally {
			isLoading = false;
		}
	}

	async function logout(): Promise<void> {
		if (!browser) return;
		
		try {
			await signOut();
			showProfileModal = false;
			dispatch('logout');
		} catch (err) {
			console.error('Logout error:', err);
			errorMessage = err instanceof Error ? err.message : 'An error occurred during logout';
		}
	}

	function toggleProfileModal(): void {
		showProfileModal = !showProfileModal;
	}

	function updateAvatarUrl(): void {
		const user = get(currentUser);
		if (user && user.avatar) {
			// Use pocketbaseUrl to construct the avatar URL
			avatarUrl = `${pocketbaseUrl}/api/files/${user.collectionId}/${user.id}/${user.avatar}`;
		} else {
			avatarUrl = null;
		}
	}

	// Watch currentUser for changes
	currentUser.subscribe((user) => {
		if (user) {
			updateAvatarUrl();
		} else {
			avatarUrl = null;
		}
	});

	onMount(async () => {
		if (!browser) return;
		
		try {
			const isConnected = await checkPocketBaseConnection();
			connectionChecked = true;
			
			if (!isConnected) {
				errorMessage = 'Unable to connect to the server. Please try again later.';
				return;
			}
			
			const user = get(currentUser);
			if (user && user.id) {
				updateAvatarUrl();
			}
		} catch (error) {
			connectionChecked = true;
			console.error('Connection check error:', error);
			errorMessage = 'Unable to verify server connection. Please try again later.';
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
		<!-- <div class="user-info">
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
		</div> -->
	{:else}
		<div class="login-container">
			<div class="credentials">
				<form 
				on:submit|preventDefault={(e) => {
				  e.preventDefault();
				  // This ensures the form never handles the signup
				}} 
				class="auth-form"
			  >
			  <span>
				<img src={horizon100} alt="Horizon100" class="logo" />
				<h2>vRAZUM</h2>							

			  </span>

					<input 
						type="email" 
						bind:value={email} 
						placeholder="Email" 
						required 
						disabled={isLoading}
					/>
					
					<!-- {#if !isWaitlistMode} -->
						<input
							type="password"
							bind:value={password}
							placeholder="Password"
							required
							disabled={isLoading}
							transition:fly={{ duration: 300 }}
						/>
					<!-- {/if} -->
					
					<div class="button-group">
						{#if !isWaitlistMode}
							<button 
								class="button-login" 
								on:click|preventDefault={login}
								type="button"
								disabled={isLoading}
							>
							
								<span>							
									<LogIn />
									<span class="btn-description">
										{$t('profile.login')}
									</span>

									{isLoading ? 'Logging in...' : '' }
								</span>
							</button>
							<button 
							class="button-login" 
							on:click={(e) => {
							  e.preventDefault();
							  if (email && password) {
								signUp();
							  } else {
								errorMessage = 'Email and password are required';
							  }
							}}
							type="button"
							disabled={isLoading}
						  >
							<span>
							  <MailPlus />	
							  <span class="btn-description">
								{$t('profile.signup')}
							  </span>						
							  <!-- {isLoading ? 'Signing up...' : ''} -->
							</span>
						  </button>
						<!-- <div class="button-login">
							<GoogleAuth/>
							<span class="btn-description google">
								{$t('profile.googleAuth')}
							</span>
						</div>  -->
						{:else}
							<!-- <button 
								class="button button-waitlist" 
								on:click|preventDefault={handleWaitlistSubmission}
								type="button"
								disabled={isLoading}
							>
								<button class="button-login">
									<Send />
									{isLoading ? 'Joining...' : $t('profile.join')}
								</button>
							</button> -->
						{/if}
					</div>
					<!-- <button 
					class="button button-subtle" 
					on:click|preventDefault={openJoinWaitlistOverlay}
					type="button"
					disabled={isLoading}
				>
					{isWaitlistMode ? $t('profile.login') : $t('profile.waitlist')}
				</button> -->
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
		<LogOut size={24} />
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
	@use 'src/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.auth-container {
		display: flex;
		flex-direction: column;
		height: 100%;

		width: 100%;
		// border-radius: 2rem;
		// background: var(--bg-gradient);
		// border: 1px solid rgb(53, 53, 53);
		/* border-radius: 20px; */
		/* border-bottom-left-radius: 100%; */
		/* border-bottom-right-radius: 100%; */
		justify-content: center;
		align-items: center;
		gap: 20px;
		/* height: 50px; */
		padding: 3rem;
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
		margin-top: 1rem;
		font-size: 1rem;
		color: #ffffff;
		letter-spacing: 0.1rem;
		gap: 0.5rem;
		text-align: center;

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

	.waitlist {
		display: flex;
		flex-direction: column;
	}

	.avatar,
	.avatar-placeholder {
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
		flex-direction: column;
		h2 {
			display: flex;
			justify-content:center;
			width: 100%;
			margin: 0;
			padding: 0;
		}
	}
	.welcome-message {
		cursor: pointer;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: auto;
		/* height: 100px; */
		gap: 1rem;

		& span {
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
		}
		& h2 {
			font-size: 2rem;
		}
		
	}
	.auth-form input {
		color: var(--text-color); 
		// padding: 1.5rem;
		border-radius: 0.5rem;
		display: flex;
		width: calc(100% - 2rem) !important;
		border: 1px solid transparent;
		font-size: 1.5rem;
		outline: none; 
		margin-bottom: 0;
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
		&:focus {
			outline: none; 
			background: var(--secondary-color) !important; 
			color: var(--text-color);
		}
	}



	.auth-form input::placeholder {
		color: #95a5a6; /* Lighter color for placeholder text */
	}

	.auth-form input[type='email'],
	.auth-form input[type='password'] {
		background: var(--bg-color);
		width: 50%;
		& :focus {
			outline: none; 
			border-color: var(--tertiary-color);
		}
	}

	.button {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		width: 100%;
		// padding: 10px;
		border: none;
		cursor: pointer;
		background: transparent;
		transition: background-color 0.3s;
	}

	.button-signup {
		background-color:transparent;
		justify-content: left;
		color: var(--tertiary-color);
		font-size: 1rem;
		opacity: 0.8;
		width: 100%;
		display: flex;
		padding: 0.5rem;

		&:hover {
		}
	}
	img.logo {
		width: 4rem;
		height: 4rem;
	}
	.button-login {
		width: 100% !important;
		height: 3rem;
		background: var(--primary-color);
		color: var(--placeholder-color);
		display: flex;
		justify-content: center !important;
		align-items: center !important;
		flex-direction: row;
		border-radius: var(--radius-m) !important;
		border: 1px solid transparent;
		font-size: 1rem;
		transition: all 0.3s ease-in;
		&:hover {
			color: var(--text-color);
			background: var(--secondary-color);
        //   box-shadow: 0 -1px 0 rgba(0, 0, 0, .04), 0 1px 4px rgba(0, 0, 0, .25);
		// box-shadow: 0px 2px 2px 0px rgba(251, 245, 245, 0.2);

			cursor: pointer;

		}
		& span {
			width: auto;
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			gap: 1rem;

			&.btn-description {
				display: flex;

				& :hover {
					display: flex;
				}
			}

		}
	}

	.button-subtle {
		display: flex;
		justify-content: center;
		align-items: center;
		color: var(--placeholder-color);
		background: transparent;
		font-style: italic;
		font-size: 1.2rem;
		width: 100%;
		height: 80px;
		user-select: none;
		transition: all 0.3s ease-in-out;
		&:hover {
			background: transparent;
			color: var(--text-color);
			cursor: pointer;

		}
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

		&:hover {
			cursor: pointer;
		}
	}

	.error {
		color: #e74c3c;
		margin-top: 10px;
	}

	.button-group {
		display: flex;
		flex-direction: column;
		height: auto;
		align-items: center;
		justify-content: space-around;
		width: 100%;
		gap: 0.5rem;
		/* margin-left: 5%; */
		/* margin-top: 10px; */
		/* width: 100%; */
	}



	/* Hover effects for buttons */
	// .button-group .button:hover {
	// 	background-color: var(--tertiary-color); /* Darken background on hover */
	// 	opacity: 1;
	// }

	@media (max-width: 768px) {
		.auth-container {
			display: flex;
			// background-color: rgba(255, 255, 255, 0.1);
			// backdrop-filter: blur(10px);
			color: var(--text-color);
			// border: 1px solid rgb(53, 53, 53);
			/* border-radius: 20px; */
			/* border-bottom-left-radius: 100%; */
			/* border-bottom-right-radius: 100%; */
			justify-content: center;
			align-items: center;
			border-radius: var(--radius-m);
			padding: 1rem;
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
			gap: 1rem;
		}

		form {
			width: 100%;
		}


		.button-group {

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
			color: var(--text-color);
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
