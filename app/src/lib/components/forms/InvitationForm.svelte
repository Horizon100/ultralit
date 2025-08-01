<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/stores/translationStore';
	import { 
		signIn, 
		signUp as registerUser,
		saveUserSecurity, 
		getUserSecurityQuestion, 
		resetPasswordWithSecurity 
	} from '$lib/pocketbase';
	import horizon100 from '$lib/assets/thumbnails/horizon100.svg';
	import { onMount, createEventDispatcher, tick } from 'svelte';
	import { browser } from '$app/environment';
	// Import client-side utilities
	import { validateInvitationCode, markInvitationCodeAsUsed } from '$lib/clients/invitationClient';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { fade, slide, fly } from 'svelte/transition';
	import Google from '$lib/assets/icons/auth/google.svg';

	let email: string = '';
	let password: string = '';
	let invitationCode: string = '';

	let errorMessage: string = '';
	let successMessage: string = '';
	let isLoading: boolean = false;
	let isCodeValid: boolean = false;
	let isCheckingCode: boolean = false;
	let validInvitationId: string | null = null;
	let selectedSecurityQuestion: string = '';
	let securityAnswer: string = '';
	let showSecurityQuestions: boolean = false;
	let isResettingPassword: boolean = false;
	let resetEmail: string = '';
	let resetSecurityAnswer: string = '';
	let newPassword: string = '';
	let confirmPassword: string = '';
	let userSecurityQuestion: string = '';

$: securityQuestions = Object.entries($t('security.passwordQuestions') as Record<string, string>).map(([key, value]) => ({
  key,
  question: value
}));

	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}
async function checkInvitationCode() {
	if (!invitationCode) {
		errorMessage = 'Please enter an invitation code';
		return;
	}

	isCheckingCode = true;
	errorMessage = '';

	try {
		console.log('🔍 Validating code:', invitationCode);
		const result = await validateInvitationCode(invitationCode);
		
		console.log('🔍 Full validation result:', result);
		console.log('🔍 result.data:', result.data);
		console.log('🔍 result.data.id:', result.data?.id);

		if (result.success && result.data) {
			console.log('🔍 Data has properties:', Object.keys(result.data));
			
			isCodeValid = true;
			validInvitationId = result.data.id ?? null;
			console.log('🔍 Set validInvitationId to:', validInvitationId);
			
			successMessage = 'Invitation code accepted! Please continue with registration.';
			console.log('Valid invitation code:', result.data);
		} else {
			errorMessage = result.error || 'Invalid or already used invitation code';
			isCodeValid = false;
		}
	} catch (err) {
		console.error('Error checking invitation code:', err);
		errorMessage = err instanceof Error ? err.message : 'An error occurred while checking the invitation code';
	} finally {
		isCheckingCode = false;
	}
}
	export async function login(): Promise<void> {
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

async function handleSignUp(): Promise<void> {
  console.log('🚀 SIGNUP BUTTON CLICKED!');
  console.log('📊 Current state:', {
    browser,
    isCodeValid,
    validInvitationId,
    email,
    password: !!password,
    selectedSecurityQuestion,
    securityAnswer: !!securityAnswer
  });

  if (!browser || !isCodeValid || !validInvitationId) {
    console.log('❌ Early return conditions:', { browser, isCodeValid, validInvitationId });
    return;
  }

  errorMessage = '';
  successMessage = '';
  isLoading = true;

  try {
    if (!email || !password) {
      errorMessage = 'Email and password are required';
      isLoading = false;
      return;
    }

    if (!selectedSecurityQuestion || !securityAnswer) {
      errorMessage = 'Please select a security question and provide an answer';
      isLoading = false;
      return;
    }

    console.log('Attempting signup with:', email, password ? '(password provided)' : '(no password)');
    console.log('Security question:', selectedSecurityQuestion);
    console.log('Security answer provided:', !!securityAnswer);

    // Pass security question data to the signup function
    const createdUser = await registerUser(email, password, selectedSecurityQuestion, securityAnswer);
    
    if (createdUser) {
      console.log('User created successfully:', createdUser);

      // Mark the invitation code as used
      console.log(`Marking invitation code ${validInvitationId} as used by user ${createdUser.id}`);
      const markResult = await markInvitationCodeAsUsed(validInvitationId, createdUser.id);
      console.log('Mark invitation code result:', markResult);

      // Login with the newly created credentials
      await login();
    } else {
      errorMessage = 'Signup failed. Please try again.';
    }
  } catch (err) {
    console.error('Unexpected signup error:', err);
    errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during signup';
  } finally {
    isLoading = false;
  }
}
	$: invitationPlaceholder = $t('profile.invitationPlaceholder') as string;
	$: emailPlaceholder = $t('profile.email') as string;
	$: passwordPlaceholder = $t('profile.password') as string;

	$: invitationReasons = $t('profile.invitationReasons') as unknown as Array<{
		bold: string;
		text: string;
	}>;
</script>

<div class="auth-overlay" on:click|self={close}>
	<div class="auth-content">
		<div class="login-container">
			<div class="credentials">
				<form
					on:submit|preventDefault={(e) => {
						e.preventDefault();
						// This ensures the form never handles the signup automatically
					}}
					class="auth-form"
				>
					{#if !isCodeValid}
						<h2>{$t('profile.invitationTitle')}</h2>
						<span class="invitation-input" transition:fly={{ duration: 300 }}>
							<input
								type="text"
								bind:value={invitationCode}
								placeholder={invitationPlaceholder}
								required
								disabled={isCheckingCode || isLoading}
							/>
							<button
								class="round-btn invitation"
								on:click|preventDefault={checkInvitationCode}
								disabled={isCheckingCode || isLoading}
								type="button"
							>
								<span> Check Code </span>
								{#if isCheckingCode}
									<div class="small-spinner-container">
										<div class="small-spinner">
											<Icon name="Bot" />
										</div>
									</div>
								{:else}
									<Icon name="ChevronRight" />
								{/if}
							</button>
						</span>
					{:else}
						<div class="code-valid" transition:fly={{ duration: 300 }}>
							<span class="check-icon">
								<Icon name="CheckCircle" />
							</span>
							<h2>{$t('profile.invitationSuccess')}</h2>
						</div>

						<span class="email-input" transition:fly={{ duration: 300, delay: 100 }}>
							<input
								type="email"
								bind:value={email}
								placeholder={emailPlaceholder}
								required
								disabled={isLoading}
							/>
							<button class="round-btn auth-provider">
								<img src={Google} alt="Google" class="auth-icon" />
							</button>
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
							/>
							<!-- <button
								class="round-btn invitation"
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
								{#if isLoading}
									<div class="small-spinner-container">
										<div class="small-spinner">
											<Icon name="Bot" />
										</div>
									</div>
								{:else}
									<span>
										{$t('profile.signup')}
									</span>
									<Icon name="ChevronRight" />
								{/if}
							</button> -->
						</span>
						  <span class="security-question-select" transition:fly={{ duration: 300, delay: 300 }}>
						<select bind:value={selectedSecurityQuestion} required disabled={isLoading}>
						<option value="">{$t('security.selectQuestion')}</option>
						{#each securityQuestions as question}
							<option value={question.key}>{question.question}</option>
						{/each}
						</select>
					
					</span>
					{/if}
					{#if selectedSecurityQuestion}
						<span class="security-answer-input" transition:fly={{ duration: 300, delay: 400 }}>
						<input
							type="text"
							bind:value={securityAnswer}
							placeholder={$t('security.securityAnswerPlaceholder')}
							required
							disabled={isLoading}
						/>
						</span>
					{/if}
{#if selectedSecurityQuestion && securityAnswer}
<div style="color: red; font-size: 12px;">
  DEBUG: selectedSecurityQuestion = "{selectedSecurityQuestion}"<br>
  DEBUG: securityAnswer = "{securityAnswer}"<br>
  DEBUG: Both filled = {!!(selectedSecurityQuestion && securityAnswer)}
</div>
	<span class="signup-button" transition:fly={{ duration: 300, delay: 500 }}>
		<button
			class="round-btn invitation"
			on:click={(e) => {
				e.preventDefault();
				handleSignUp();
			}}
			type="button"
			disabled={isLoading || !email || !password || !selectedSecurityQuestion || !securityAnswer}
		>
			{#if isLoading}
				<div class="small-spinner-container">
					<div class="small-spinner">
						<Icon name="Bot" />
					</div>
				</div>
			{:else}
				<span>{$t('profile.signup')}</span>
				<Icon name="ChevronRight" />
			{/if}
		</button>
	</span>
{/if}
					{#if errorMessage}
						<div class="error-message" transition:slide={{ duration: 200 }}>
							{errorMessage}
						</div>
					{/if}

					<!-- {#if successMessage && !errorMessage}
						<div class="success-message" transition:slide={{ duration: 200 }}>
							{successMessage}
						</div>
					{/if} -->
				</form>
			</div>
		</div>
		<span class="invitation-info">
			<h3>{$t('profile.invitationQuestion')}</h3>
			{#each invitationReasons as reason, index}
				<div class="card">
					<h4>{reason.bold}</h4>
					<p class="description">{reason.text}</p>
					<div class="list"></div>
				</div>
			{/each}
		</span>

		<span class="auth-close">
			<button class="auth" on:click={close}>Close</button>
		</span>
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.error-message {
		color: red;
		font-style: italic;
		display: flex;
		width: 100%;
		justify-content: flex-end;
	}
	.auth-content {
		width: 100%;
		max-width: 600px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}
		@supports (-webkit-appearance: none) {
		select {
			-webkit-appearance: none;
			appearance: none;
			background: var(--secondary-color);
			background-size: 1.25rem !important;
		}
	}
	select {
		padding: 1rem 2rem;
		border: 1px solid var(--line-color);
		background: var(--secondary-color);
		color: var(--text-color);
		font-size: 1rem;
		width: 100%;
		color: var(--tertiary-color);
		border-radius: 1rem;
		transition: all 0.3s ease-in;
		&:hover {
			background: var(--secondary-color);
			cursor: pointer;
		}
	}
	form {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 1rem;

		&.auth-form {
			display: flex;
			flex-shrink: shrink;
			width: 400px;
		}
	}
	h2 {
		padding: 1rem;
		font-size: 1.5rem !important;
	}
	h4 {
		color: var(--tertiary-color);
		padding: 0;
		margin: 0;
		line-height: 2;
	}

	span.auth-close {
		display: flex;
		width: 100%;
		padding: 0;
		margin: 0;
		justify-content: flex-end;
	}
	.code-valid {
		color: var(--tertiary-color);
		text-align: right;
		width: 100%;
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		& h2 {
			padding: 0;
		}
	}
	span.invitation-info {
		display: flex;
		flex-direction: column;
		width: 400px;

		margin-top: 2rem;
		& h3 {
			margin-bottom: 1rem;
		}
	}
	p.description {
		color: var(--text-color);
		margin: 0;
		line-height: 2;
		margin-bottom: 1rem;
	}
		span.invitation-input {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		width: calc(100% - 2rem);
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
</style>
