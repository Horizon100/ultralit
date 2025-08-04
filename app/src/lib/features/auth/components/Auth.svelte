<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, createEventDispatcher, tick } from 'svelte';
	import { fade, slide, fly } from 'svelte/transition';
	import {
		currentUser,
		checkPocketBaseConnection,
		updateUser,
		signIn,
		signUp as registerUser,
		signOut,
		requestPasswordReset,
		getUserSecurityQuestion,
		resetPasswordWithSecurity
	} from '$lib/pocketbase';
	import { pocketbaseUrl } from '$lib/stores/pocketbase';

	import Profile from '$lib/features/users/components/Profile.svelte';
	import Terms from '$lib/features/legal/components/Terms.svelte';
	import PrivacyPolicy from '$lib/features/legal/components/PrivacyPolicy.svelte';
	import { t } from '$lib/stores/translationStore';
	import { spring } from 'svelte/motion';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import horizon100 from '$lib/assets/thumbnails/horizon100.svg';
	import GoogleAuth from '$lib/components/buttons/GoogleAuth.svelte';
	import InvitationForm from '$lib/components/forms/InvitationForm.svelte';
	import Google from '$lib/assets/icons/auth/google.svg';
	import Microsoft from '$lib/assets/icons/auth/microsoft.svg';
	import Yandex from '$lib/assets/icons/auth/yandex.svg';
	import { clientTryCatch, validationTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	let email: string = '';
	let password: string = '';
	let errorMessage: string = '';
	let avatarUrl: string | null = null;
	let showProfileModal: boolean = false;
	let showTermsOverlay: boolean = false;
	let showPrivacyOverlay: boolean = false;
	let showInvitationOverlay: boolean = false;
	let showPasswordReset: boolean = false;
	let isWaitlistMode: boolean = false;
	let isLoading: boolean = false;
	let connectionChecked: boolean = false;

	let startY: number = 0;
	let currentY: number = 0;
	let isDragging: boolean = false;
	let showSecurityQuestions: boolean = false;
	let resetSecurityAnswer: string = '';
	let newPassword: string = '';
	let confirmPassword: string = '';
	let userSecurityQuestion: string = '';
	let showStyles = false;

	$: securityAnswerPlaceholder = $t('security.securityAnswer') as string;
	$: newPasswordPlaceholder = $t('security.newPassword') as string;
	$: confirmPasswordPlaceholder = $t('security.confirmPassword') as string;

	$: securityQuestions = Object.entries(
		$t('security.passwordQuestions') as Record<string, string>
	).map(([key, value]) => ({
		key,
		question: value
	}));
	const SWIPE_THRESHOLD = 100;

	const yPosition = spring(0, {
		stiffness: 0.15,
		damping: 0.7
	});

	const dispatch = createEventDispatcher();

	function handleTouchStart(event: TouchEvent): void {
		if (!browser) return;

		const touch = event.touches[0];
		const element = event.currentTarget as HTMLElement;
		const rect = element.getBoundingClientRect();
		const touchY = touch.clientY - rect.top;

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
			currentY = deltaY;
			yPosition.set(deltaY);

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
			yPosition.set(window.innerHeight, { hard: false }).then(() => {
				dispatch('close');
			});
		} else {
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
	function openInvitationOverlay(): void {
		showInvitationOverlay = true;
	}
	function openPasswordReset(): void {
		showPasswordReset = true;
	}
	function closePasswordReset(): void {
		showPasswordReset = false;
		showSecurityQuestions = false;
		resetSecurityAnswer = '';
		newPassword = '';
		confirmPassword = '';
		userSecurityQuestion = '';
		errorMessage = '';
	}
	function openJoinWaitlistOverlay(): void {
		isWaitlistMode = !isWaitlistMode;

		email = '';
		password = '';
		errorMessage = '';
	}

	function closeOverlay(): void {
		showTermsOverlay = false;
		showPrivacyOverlay = false;
		showInvitationOverlay = false;
		showPasswordReset = false;
	}
	export async function login(): Promise<void> {
		if (!browser) return;

		errorMessage = '';
		isLoading = true;

		try {
			const validationResult = validationTryCatch(() => {
				if (!email || !password) {
					throw new Error('Email and password are required');
				}
				if (!email.includes('@')) {
					throw new Error('Please enter a valid email address');
				}
				if (password.length < 6) {
					throw new Error('Password must be at least 6 characters long');
				}
			});

			if (isFailure(validationResult)) {
				errorMessage = validationResult.error;
				return;
			}

			console.log('Starting login process...');

			const signInResult = await clientTryCatch(signIn(email, password));

			if (isSuccess(signInResult)) {
				const authData = signInResult.data;

				if (authData) {
					console.log('Login successful, navigating...');
					errorMessage = '';
					await tick();

					dispatch('close');
					dispatch('success');

					await goto('/home');
				} else {
					errorMessage = 'Login failed. Please check your credentials.';
				}
			} else {
				console.error('Login error:', signInResult.error);
				errorMessage = signInResult.error;
			}
		} catch (err) {
			console.error('Unexpected login error:', err);
			errorMessage =
				err instanceof Error ? err.message : 'An unexpected error occurred during login';
		} finally {
			isLoading = false;
		}
	}

	export async function signUp(): Promise<void> {
		if (!browser) return;

		errorMessage = '';
		isLoading = true;

		try {
			if (!email || !password) {
				errorMessage = 'Email and password are required';
				return;
			}

			console.log(
				'Attempting signup with:',
				email,
				password ? '(password provided)' : '(no password)'
			);

			const createdUser = await registerUser(email, password);
			if (createdUser) {
				await login();
			} else {
				errorMessage = 'Signup failed. Please try again.';
			}
		} catch (err) {
			console.error('Unexpected signup error:', err);
			errorMessage =
				err instanceof Error ? err.message : 'An unexpected error occurred during signup';
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
					console.warn('Failed to parse error response:', e);
				}
				errorMessage = errorText;
			}
		} catch (err) {
			console.error('Waitlist submission error:', err);
			errorMessage =
				err instanceof Error ? err.message : 'An error occurred while joining the waitlist';
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
	function handleStyleClick() {
		showStyles = !showStyles;
	}

	function handleStyleClose() {
		showStyles = false;
	}

	function updateAvatarUrl(): void {
		const user = get(currentUser);
		if (user && user.avatar) {
			avatarUrl = `${pocketbaseUrl}/api/files/${user.collectionId}/${user.id}/${user.avatar}`;
		} else {
			avatarUrl = null;
		}
	}

	currentUser.subscribe((user) => {
		if (user) {
			updateAvatarUrl();
		} else {
			avatarUrl = null;
		}
	});

	async function startPasswordReset(): Promise<void> {
		if (!email) {
			errorMessage = 'Email is required';
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			const question = await getUserSecurityQuestion(email);
			userSecurityQuestion = question;
			showSecurityQuestions = true;
		} catch (err) {
			console.error('Error getting security question:', err);
			errorMessage =
				err instanceof Error ? err.message : 'Failed to find security question for this email';
		} finally {
			isLoading = false;
		}
	}

	async function resetPasswordWithSecurityAnswer(): Promise<void> {
		if (!email || !resetSecurityAnswer || !newPassword || !confirmPassword) {
			errorMessage = 'All fields are required';
			return;
		}

		if (newPassword !== confirmPassword) {
			errorMessage = 'Passwords do not match';
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			await resetPasswordWithSecurity(email, resetSecurityAnswer, newPassword);

			closePasswordReset();
			dispatch('notification', {
				type: 'success',
				message: 'Password reset successfully! You can now login with your new password.'
			});
		} catch (err) {
			console.error('Password reset error:', err);
			errorMessage = err instanceof Error ? err.message : 'Failed to reset password';
		} finally {
			isLoading = false;
		}
	}
	$: emailPlaceholder = $t('profile.email') as string;
	$: passwordPlaceholder = $t('profile.password') as string;
	$: resetPlaceholder = $t('profile.emailReset') as string;

	onMount(async () => {
		if (!browser) return;

		const connectionResult = await clientTryCatch(
			checkPocketBaseConnection(),
			'Server connection check'
		);

		connectionChecked = true;

		if (isFailure(connectionResult)) {
			console.error('Connection check error:', connectionResult.error);
			errorMessage = 'Unable to verify server connection. Please try again later.';
			return;
		}

		if (!connectionResult.data) {
			errorMessage = 'Unable to connect to the server. Please try again later.';
			return;
		}

		const userValidation = validationTryCatch(() => {
			const user = get(currentUser);
			return user?.id ? user : null;
		}, 'user authentication check');

		if (isSuccess(userValidation) && userValidation.data) {
			const avatarResult = await clientTryCatch(
				Promise.resolve(updateAvatarUrl()),
				'Avatar URL update'
			);

			if (isFailure(avatarResult)) {
				console.warn('Failed to update avatar URL:', avatarResult.error);
			}
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
					}}
					class="auth-form"
				>
					<span>
						<img src={horizon100} alt="Horizon100" class="logo" />
						<h2>vRAZUM</h2>
					</span>
					<span class="email-input" transition:fly={{ duration: 300, delay: 100 }}>
						<input
							type="email"
							bind:value={email}
							placeholder={emailPlaceholder}
							required
							disabled={isLoading}
						/>
						<GoogleAuth />

						<!-- <button class="round-btn auth-provider">
					<img src={Microsoft} alt="Microsoft" class="auth-icon" />
				</button>
				<button class="round-btn auth-provider">
					<img src={Yandex} alt="Yandex" class="auth-icon" />
				</button> -->
					</span>

					<span class="password-input" transition:fly={{ duration: 300, delay: 200 }}>
						<input
							type="password"
							bind:value={password}
							placeholder={passwordPlaceholder}
							required
							disabled={isLoading}
							transition:fly={{ duration: 300 }}
						/>
						<button
							class="round-btn invitation"
							on:click={(e) => {
								e.preventDefault();
								if (email && password) {
									login();
								} else {
									errorMessage = 'Email and password are required';
								}
							}}
							type="button"
							disabled={isLoading}
							transition:fly={{ duration: 300 }}
						>
							{#if isLoading}
								<div class="small-spinner-container">
									<div class="small-spinner">
										<Icon name="Bot" />
									</div>
								</div>
							{:else}
								<span>
									{$t('profile.login')}
								</span>
								<Icon name="ChevronRight" />
							{/if}
						</button>
					</span>
					<button
						class="auth-btn"
						on:click={openInvitationOverlay}
						transition:fly={{ duration: 300 }}
					>
						<span>
							<!-- <MailPlus />	 -->
							<span class="btn-description">
								{$t('profile.invitation')}
							</span>
							<!-- {isLoading ? 'Signing up...' : ''} -->
						</span>
					</button>
					{#if showPasswordReset}
						{#if !showSecurityQuestions}
							<!-- Step 1: Enter email to get security question -->
							<span class="email-input" transition:fly={{ duration: 300, delay: 100 }}>
								<button class="round-btn back" on:click={closePasswordReset}>
									<Icon name="ChevronLeft" />
								</button>
								<input
									type="email"
									bind:value={email}
									placeholder={resetPlaceholder}
									required
									disabled={isLoading}
								/>
								<button class="round-btn submit" on:click={startPasswordReset} disabled={isLoading}>
									{#if isLoading}
										<div class="small-spinner-container">
											<div class="small-spinner">
												<Icon name="Bot" />
											</div>
										</div>
									{:else}
										<span>Next</span>
										<Icon name="ChevronRight" />
									{/if}
								</button>
							</span>
						{:else}
							<!-- Step 2: Answer security question and set new password -->
							<div class="security-reset" transition:fly={{ duration: 300 }}>
								<h3>{$t('security.securityQuestionTitle')}</h3>
								<p class="security-question-text">
									{securityQuestions.find((q) => q.key === userSecurityQuestion)?.question ||
										userSecurityQuestion}
								</p>

								<span class="security-answer-input">
									<input
										type="text"
										bind:value={resetSecurityAnswer}
										placeholder={securityAnswerPlaceholder}
										required
										disabled={isLoading}
									/>
								</span>

								<span class="password-input">
									<input
										type="password"
										bind:value={newPassword}
										placeholder={newPasswordPlaceholder}
										required
										disabled={isLoading}
									/>
								</span>

								<span class="password-input">
									<input
										type="password"
										bind:value={confirmPassword}
										placeholder={confirmPasswordPlaceholder}
										required
										disabled={isLoading}
									/>
								</span>

								<div class="reset-actions">
									<button class="round-btn back" on:click={() => (showSecurityQuestions = false)}>
										<Icon name="ChevronLeft" />
									</button>

									<button
										class="round-btn submit"
										on:click={resetPasswordWithSecurityAnswer}
										disabled={isLoading}
									>
										{#if isLoading}
											<div class="small-spinner-container">
												<div class="small-spinner">
													<Icon name="Bot" />
												</div>
											</div>
										{:else}
											<span>{$t('profile.reset')}</span>
											<Icon name="CheckCircle" />
										{/if}
									</button>
								</div>
							</div>
						{/if}
					{:else}
						<button
							class="auth-btn reset"
							on:click={openPasswordReset}
							transition:fly={{ duration: 300 }}
						>
							<span>
								<span class="btn-description">
									{$t('profile.passwordHelp')}
								</span>
							</span>
						</button>
					{/if}

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
	<Profile
		user={$currentUser}
		onClose={toggleProfileModal}
		onStyleClick={handleStyleClick}
		{logout}
	/>
	<button class="logout-button" on:click={logout} transition:fade={{ duration: 300 }}>
		<Icon name="LogOut" /> <span>Logout</span>
	</button>
{/if}

{#if showTermsOverlay}
	<Terms on:close={closeOverlay} />
{/if}

{#if showPrivacyOverlay}
	<PrivacyPolicy on:close={closeOverlay} />
{/if}

{#if showInvitationOverlay}
	<InvitationForm on:close={closeOverlay} />
{/if}

<style lang="scss">
	* {
		font-family: var(--font-family);
	}
	span.email-input,
	span.password-input,
	span.invitation-input {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		height: 4rem;
		padding: 0;
		padding-right: 0.5rem;
		gap: 1rem;
		background: var(--bg-color);
		border-radius: 2rem;
		& input {
			height: 3rem !important;
			padding-inline-start: 1rem;
			margin-left: 0.5rem;
		}
	}
	.auth-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: auto;
		justify-content: center;
		align-items: center;
		gap: 20px;
		padding: 3rem;
	}

	.login-container {
		display: flex;
		flex-direction: column;
	}

	.invitation,
	.terms-privacy {
		margin-top: 1rem;
		font-size: 1rem;
		color: var(--text-color);
		gap: 0.5rem;
		text-align: left;
		width: 100%;
		max-width: calc(600px - 4rem);
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
			justify-content: center;
			width: 100%;
			margin: 0;
			padding: 0;
		}
	}
	.welcome-message {
		cursor: pointer;
	}

	.button {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		width: 100%;

		border: none;
		cursor: pointer;
		background: transparent;
		transition: background-color 0.3s;
	}

	.button-signup {
		background-color: transparent;
		justify-content: left;
		color: var(--tertiary-color);
		font-size: 1rem;
		opacity: 0.8;
		width: 100%;
		display: flex;
		padding: 0.5rem;
	}
	img.logo {
		width: 4rem;
		height: 4rem;
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
		color: var(--text-color);
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

	@media (max-width: 768px) {
		.auth-container {
			display: flex;

			color: var(--text-color);

			/* border-radius: 20px; */
			/* border-bottom-left-radius: 100%; */
			/* border-bottom-right-radius: 100%; */
			justify-content: center;
			align-items: center;
			border-radius: var(--radius-m);
			padding: 1rem;
			/* height: 50px; */

			/* width: 100%; */
			/* padding: 20px; */

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

		.button-group .button {
			/* background-color: #007bff; Button background color */
			color: var(--text-color); /* Button text color */
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
