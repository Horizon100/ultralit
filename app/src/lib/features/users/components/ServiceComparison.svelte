<script lang="ts">
	// Component for comparing Vrazum with other LLM chat services
	type Feature = {
		name: string;
		vrazum: boolean | string;
		openai: boolean | string;
		claude: boolean | string;
		ollama: boolean | string;
		generic: boolean | string;
	};

	const features: Feature[] = [
		{
			name: 'Multi-model Support',
			vrazum: 'ChatGPT, Claude, Deepseek, Grok, Gemini',
			openai: 'GPT-3.5, GPT-4 only',
			claude: 'Claude only',
			ollama: 'Local models only',
			generic: 'Single provider'
		},
		{
			name: 'Project Management',
			vrazum: true,
			openai: false,
			claude: false,
			ollama: false,
			generic: false
		},
		{
			name: 'Context Window Optimization',
			vrazum: true,
			openai: 'Limited',
			claude: 'Limited',
			ollama: 'Model dependent',
			generic: 'Basic'
		},
		{
			name: 'Collaborative Workspaces',
			vrazum: true,
			openai: false,
			claude: false,
			ollama: false,
			generic: false
		},
		{
			name: 'P2P Messaging in Chat',
			vrazum: true,
			openai: false,
			claude: false,
			ollama: false,
			generic: false
		},
		{
			name: 'Thread Management',
			vrazum: 'Full sidebar control',
			openai: 'Basic',
			claude: 'Basic',
			ollama: 'Basic',
			generic: 'Basic'
		},
		{
			name: 'Customizable Prompt Shortcuts',
			vrazum: true,
			openai: false,
			claude: false,
			ollama: false,
			generic: false
		},
		{
			name: 'Message Bookmarking',
			vrazum: true,
			openai: false,
			claude: false,
			ollama: false,
			generic: false
		},
		{
			name: 'API Key Management',
			vrazum: 'Encrypted storage',
			openai: 'Basic',
			claude: 'Basic',
			ollama: 'Not required',
			generic: 'Basic'
		},
		{
			name: 'Theme Switching',
			vrazum: 'Multiple themes',
			openai: 'Light/Dark',
			claude: 'Light/Dark',
			ollama: 'Basic',
			generic: 'Basic'
		},
		{
			name: 'Multi-language Support',
			vrazum: 'English, Russian',
			openai: 'English',
			claude: 'English',
			ollama: 'Limited',
			generic: 'English'
		},
		{
			name: 'AI Agent Support',
			vrazum: 'Planned',
			openai: 'Via GPTs',
			claude: false,
			ollama: false,
			generic: false
		},
		{
			name: 'Timeline Navigation',
			vrazum: 'Planned',
			openai: false,
			claude: false,
			ollama: false,
			generic: false
		},
		{
			name: 'Hosting Options',
			vrazum: 'Cloud + Self-hosted',
			openai: 'Cloud only',
			claude: 'Cloud only',
			ollama: 'Self-hosted only',
			generic: 'Varies'
		}
	];

	const services = [
		{ id: 'vrazum', name: 'Vrazum', icon: '🤖' },
		{ id: 'openai', name: 'ChatGPT', icon: '🔎' },
		{ id: 'claude', name: 'Claude', icon: '🎯' },
		{ id: 'ollama', name: 'Ollama', icon: '💻' },
		{ id: 'generic', name: 'Generic LLM', icon: '⚡' }
	];

	// Function to get cell content with proper styling
	function getCellContent(value: boolean | string): { content: string; class: string } {
		if (typeof value === 'boolean') {
			return {
				content: value ? '✓' : '✗',
				class: value ? 'check' : 'cross'
			};
		}
		
		if (value === 'Planned') {
			return {
				content: '🚀 Planned',
				class: 'planned'
			};
		}
		
		return {
			content: value,
			class: 'text'
		};
	}
</script>

<div class="comparison-table">
	<h1>LLM Platform Comparison</h1>
	<div class="table-container">
		<table>
			<thead>
				<tr>
					<th>Feature</th>
					{#each services as service}
						<th class="service-header">
							<div class="service-icon">{service.icon}</div>
							<div class="service-name">{service.name}</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each features as feature}
					<tr>
						<td class="feature-name">{feature.name}</td>
						<td class="vrazum-cell">{@html getCellContent(feature.vrazum).content}</td>
						<td class="{getCellContent(feature.openai).class}">{@html getCellContent(feature.openai).content}</td>
						<td class="{getCellContent(feature.claude).class}">{@html getCellContent(feature.claude).content}</td>
						<td class="{getCellContent(feature.ollama).class}">{@html getCellContent(feature.ollama).content}</td>
						<td class="{getCellContent(feature.generic).class}">{@html getCellContent(feature.generic).content}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	
	<div class="key">
		<div class="key-item"><span class="check">✓</span> Supported</div>
		<div class="key-item"><span class="cross">✗</span> Not supported</div>
		<div class="key-item"><span class="planned">🚀</span> Planned feature</div>
	</div>
	
	<div class="note">
		<strong>Vrazum</strong> positions itself as a comprehensive LLM aggregator and project management platform,
		offering unique features like collaborative workspaces, P2P messaging, and optimized context window management
		across multiple LLM providers.
	</div>
</div>

<style lang="scss">
	@use 'src/styles/themes.scss' as *;

    * {
		font-family: var(--font-family);
    }

	.comparison-table {
		color: var(--text-color);
		padding: 2rem;
		border-radius: 8px;
		h1 {
			text-align: center;
			margin-bottom: 2rem;
			color: var(--primary-color);
			font-size: 2rem;
		}

		.table-container {
			overflow-x: auto;
			border-radius: 8px;
			border: 1px solid var(--line-color);
			margin-bottom: 1.5rem;
		}

		table {
			width: 100%;
			border-collapse: collapse;
			background: var(--bg-color);
		}

		th, td {
			padding: 1rem;
			text-align: center;
			border: 1px solid var(--line-color);
		}

		thead {
			background: var(--bg-gradient);
		}

		.service-header {
			min-width: 120px;

			.service-icon {
				font-size: 1.5rem;
				margin-bottom: 0.5rem;
			}

			.service-name {
				font-weight: bold;
				color: var(--primary-color);
			}
		}

		.feature-name {
			text-align: left;
			font-weight: 500;
			width: 250px;
		}

		.vrazum-cell {
			background: linear-gradient(135deg, 
				var(--bg-gradient) 0%, 
				var(--bg-gradient-r) 100%
			);
			font-weight: 600;
			color: var(--primary-color);
		}

		.check {
			color: var(--secondary-color);
			font-weight: bold;
			font-size: 1.2rem;
		}

		.cross {
			color: var(--tertiary-color);
			font-weight: bold;
			font-size: 1.2rem;
		}

		.planned {
			color: var(--primary-color);
			font-size: 0.9rem;
		}

		.text {
			font-size: 0.9rem;
		}

		.key {
			display: flex;
			gap: 1.5rem;
			justify-content: center;
			margin: 1rem 0;
			font-size: 0.9rem;

			.key-item {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}
		}

		.note {
			margin-top: 2rem;
			padding: 1rem;
			background: var(--bg-gradient-left);
			border-radius: 8px;
			font-size: 0.95rem;
			line-height: 1.6;
			color: var(--placeholder-color);

			strong {
				color: var(--primary-color);
			}
		}

		// Responsive design
		@media (max-width: 768px) {
			padding: 1rem;

			th, td {
				padding: 0.5rem;
				font-size: 0.9rem;
			}

			.service-icon {
				display: none;
			}

			.feature-name {
				width: auto;
				min-width: 120px;
			}
		}
	}
</style>