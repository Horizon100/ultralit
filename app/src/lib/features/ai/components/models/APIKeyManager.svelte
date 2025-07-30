<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { apiKey, type ApiKeys } from '$lib/stores/apiKeyStore';
	import { fade, slide } from 'svelte/transition';
	import { fetchTryCatch, isSuccess } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	interface ServiceConfig {
		name: string;
		icon: IconName;
		description: string;
		placeholder: string;
		pattern: string;
	}

	const services: Record<keyof ApiKeys, ServiceConfig> = {
		openai: {
			name: 'OpenAI',
			icon: 'Key',
			description: 'Used for chat and completions',
			placeholder: 'sk-...',
			pattern: '^sk-[a-zA-Z0-9]{48}$'
		},
		anthropic: {
			name: 'Anthropic',
			icon: 'Key',
			description: 'Used for Claude API',
			placeholder: 'sk-ant-...',
			pattern: '^sk-ant-[a-zA-Z0-9]{48}$'
		},
		stability: {
			name: 'Stability AI',
			icon: 'Key',
			description: 'Used for image generation',
			placeholder: 'sk-...',
			pattern: '^sk-[a-zA-Z0-9]{48}$'
		}
	};

	let inputKeys: Partial<Record<keyof ApiKeys, string>> = {};
	let showKeys: Partial<Record<keyof ApiKeys, boolean>> = {};
	let verifying: Partial<Record<keyof ApiKeys, boolean>> = {};
	let errors: Partial<Record<keyof ApiKeys, string>> = {};

	$: existingKeys = Object.keys($apiKey).filter((key) => !!$apiKey[key]);

	async function verifyAndSaveKey(service: keyof ApiKeys) {
		const key = inputKeys[service];
		if (!key) return;

		verifying[service] = true;
		errors[service] = '';

		const result = await fetchTryCatch<{ success: boolean; error?: string }>(
			`/api/verify/${service}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key })
			}
		);

		if (isSuccess(result)) {
			if (result.data.success) {
				await apiKey.setKey(service as string, key);
				inputKeys[service] = '';
			} else {
				errors[service] = result.data.error || `Invalid ${services[service].name} API key`;
			}
		} else {
			console.error(`Error verifying ${service} key:`, result.error);
			errors[service] = `Error verifying ${services[service].name} key`;
		}

		verifying[service] = false;
	}
	async function removeKey(service: keyof ApiKeys) {
		try {
			await apiKey.deleteKey(service as string);
		} catch (error) {
			console.error(`Error removing ${service} key:`, error);
		}
	}
</script>

<div class="api-key-manager">
	<h2>API Keys</h2>

	{#each Object.entries(services) as [service, config]}
		<div class="key-section" transition:slide>
			<div class="key-header">
				<Icon name={config.icon} size={20} />
				<h3>{config.name}</h3>
			</div>

			<p class="description">{config.description}</p>

			{#if $apiKey[service]}
				<div class="existing-key" transition:fade>
					<div class="key-display">
						<span>••••••••</span>
						<button class="remove-key" on:click={() => removeKey(service)} title="Remove key">
							<Icon name="Trash2" size={16} />
						</button>
					</div>
					<span class="verified">
						<Icon name="Check" size={16} />
					</span>
				</div>
			{:else}
				<div class="input-group">
					<div class="input-wrapper">
						{#if showKeys[service]}
							<input
								type="text"
								bind:value={inputKeys[service]}
								placeholder={config.placeholder}
								pattern={config.pattern}
							/>
						{:else}
							<input
								type="password"
								bind:value={inputKeys[service]}
								placeholder={config.placeholder}
								pattern={config.pattern}
							/>
						{/if}
						<button
							class="toggle-visibility"
							on:click={() => (showKeys[service] = !showKeys[service])}
						>
							<Icon name={showKeys[service] ? 'EyeOff' : 'Eye'} size={16} />
						</button>
					</div>

					<button
						class="save-key"
						disabled={verifying[service] || !inputKeys[service]}
						on:click={() => verifyAndSaveKey(service)}
					>
						{verifying[service] ? 'Verifying...' : 'Save'}
					</button>
				</div>

				{#if errors[service]}
					<div class="error" transition:fade>
						<Icon name="AlertCircle" size={16} />
						<span>{errors[service]}</span>
					</div>
				{/if}
			{/if}
		</div>
	{/each}

	<div class="info">
		<p>
			Your API keys are encrypted and stored securely. They are only used to make requests to the
			respective services.
		</p>
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
</style>
