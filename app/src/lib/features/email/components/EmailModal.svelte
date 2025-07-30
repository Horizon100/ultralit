<!-- src/lib/features/email/components/EmailModal.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type {
		EmailAccount,
		EmailMessage,
		EmailFilter,
		EmailStats,
		EmailApiResponse
	} from '$lib/types/types.email';
	import { ClientEmailUtils } from '$lib/features/email/utils/clientEmailUtils';
	import {
		formatEmailBody,
		sanitizeEmailHtml,
		getEmailContentType
	} from '$lib/features/email/utils/emailFormatting';
	import { getPocketBaseFromStore } from '$lib/stores/pocketbase';

	export let userId: string;

	let currentView: 'accounts' | 'messages' | 'message-detail' | 'add-account' | 'sync-status' =
		'accounts';
	let accounts: EmailAccount[] = [];
	let messages: EmailMessage[] = [];
	let selectedMessage: EmailMessage | null = null;
	let selectedAccount: EmailAccount | null = null;
	let loading = false;
	let error = '';
	let stats: EmailStats | null = null;
	let filter: EmailFilter = {
		limit: 50,
		offset: 0
	};
	let aiAnalysisResult: any = null;
	let aiAnalysisLoading = false;
	let addAccountForm = {
		provider: 'gmail' as const,
		email: '',
		authCode: ''
	};

	let searchQuery = '';
	let showFilters = false;

	const dispatch = createEventDispatcher();

	onMount(() => {
		if (userId) {
			loadAccounts();
		}
	});
	$: emailContent = formatEmailBody(selectedMessage?.bodyHtml, selectedMessage?.bodyText);
	$: contentType = getEmailContentType(selectedMessage?.bodyHtml, selectedMessage?.bodyText);
	$: if (userId) {
		loadAccounts();
	}
	async function loadAccounts() {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/email/accounts?userId=${userId}`);
			const data: EmailApiResponse<EmailAccount[]> = await response.json();

			if (data.success && data.data) {
				accounts = data.data;
				if (accounts.length > 0) {
					loadStats();
				}
			} else {
				error = data.error || 'Failed to load accounts';
			}
		} catch (err) {
			error = 'Network error loading accounts';
		} finally {
			loading = false;
		}
	}

	async function loadMessages(accountId?: string) {
		loading = true;
		error = '';

		try {
			const queryParams = new URLSearchParams({
				userId,
				...(accountId && { accountId }),
				...(searchQuery && { query: searchQuery }),
				limit: filter.limit?.toString() || '50',
				offset: filter.offset?.toString() || '0'
			});

			const response = await fetch(`/api/email/messages?${queryParams}`);
			const data: EmailApiResponse<EmailMessage[]> = await response.json();

			if (data.success && data.data) {
				messages = data.data;
				currentView = 'messages';
			} else {
				error = data.error || 'Failed to load messages';
			}
		} catch (err) {
			error = 'Network error loading messages';
		} finally {
			loading = false;
		}
	}

	async function loadStats() {
		try {
			const response = await fetch(`/api/email/stats?userId=${userId}`);
			const data: EmailApiResponse<EmailStats> = await response.json();

			if (data.success && data.data) {
				stats = data.data;
			}
		} catch (err) {
			console.error('Failed to load stats:', err);
		}
	}

	async function addAccount() {
		if (!addAccountForm.email) {
			error = 'Email is required';
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch('/api/email/accounts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userId,
					...addAccountForm
				})
			});

			const data: EmailApiResponse<EmailAccount> = await response.json();

			if (data.success && data.data) {
				accounts = [...accounts, data.data];
				addAccountForm = { provider: 'gmail', email: '', authCode: '' };
				currentView = 'accounts';
			} else {
				error = data.error || 'Failed to add account';
			}
		} catch (err) {
			error = 'Network error adding account';
		} finally {
			loading = false;
		}
	}

	async function syncAccount(account: EmailAccount) {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/email/sync`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					accountId: account.id
				})
			});

			const data: EmailApiResponse = await response.json();

			if (data.success) {
				// Refresh accounts to get updated sync status
				await loadAccounts();
			} else {
				error = data.error || 'Failed to sync account';
			}
		} catch (err) {
			error = 'Network error syncing account';
		} finally {
			loading = false;
		}
	}

	async function deleteAccount(accountId: string) {
		if (!confirm('Are you sure you want to delete this email account?')) {
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/email/accounts/${accountId}`, {
				method: 'DELETE'
			});

			const data: EmailApiResponse = await response.json();

			if (data.success) {
				accounts = accounts.filter((a) => a.id !== accountId);
			} else {
				error = data.error || 'Failed to delete account';
			}
		} catch (err) {
			error = 'Network error deleting account';
		} finally {
			loading = false;
		}
	}

	async function loadMessageDetail(messageId: string) {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/email/messages/${messageId}`);
			const data = await response.json();

			if (data.success && data.data) {
				console.log('📧 Raw message data:', data.data);
				console.log('👤 From field:', data.data.from);
				console.log('📧 To field:', data.data.to);

				selectedMessage = data.data;
				currentView = 'message-detail';
			} else {
				error = data.error || 'Failed to load message';
			}
		} catch (err) {
			error = 'Network error loading message';
		} finally {
			loading = false;
		}
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function truncateText(text: string, length: number): string {
		return text.length > length ? text.substring(0, length) + '...' : text;
	}
	async function getGmailAuthorization() {
		try {
			const response = await fetch('/api/email/auth/gmail');
			const data = await response.json();

			if (data.success && data.data?.authUrl) {
				// Open Google OAuth in new window
				window.open(data.data.authUrl, 'gmail-auth', 'width=500,height=600');
			} else {
				error = 'Failed to get authorization URL';
			}
		} catch (err) {
			error = 'Network error getting authorization';
		}
	}

	async function analyzeEmailWithAI(message: EmailMessage) {
		try {
			console.log('🤖 Starting AI analysis for email:', message.id);

			// Get clean text content for analysis
			const emailContent = formatEmailBody(message.bodyHtml, message.bodyText);
			const textToAnalyze = emailContent.cleanText;

			console.log('🤖 Text to analyze length:', textToAnalyze?.length);
			console.log('🤖 Text preview:', textToAnalyze?.substring(0, 100));

			if (!textToAnalyze || textToAnalyze.trim().length < 10) {
				throw new Error('Email content too short for analysis');
			}

			// Create analysis prompt
			const analysisPrompt = `You are an email analysis assistant. Analyze the following email and respond with ONLY a JSON object, no additional text.

Email Details:
From: ${message.from?.name || message.from?.email || 'Unknown'}
Subject: ${message.subject || 'No subject'}
Date: ${new Date(message.date).toLocaleDateString()}

Email Content:
${textToAnalyze.substring(0, 1000)}${textToAnalyze.length > 1000 ? '...' : ''}

Return ONLY this JSON format (no other text):
{
  "summary": "Brief 1-2 sentence summary",
  "topics": ["topic1", "topic2"],
  "actionItems": ["action1", "action2"],
  "suggestedResponse": "response text or null",
  "priority": "medium",
  "category": "business"
}

Categories: promotional, transactional, personal, business, notification, unknown
Priorities: low, medium, high`;

			console.log('🤖 Making API call to:', '/api/ai/local/generate');

			const response = await fetch('/api/ai/local/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					prompt: analysisPrompt,
					model: 'qwen2.5:0.5b',
					temperature: 0.1,
					max_tokens: 300,
					auto_optimize: false,
					system:
						'You are an email analysis assistant. Always respond with valid JSON format only. No additional text or explanations.'
				})
			});

			console.log('🤖 API response status:', response.status);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('🤖 API error response:', errorText);
				throw new Error(`AI analysis failed: ${response.status}`);
			}

			const data = await response.json();
			console.log('🤖 Raw AI response received:', data);

			// Match exactly how your working component accesses the response
			if (data.success && data.data?.response) {
				const aiResponse = data.data.response;
				console.log('🤖 Extracted AI response:', aiResponse);

				// Parse the response (same logic as working component)
				let analysisResult;
				try {
					// Try to parse as JSON first
					const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
					if (jsonMatch) {
						analysisResult = JSON.parse(jsonMatch[0]);
					} else {
						// Fallback for non-JSON response
						analysisResult = {
							summary: aiResponse.substring(0, 200),
							topics: ['email'],
							actionItems: [],
							suggestedResponse: null,
							priority: 'medium',
							category: 'unknown'
						};
					}
				} catch (parseError) {
					console.error('🤖 Parse error:', parseError);
					analysisResult = {
						summary: aiResponse.substring(0, 200),
						topics: ['email'],
						actionItems: [],
						suggestedResponse: null,
						priority: 'medium',
						category: 'unknown'
					};
				}

				// FIXED: Force Svelte reactivity by reassigning the entire object
				if (selectedMessage) {
					const aiAnalysis = {
						id: Date.now().toString(),
						messageId: message.id,
						summary: analysisResult.summary || 'Analysis completed',
						topics: analysisResult.topics || [],
						actionItems: analysisResult.actionItems || [],
						suggestedResponse: analysisResult.suggestedResponse,
						priority: analysisResult.priority || 'medium',
						category: analysisResult.category || 'unknown',
						analyzedAt: new Date().toISOString(),
						model: 'qwen2.5:0.5b'
					};

					// Trigger Svelte reactivity by reassigning the entire selectedMessage
					selectedMessage = {
						...selectedMessage,
						aiAnalysis
					};

					console.log('🤖 Analysis completed successfully:', selectedMessage.aiAnalysis);
					return aiAnalysis;
				}
			} else {
				throw new Error(data.error || 'No response from AI model');
			}
		} catch (error: any) {
			console.error('🤖 Email AI analysis error:', error);
			throw error;
		}
	}

	// Loading state for AI analysis
	let isAnalyzing = false;

	async function triggerAIAnalysis() {
		if (!selectedMessage || isAnalyzing) return;

		try {
			isAnalyzing = true;
			await analyzeEmailWithAI(selectedMessage);
		} catch (error) {
			console.error('AI analysis failed:', error);
			error = 'Failed to analyze email with AI';
		} finally {
			isAnalyzing = false;
		}
	}

	function getFromDisplay(from: any) {
		if (!from || !Array.isArray(from) || from.length === 0) {
			return 'Unknown Sender';
		}
		return from.map((f: any) => (f.name ? f.name.replace(/^"|"$/g, '') : '') || f.email).join(', ');
	}
	$: if (selectedMessage && !selectedMessage.aiAnalysis) {
		handleAiAnalysis();
	}

	async function handleAiAnalysis() {
		if (!selectedMessage || selectedMessage.aiAnalysis || aiAnalysisLoading) return;

		try {
			aiAnalysisLoading = true;
			aiAnalysisResult = await analyzeEmailWithAI(selectedMessage);
		} catch (error) {
			console.error('AI analysis failed:', error);
			aiAnalysisResult = null;
		} finally {
			aiAnalysisLoading = false;
		}
	}
</script>

<div class="modal-overlay">
	<div class="modal-content" on:click|stopPropagation>
		<div class="modal-body">
			<!-- Navigation -->
			<nav class="modal-nav">
				<button
					class="nav-btn {currentView === 'accounts' ? 'active' : ''}"
					on:click={() => (currentView = 'accounts')}
				>
					Accounts
				</button>
				<button
					class="nav-btn {currentView === 'messages' ? 'active' : ''}"
					on:click={() => loadMessages()}
					disabled={accounts.length === 0}
				>
					Messages
				</button>
				{#if stats}
					<div class="stats-summary">
						<span class="stat-item">
							<span class="stat-label">Total:</span>
							<span class="stat-value">{stats.totalMessages}</span>
						</span>
						<span class="stat-item">
							<span class="stat-label">Unread:</span>
							<span class="stat-value">{stats.unreadMessages}</span>
						</span>
					</div>
				{/if}
			</nav>

			<!-- Error Display -->
			{#if error}
				<div class="error-message">
					{error}
				</div>
			{/if}

			<!-- Loading Indicator -->
			{#if loading}
				<div class="spinner-container">
					<div class="spinner"></div>
				</div>
			{/if}

			<!-- Content Views -->
			<div class="content-area">
				{#if currentView === 'accounts'}
					<div class="accounts-view">
						<div class="view-header">
							<button class="add-btn" on:click={() => (currentView = 'add-account')}> + </button>
						</div>

						{#if accounts.length === 0}
							<div class="empty-state">
								<p>No email accounts configured</p>
								<button class="primary-btn" on:click={() => (currentView = 'add-account')}>
									Add Your First Account
								</button>
							</div>
						{:else}
							<div class="accounts-list">
								{#each accounts as account}
									<div class="account-card">
										<div class="account-info">
											<div class="account-email">{account.email}</div>
											<div class="account-provider">{account.provider}</div>
											<div class="account-status {account.isActive ? 'active' : 'inactive'}">
												{account.isActive ? 'Active' : 'Inactive'}
											</div>
										</div>
										<div class="account-actions">
											<button class="action-btn" on:click={() => loadMessages(account.id)}>
												View Messages
											</button>
											<button class="action-btn" on:click={() => syncAccount(account)}>
												Sync
											</button>
											<button class="action-btn danger" on:click={() => deleteAccount(account.id)}>
												Delete
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{:else if currentView === 'add-account'}
					<div class="add-account-view">
						<div class="view-header">
							<h3>Add Email Account</h3>
							<button class="back-btn" on:click={() => (currentView = 'accounts')}> ← </button>
						</div>

						<form class="add-account-form" on:submit|preventDefault={addAccount}>
							<div class="form-group provider">
								<label for="provider">Provider</label>
								<select id="provider" bind:value={addAccountForm.provider}>
									<option value="gmail">Gmail</option>
									<option value="outlook">Outlook</option>
								</select>
							</div>

							<div class="form-group">
								<label for="email">Email Address</label>
								<input
									id="email"
									type="email"
									bind:value={addAccountForm.email}
									placeholder="Enter your email address"
									required
								/>
							</div>

							<div class="form-group">
								<label for="authCode">Authorization Code</label>
								<input
									id="authCode"
									type="text"
									bind:value={addAccountForm.authCode}
									placeholder="Enter authorization code"
								/>
								<small class="form-help"> Click "Get Authorization" to obtain the code </small>
							</div>

							<div class="form-actions">
								<button type="button" class="secondary-btn" on:click={getGmailAuthorization}>
									Get Authorization
								</button>
								<button type="submit" class="primary-btn"> Add Account </button>
							</div>
						</form>
					</div>
				{:else if currentView === 'messages'}
					<div class="messages-view">
						<div class="view-header">
							<h3>Messages</h3>
							<button class="back-btn" on:click={() => (currentView = 'accounts')}> ← </button>
						</div>

						<div class="search-filters">
							<div class="search-box">
								<input
									type="text"
									bind:value={searchQuery}
									placeholder="Search messages..."
									on:input={() => loadMessages()}
								/>
							</div>
							<button
								class="filter-btn {showFilters ? 'active' : ''}"
								on:click={() => (showFilters = !showFilters)}
							>
								Filters
							</button>
						</div>

						{#if showFilters}
							<div class="filters-panel">
								<div class="filter-group">
									<label>
										<input
											type="checkbox"
											bind:checked={filter.isRead}
											on:change={() => loadMessages()}
										/>
										Read messages only
									</label>
								</div>
								<div class="filter-group">
									<label>
										<input
											type="checkbox"
											bind:checked={filter.isStarred}
											on:change={() => loadMessages()}
										/>
										Starred messages only
									</label>
								</div>
								<div class="filter-group">
									<label>
										<input
											type="checkbox"
											bind:checked={filter.hasAttachments}
											on:change={() => loadMessages()}
										/>
										Has attachments
									</label>
								</div>
							</div>
						{/if}

						{#if messages.length === 0}
							<div class="empty-state">
								<p>No messages found</p>
							</div>
						{:else}
							<div class="messages-list">
								{#each messages as message}
									<div
										class="message-card {!message.isRead ? 'unread' : ''}"
										on:click={() => loadMessageDetail(message.id)}
									>
										<div class="message-header">
											<div class="message-from">
												{(message.from.name ? message.from.name.replace(/^"|"$/g, '') : '') ||
													message.from.email}
											</div>
											<div class="message-date">
												{formatDate(message.date)}
											</div>
										</div>
										<div class="message-subject">
											{message.subject}
										</div>
										<div class="message-snippet">
											{truncateText(message.snippet, 120)}
										</div>
										<div class="message-meta">
											{#if message.attachments.length > 0}
												<span class="attachment-indicator">📎</span>
											{/if}
											{#if message.isStarred}
												<span class="star-indicator">⭐</span>
											{/if}
											{#if message.aiAnalysis}
												<span class="ai-indicator">🤖</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{:else if currentView === 'message-detail' && selectedMessage}
					<div class="message-detail-view">
						<div class="view-header">
							<!-- <h3>Message Details</h3> -->
							<button class="back-btn" on:click={() => (currentView = 'messages')}> ← </button>
						</div>

						<div class="message-detail">
							<div class="message-info">
								<div class="info-row">
									<span class="label">From:</span>
									<span class="value">
										{(selectedMessage.from.name
											? selectedMessage.from.name.replace(/^"|"$/g, '')
											: '') || selectedMessage.from.email}
									</span>
									<span class="value secondary">
										{selectedMessage.from.email && selectedMessage.from.name
											? ' (' + selectedMessage.from.email + ')'
											: ''}
									</span>
								</div>
								<div class="info-row">
									<span class="label">To:</span>
									<span class="value">
										{selectedMessage.to
											.map((t) => (t.name ? t.name.replace(/^"|"$/g, '') : '') || t.email)
											.join(', ')}
									</span>
								</div>
								<div class="info-row">
									<span class="label">Subject:</span>
									<span class="value">{selectedMessage.subject}</span>
								</div>
								<div class="info-row">
									<span class="label">Date:</span>
									<span class="value">{formatDate(selectedMessage.date)}</span>
								</div>
							</div>

							{#if selectedMessage.attachments.length > 0}
								<div class="attachments-section">
									<h4>Attachments</h4>
									<div class="attachments-list">
										{#each selectedMessage.attachments as attachment}
											<div class="attachment-item">
												<span class="attachment-name">{attachment.filename}</span>
												<span class="attachment-size">
													{ClientEmailUtils.formatFileSize(attachment.size)}
												</span>
												<button class="download-btn">Download</button>
											</div>
										{/each}
									</div>
								</div>
							{/if}
							{#if selectedMessage.aiAnalysis || isAnalyzing}
								<div class="ai-analysis-section">
									<div class="analysis-header">
										<h4>🤖 AI Analysis</h4>
										{#if isAnalyzing}
											<div class="spinner-container">
												<span class="spinner"></span>
											</div>
										{:else}
											<button class="refresh-analysis-btn" on:click={triggerAIAnalysis}>
												🔄 Re-analyze
											</button>
										{/if}
									</div>

									{#if selectedMessage.aiAnalysis && !isAnalyzing}
										<div class="analysis-content">
											<!-- Summary -->
											<div class="analysis-item">
												<span class="analysis-label">Summary:</span>
												<p class="analysis-summary">{selectedMessage.aiAnalysis.summary}</p>
											</div>

											<!-- Category & Priority -->
											<div class="analysis-meta">
												<span class="category-badge category-{selectedMessage.aiAnalysis.category}">
													{selectedMessage.aiAnalysis.category || 'unknown'}
												</span>
												<span class="priority-badge priority-{selectedMessage.aiAnalysis.priority}">
													{selectedMessage.aiAnalysis.priority || 'medium'} priority
												</span>
											</div>

											<!-- Topics -->
											{#if selectedMessage.aiAnalysis.topics && selectedMessage.aiAnalysis.topics.length > 0}
												<div class="analysis-item">
													<span class="analysis-label">Topics:</span>
													<div class="topics-list">
														{#each selectedMessage.aiAnalysis.topics as topic}
															<span class="topic-tag">{topic}</span>
														{/each}
													</div>
												</div>
											{/if}

											<!-- Action Items -->
											{#if selectedMessage.aiAnalysis.actionItems && selectedMessage.aiAnalysis.actionItems.length > 0}
												<div class="analysis-item">
													<span class="analysis-label">Action Items:</span>
													<ul class="action-items">
														{#each selectedMessage.aiAnalysis.actionItems as item}
															<li>{item}</li>
														{/each}
													</ul>
												</div>
											{/if}

											<!-- Suggested Response -->
											{#if selectedMessage.aiAnalysis.suggestedResponse}
												<div class="analysis-item">
													<span class="analysis-label">Suggested Response:</span>
													<div class="suggested-response">
														<p>{selectedMessage.aiAnalysis.suggestedResponse}</p>
														<button class="use-response-btn">Use This Response</button>
													</div>
												</div>
											{/if}
										</div>
									{:else if isAnalyzing}
										<div class="analyzing-placeholder">
											<div class="spinner-large"></div>
											<p>Analyzing email content...</p>
										</div>
									{/if}
								</div>
							{:else}
								<div class="ai-analysis-prompt">
									<button class="analyze-btn" on:click={triggerAIAnalysis}>
										🤖 Analyze with AI
									</button>
								</div>
							{/if}
							<div class="message-content">
								<!-- Content display based on what's available -->
								{#if contentType === 'html'}
									<div class="content-options">
										<div class="html-content">
											<h4>HTML Version:</h4>
											<div class="email-body">
												{@html sanitizeEmailHtml(emailContent.htmlContent)}
											</div>
										</div>

										<div class="formatted-text-content">
											<h4>Text Version (with formatted links):</h4>
											<div class="formatted-text">
												{@html emailContent.formattedText}
											</div>
										</div>
									</div>
								{:else if contentType === 'text'}
									<div class="formatted-text-content">
										<div class="formatted-text">
											{@html emailContent.formattedText}
										</div>
									</div>
								{:else}
									<div class="empty-content">
										<p>No content available for this message.</p>
									</div>
								{/if}
								<!-- Actual content -->
								<!-- {#if selectedMessage.bodyHtml && selectedMessage.bodyHtml.trim() !== ''}
        <div class="html-content" style="border: 2px solid green; padding: 10px; background: white;">
            <strong>Displaying HTML content:</strong>
            <div class="email-body">
                {@html selectedMessage.bodyHtml}
            </div>
        </div>
    {:else}
        <div class="text-content" style="border: 2px solid red; padding: 10px;">
            <strong>Displaying text content:</strong>
            <pre>{selectedMessage.bodyText}</pre>
        </div>
    {/if} -->
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;

	.modal-overlay {
		position: relative;
		top: 0;
		left: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		margin: 0 2rem;
		z-index: 1000;
		background: transparent;
	}

	.modal-content {
		width: 100%;
		height: 80vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-body {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: calc(100% - 4rem);
	}

	.modal-nav {
		padding: 1rem 1.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: auto;

		.nav-btn {
			background: none;
			border: none;
			color: var(--text-color);
			padding: 0.5rem 1rem;
			border-radius: 0.5rem;
			cursor: pointer;
			transition: all 0.2s ease;
			font-family: var(--font-family);
			font-size: 1rem;

			&:hover {
				background: var(--secondary-color);
			}

			&.active {
				background: var(--tertiary-color);
				color: var(--primary-color);
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		}

		.stats-summary {
			margin-left: 0;
			display: flex;
			gap: 1rem;

			.stat-item {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 0.9rem;

				.stat-label {
					color: var(--placeholder-color);
				}

				.stat-value {
					color: var(--text-color);
					font-weight: 600;
				}
			}
		}
	}

	.error-message {
		background: #ff4444;
		color: white;
		padding: 1rem;
		margin: 1rem 1.5rem;
		border-radius: 6px;
		font-family: var(--font-family);
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
		color: var(--text-color);
		font-family: var(--font-family);

		.spinner {
			width: 24px;
			height: 24px;
			border: 2px solid var(--line-color);
			border-top: 2px solid var(--tertiary-color);
			border-radius: 50%;
			animation: spin 1s linear infinite;
		}
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.content-area {
		flex: 1;
		display: flex;
		width: 100%;
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
	}
	.accounts-view {
		display: flex;
		width: 100%;
	}
	.view-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;

		h3 {
			margin: 0;
			color: var(--text-color);
			font-family: var(--font-family);
			font-size: 1.25rem;
		}

		.add-btn,
		.back-btn {
			background: var(--bg-color);
			color: var(--text-color);
			border: none;
			padding: 0.5rem 1rem;
			border-radius: 0.5rem;
			cursor: pointer;
			font-family: var(--font-family);
			font-size: 1rem;
			transition: all 0.2s ease;
			display: flex;
			width: auto;
			position: absolute;
			left: -1.5rem;
			top: 1rem;
			&:hover {
				opacity: 0.8;
			}
		}

		.back-btn {
			background: var(--secondary-color);
			color: var(--text-color);
		}
	}

	.empty-state {
		height: 50vh !important;
		justify-content: center;
		display: flex;
		flex-direction: column;

		text-align: center;
		padding: 3rem;
		color: var(--placeholder-color);
		font-family: var(--font-family);

		p {
			margin-bottom: 1rem;
			font-size: 1.1rem;
		}

		.primary-btn {
			background: var(--tertiary-color);
			color: var(--primary-color);
			border: none;
			padding: 0.75rem 1.5rem;
			border-radius: 0.5rem;
			width: 100%;
			cursor: pointer;
			font-family: var(--font-family);
			font-size: 1rem;
			transition: all 0.2s ease;

			&:hover {
				opacity: 0.8;
			}
		}
	}

	.accounts-list {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 1rem;
	}

	.account-card {
		border-bottom: 1px solid var(--line-color);
		padding: 1rem 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: auto;
		transition: all 0.2s ease;

		&:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		}

		.account-info {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;

			.account-email {
				color: var(--text-color);
				font-family: var(--font-family);
				font-size: 0.8rem;
				font-weight: 600;
			}

			.account-provider {
				color: var(--placeholder-color);
				font-size: 0.9rem;
				text-transform: capitalize;
			}

			.account-status {
				font-size: 0.8rem;
				padding: 0.25rem 0.5rem;
				border-radius: 4px;
				width: fit-content;

				&.active {
					background: #22c55e;
					color: white;
				}

				&.inactive {
					background: #ef4444;
					color: white;
				}
			}
		}

		.account-actions {
			display: flex;
			gap: 0.5rem;

			.action-btn {
				background: var(--secondary-color);
				color: var(--text-color);
				border: none;
				padding: 0.5rem 1rem;
				border-radius: 6px;
				cursor: pointer;
				font-family: var(--font-family);
				font-size: 0.7rem;
				transition: all 0.2s ease;
				&:hover {
					background: var(--tertiary-color);
					color: var(--primary-color);
				}

				&.danger {
					background: #ef4444;
					color: white;

					&:hover {
						background: #dc2626;
					}
				}
			}
		}
	}

	.add-account-form {
		max-width: 500px;
		margin: 0 auto;

		.form-group {
			display: flex;
			flex-direction: column;
			&.provider {
				justify-content: space-between;
				align-items: center;
				gap: 1rem;
				flex-direction: row !important;
				& select {
					width: 100%;
				}
				& label {
					width: auto;
					display: flex;
					margin: 0;
				}
			}
			margin-bottom: 1.5rem;

			label {
				display: block;
				margin-bottom: 0.5rem;
				color: var(--text-color);
				font-family: var(--font-family);
				font-weight: 600;
			}
			input#email,
			input#authCode {
				width: auto;
				padding: 0.25rem 0.5rem;
			}
			input,
			select {
				padding: 0.25rem 0.5rem;
				border: 1px solid var(--line-color);
				border-radius: 6px;
				background: var(--bg-gradient-t);
				color: var(--text-color);
				font-family: var(--font-family);
				font-size: 0.9rem;
				transition: all 0.2s ease;
				-webkit-appearance: none;
				-moz-appearance: none;
				appearance: none;
				&:focus {
					outline: none;
					border-color: var(--tertiary-color);
					box-shadow: 0 0 0 2px rgba(80, 227, 194, 0.2);
				}

				&::placeholder {
					color: var(--placeholder-color);
				}
			}

			.form-help {
				display: flex;
				width: 100%;
				justify-content: flex-start;
				margin-top: 1rem;
				margin-bottom: 0;
				color: var(--tertiary-color);
				font-size: 0.85rem;
				font-style: italic;
			}
		}

		.form-actions {
			display: flex;
			gap: 1rem;
			justify-content: space-between;

			.secondary-btn,
			.primary-btn {
				padding: 0.75rem 1.5rem;
				border: none;
				border-radius: 6px;
				cursor: pointer;
				font-family: var(--font-family);
				transition: all 0.2s ease;
			}

			.secondary-btn {
				background: var(--secondary-color);
				color: var(--text-color);

				&:hover {
					background: var(--line-color);
				}
			}

			.primary-btn {
				background: var(--tertiary-color);
				color: var(--primary-color);

				&:hover {
					opacity: 0.8;
				}
			}
		}
	}

	.search-filters {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;

		.search-box {
			flex: 1;

			input {
				width: 100%;
				padding: 0.75rem;
				border: 1px solid var(--line-color);
				border-radius: 6px;
				background: var(--bg-color);
				color: var(--text-color);
				font-family: var(--font-family);

				&:focus {
					outline: none;
					border-color: var(--tertiary-color);
				}

				&::placeholder {
					color: var(--placeholder-color);
				}
			}
		}

		.filter-btn {
			background: var(--secondary-color);
			color: var(--text-color);
			border: none;
			padding: 0.75rem 1rem;
			border-radius: 6px;
			cursor: pointer;
			font-family: var(--font-family);
			transition: all 0.2s ease;

			&:hover,
			&.active {
				background: var(--tertiary-color);
				color: var(--primary-color);
			}
		}
	}

	.filters-panel {
		background: var(--bg-gradient);
		border: 1px solid var(--line-color);
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1rem;
		display: flex;
		gap: 1rem;

		.filter-group {
			label {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				color: var(--text-color);
				font-family: var(--font-family);
				cursor: pointer;

				input[type='checkbox'] {
					accent-color: var(--tertiary-color);
				}
			}
		}
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.message-card {
		background: var(--bg-gradient);
		border: 1px solid var(--line-color);
		border-radius: 8px;
		padding: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: var(--secondary-color);
			transform: translateY(-1px);
		}

		&.unread {
			border-left: 4px solid var(--tertiary-color);
		}

		.message-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 0.5rem;

			.message-from {
				color: var(--text-color);
				font-family: var(--font-family);
				font-weight: 600;
			}

			.message-date {
				color: var(--placeholder-color);
				font-size: 0.9rem;
			}
		}

		.message-subject {
			color: var(--text-color);
			font-family: var(--font-family);
			font-weight: 500;
			margin-bottom: 0.5rem;
		}

		.message-snippet {
			color: var(--placeholder-color);
			font-size: 0.9rem;
			line-height: 1.4;
			margin-bottom: 0.5rem;
		}

		.message-meta {
			display: flex;
			gap: 0.5rem;
			font-size: 0.8rem;
		}
	}

	.message-detail {
		margin: 0 auto;

		.message-info {
			padding: 0.5rem;

			.info-row {
				display: flex;
				margin-bottom: 0.75rem;

				.label {
					color: var(--tertiary-color);
					font-weight: 600;
					width: 80px;
					flex-shrink: 0;
				}

				.value {
					color: var(--text-color);
					font-family: var(--font-family);
					padding: 0 0.25rem;
					&.secondary {
						color: var(--placeholder-color);
					}
				}
			}
		}

		.attachments-section {
			background: var(--bg-gradient);
			border: 1px solid var(--line-color);
			border-radius: 8px;
			padding: 1.5rem;
			margin-bottom: 1.5rem;

			h4 {
				color: var(--text-color);
				font-family: var(--font-family);
				margin-bottom: 1rem;
			}

			.attachments-list {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}

			.attachment-item {
				display: flex;
				align-items: center;
				gap: 1rem;
				padding: 0.75rem;
				background: var(--secondary-color);
				border-radius: 6px;

				.attachment-name {
					color: var(--text-color);
					font-family: var(--font-family);
					flex: 1;
				}

				.attachment-size {
					color: var(--placeholder-color);
					font-size: 0.9rem;
				}

				.download-btn {
					background: var(--tertiary-color);
					color: var(--primary-color);
					border: none;
					padding: 0.5rem 1rem;
					border-radius: 4px;
					cursor: pointer;
					font-family: var(--font-family);
					font-size: 0.9rem;
					transition: all 0.2s ease;

					&:hover {
						opacity: 0.8;
					}
				}
			}
		}

		.message-content {
			border-radius: 2rem;
			padding: 0;
			margin-bottom: 1.5rem;
			width: calc(100% - 2rem);

			display: flex;
			position: relative;
			overflow-wrap: break-word;
			.content-options {
				display: flex;
				flex-direction: column;
				width: 100%;
			}

			.html-content,
			.formatted-text-content {
				color: var(--text-color);
				font-family: var(--font-family);
				border-radius: 2rem;
				background: var(--secondary-color);
				line-height: 1.75;
				margin-top: 0.5rem;
				text-overflow: ellipsis;
				font-size: 0.7rem;

				padding: 0.5rem 1rem;
				:global(a) {
					color: var(--tertiary-color);
					border: 1px solid var(--line-color);
					background: var(--primary-color);
					border-radius: 1rem;
					padding: 0 0.5rem;
				}
				& .formatted-text {
					width: auto;
					background-color: var(--secondary-color);
					border-radius: 0 0 2rem 2rem;
					font-size: 0.9rem;
					color: var(--text-color);
				}
				& h4 {
					font-size: 1rem;
					padding: 1rem;
					border-radius: 2rem;
					margin: 0;
				}
			}

			.text-content {
				color: var(--text-color);
				font-family: var(--font-family);
				line-height: 1.6;
				white-space: pre-wrap;
				margin: 0;
			}
		}

		.ai-analysis {
			background: var(--bg-gradient);
			border: 1px solid var(--tertiary-color);
			border-radius: 8px;
			padding: 1.5rem;
			margin-bottom: 1.5rem;

			h4 {
				color: var(--text-color);
				font-family: var(--font-family);
				margin-bottom: 1rem;
			}

			.analysis-content {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}

			.analysis-item {
				display: flex;
				flex-direction: row;
				color: red;
				gap: 0.5rem;

				.analysis-label {
					color: var(--placeholder-color);
					font-weight: 600;
					font-size: 0.9rem;
				}

				.analysis-value {
					color: var(--text-color);
					font-family: var(--font-family);

					&.sentiment-positive {
						color: #22c55e;
					}

					&.sentiment-negative {
						color: #ef4444;
					}

					&.sentiment-neutral {
						color: var(--placeholder-color);
					}

					&.priority-urgent {
						color: #ef4444;
						font-weight: 600;
					}

					&.priority-high {
						color: #f59e0b;
						font-weight: 600;
					}

					&.priority-medium {
						color: #3b82f6;
					}

					&.priority-low {
						color: var(--placeholder-color);
					}
				}

				.analysis-summary,
				.suggested-response {
					color: var(--text-color);
					font-family: var(--font-family);
					line-height: 1.5;
					margin: 0;
				}

				.action-items {
					margin: 0;
					padding-left: 1.5rem;
					color: var(--text-color);
					font-family: var(--font-family);
				}
			}
		}

		.ai-actions {
			text-align: center;
			margin-bottom: 1.5rem;

			.ai-analyze-btn {
				background: var(--tertiary-color);
				color: var(--primary-color);
				border: none;
				padding: 0.75rem 1.5rem;
				border-radius: 6px;
				cursor: pointer;
				font-family: var(--font-family);
				font-size: 1rem;
				transition: all 0.2s ease;

				&:hover {
					opacity: 0.8;
				}
			}
		}
	}
	.email-body {
	}
	.email-body :global(div[style*='display:auto']) {
		display: none !important;
	}

	.email-body :global(img[style*='display:none']) {
		display: none !important;
	}

	/* Make sure visible content shows up */
	.email-body :global(table) {
		max-width: 100% !important;
		width: auto !important;
		display: table !important;
	}

	.email-body :global(td) {
		display: table-cell !important;
		vertical-align: top;
	}

	.email-body :global(tr) {
		display: table-row !important;
	}

	.email-body :global(img) {
		max-width: 100% !important;
		height: auto !important;
	}

	/* Override any background colors that might hide content */
	.email-body :global(body) {
		background: white !important;
		color: #333 !important;
	}

	.text-content {
		white-space: pre-wrap;
		font-family: monospace;
		margin: 0;
		padding: 16px;
		background: #f8f9fa;
		border-radius: 4px;
		overflow-x: auto;
		min-height: 50px; /* Ensure we can see if content is there */
	}
	.ai-analysis-section {
		margin-top: 1rem;
		padding: 1rem;
		background: var(--bg-gradient-r);
		border: 1px solid var(--line-color);
		border-radius: 12px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 1rem;
	}

	.analyze-btn,
	.refresh-analysis-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 50px;
		font-size: 0.85rem;
		font-weight: 800;
		border-radius: 1rem;
		color: var(--tertiary-color);
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid var(--line-color) !important;
		background: var(--bg-gradient-right);
	}
	.analysis-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		color: var(--placeholder-color);
	}
	.analysis-item {
		display: flex;
		flex-direction: column;
		color: var(--text-color);
		gap: 0.5rem;
	}
	.analysis-summary {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
	}
	.analysis-label {
		color: var(--placeholder-color);
		font-weight: 600;
		font-size: 0.9rem;
	}

	.analysis-value {
		color: var(--text-color);
		font-family: var(--font-family);

		&.sentiment-positive {
			color: #22c55e;
		}

		&.sentiment-negative {
			color: #ef4444;
		}

		&.sentiment-neutral {
			color: var(--placeholder-color);
		}

		&.priority-urgent {
			color: #ef4444;
			font-weight: 600;
		}

		&.priority-high {
			color: #f59e0b;
			font-weight: 600;
		}

		&.priority-medium {
			color: #3b82f6;
		}

		&.priority-low {
			color: var(--placeholder-color);
		}
	}

	.analysis-summary,
	.suggested-response {
		color: var(--text-color);
		font-family: var(--font-family);
		line-height: 1.5;
		margin: 0;
	}
	@media (max-width: 768px) {
		.modal-nav {
			flex-direction: column;
			gap: 0.5rem;
			align-items: stretch;

			.stats-summary {
				margin-left: 0;
				justify-content: center;
			}
		}

		.account-card {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;

			.account-actions {
				justify-content: center;
			}
		}

		.search-filters {
			flex-direction: column;
		}

		.filters-panel {
			flex-direction: column;
		}

		.message-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.message-detail .info-row {
			flex-direction: column;
			gap: 0.25rem;
		}

		.attachment-item {
			flex-direction: column;
			align-items: stretch;
			text-align: center;
		}
	}
</style>
