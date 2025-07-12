<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { LedgerAccount, Transaction, LedgerOverview } from '$lib/types/types.ledger';

	let overview: LedgerOverview = {
		accountsPayable: 0,
		accountsReceivable: 0,
		totalExpenses: 0,
		totalIncome: 0,
		netBalance: 0
	};

	let recentTransactions: Transaction[] = [];
	let accounts: LedgerAccount[] = [];
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		await loadLedgerData();
		loading = false;
	});

	async function loadLedgerData() {
		try {
			const response = await fetch('/api/ledger/overview');
			if (response.ok) {
				const data = await response.json();
				console.log('📊 Ledger data received:', data);

				if (data.success && data.data) {
					overview = data.data.overview || overview;
					recentTransactions = data.data.recentTransactions || [];
					accounts = data.data.accounts || [];
					error = null;
				} else {
					error = data.message || 'Failed to load ledger data';
					console.error('❌ API returned error:', data);
				}
			} else {
				error = `HTTP ${response.status}: ${response.statusText}`;
				console.error('❌ HTTP error:', error);
			}
		} catch (err) {
			error = 'Network error - please check your connection';
			console.error('❌ Network error:', err);
		}
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'paid':
				return 'var(--tertiary-color)';
			case 'pending':
				return '#ffa500';
			case 'overdue':
				return '#ff4444';
			default:
				return 'var(--text-color)';
		}
	}
</script>

<div class="ledger-container">
	<header class="ledger-header">
		<div class="header-content">
			<h1>Ledger</h1>
			<p>A comprehensive accounting interface to manage your finances with AI-powered analysis</p>
		</div>
		<div class="header-actions">
			<button class="btn-primary">Create Transaction</button>
			<button class="btn-secondary">Upload Statement</button>
		</div>
	</header>

	{#if loading}
		<div class="loading-spinner">
			<div class="spinner"></div>
			<p>Loading ledger data...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<div class="error-icon">
				<svg
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
					<path d="M15 9L9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					<path d="M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg>
			</div>
			<h3>Unable to load ledger data</h3>
			<p>{error}</p>
			<div class="error-actions">
				<button class="btn-primary" on:click={loadLedgerData}>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M1 4V10H7"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M23 20V14H17"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					Retry
				</button>
				<button class="btn-secondary" on:click={() => (error = null)}> Continue anyway </button>
			</div>
			<div class="setup-info">
				<h4>🔧 Setup Required</h4>
				<p>If this is your first time, you need to create PocketBase collections:</p>
				<ul>
					<li><code>ledger_accounts</code></li>
					<li><code>ledger_categories</code></li>
					<li><code>ledger_transactions</code></li>
				</ul>
				<p>
					Visit your <a href="http://100.87.185.104:8090/_/" target="_blank"
						>PocketBase Admin Panel</a
					> to set up collections.
				</p>
			</div>
		</div>
	{:else}
		<div class="overview-cards">
			<div class="card">
				<div class="card-icon accounts-payable">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 2L2 7L12 12L22 7L12 2Z"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
						/>
						<path
							d="M2 17L12 22L22 17"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
						/>
						<path
							d="M2 12L12 17L22 12"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
				<div class="card-content">
					<h3>{formatCurrency(overview.accountsPayable)}</h3>
					<p>Accounts Payable</p>
				</div>
			</div>

			<div class="card">
				<div class="card-icon accounts-receivable">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 2L2 7L12 12L22 7L12 2Z"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
						/>
						<path
							d="M2 17L12 22L22 17"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
						/>
						<path
							d="M2 12L12 17L22 12"
							stroke="currentColor"
							stroke-width="2"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
				<div class="card-content">
					<h3>{formatCurrency(overview.accountsReceivable)}</h3>
					<p>Accounts Receivable</p>
				</div>
			</div>

			<div class="card">
				<div class="card-icon expenses">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M17 11L12 6L7 11"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M12 18V6"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
				<div class="card-content">
					<h3>{formatCurrency(overview.totalExpenses)}</h3>
					<p>Total Expenses</p>
				</div>
			</div>

			<div class="card">
				<div class="card-icon income">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M7 13L12 18L17 13"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M12 6V18"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
				<div class="card-content">
					<h3>{formatCurrency(overview.totalIncome)}</h3>
					<p>Total Income</p>
				</div>
			</div>
		</div>

		<div class="content-grid">
			<section class="transactions-section">
				<div class="section-header">
					<h2>Recent Transactions</h2>
					<div class="section-actions">
						<button class="btn-filter">
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							Filter
						</button>
						<button class="btn-export">
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M21 15V19A2 2 0 0119 21H5A2 2 0 013 19V15"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M7 10L12 15L17 10"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M12 15V3"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							Export
						</button>
					</div>
				</div>

				<div class="transactions-table">
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Type</th>
								<th>Amount</th>
								<th>Account</th>
								<th>Description</th>
								<th>Status</th>
								<th>Action</th>
							</tr>
						</thead>
						<tbody>
							{#each recentTransactions as transaction}
								<tr>
									<td>{new Date(transaction.date).toLocaleDateString()}</td>
									<td>
										<span class="transaction-type {transaction.type}">
											{transaction.type}
										</span>
									</td>
									<td class="amount {transaction.type === 'expense' ? 'negative' : 'positive'}">
										{formatCurrency(transaction.amount)}
									</td>
									<td>{transaction.account}</td>
									<td>{transaction.description}</td>
									<td>
										<span class="status-badge" style="color: {getStatusColor(transaction.status)}">
											{transaction.status}
										</span>
									</td>
									<td>
										<button class="btn-action">
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<circle cx="12" cy="12" r="1" stroke="currentColor" stroke-width="2" />
												<circle cx="12" cy="5" r="1" stroke="currentColor" stroke-width="2" />
												<circle cx="12" cy="19" r="1" stroke="currentColor" stroke-width="2" />
											</svg>
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="pagination">
					<button class="btn-pagination">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M15 18L9 12L15 6"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					<span class="page-indicator">1</span>
					<span class="page-indicator">2</span>
					<span class="page-indicator active">3</span>
					<span class="page-indicator">4</span>
					<span class="page-indicator">5</span>
					<button class="btn-pagination">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M9 18L15 12L9 6"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
				</div>
			</section>
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.ledger-container {
		min-height: 100vh;
		background: var(--bg-gradient);
		color: var(--text-color);
		font-family: var(--font-family);
		padding: 2rem;
	}

	.ledger-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 3rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--line-color);

		.header-content {
			h1 {
				font-size: 2.5rem;
				font-weight: 700;
				margin: 0 0 0.5rem 0;
				color: var(--tertiary-color);
			}

			p {
				font-size: 1.1rem;
				color: var(--placeholder-color);
				margin: 0;
				max-width: 600px;
			}
		}

		.header-actions {
			display: flex;
			gap: 1rem;
		}
	}

	.loading-spinner {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 400px;
		gap: 1rem;

		.spinner {
			width: 40px;
			height: 40px;
			border: 3px solid var(--line-color);
			border-top: 3px solid var(--tertiary-color);
			border-radius: 50%;
			animation: spin 1s linear infinite;
		}

		p {
			color: var(--placeholder-color);
			margin: 0;
		}
	}

	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		text-align: center;
		max-width: 600px;
		margin: 0 auto;

		.error-icon {
			color: #ff6b6b;
			margin-bottom: 1rem;
		}

		h3 {
			margin: 0 0 1rem 0;
			font-size: 1.5rem;
			color: var(--text-color);
		}

		p {
			color: var(--placeholder-color);
			margin-bottom: 2rem;
			line-height: 1.5;
		}

		.error-actions {
			display: flex;
			gap: 1rem;
			margin-bottom: 2rem;
		}

		.setup-info {
			background: var(--secondary-color);
			border: 1px solid var(--line-color);
			border-radius: 8px;
			padding: 1.5rem;
			text-align: left;
			width: 100%;

			h4 {
				margin: 0 0 1rem 0;
				color: var(--tertiary-color);
			}

			p {
				margin-bottom: 1rem;
				color: var(--text-color);
			}

			ul {
				margin: 1rem 0;
				padding-left: 1.5rem;

				li {
					margin-bottom: 0.5rem;
					color: var(--text-color);

					code {
						background: var(--primary-color);
						padding: 0.2rem 0.4rem;
						border-radius: 4px;
						font-family: monospace;
						color: var(--tertiary-color);
					}
				}
			}

			a {
				color: var(--tertiary-color);
				text-decoration: none;

				&:hover {
					text-decoration: underline;
				}
			}
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

	.overview-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-bottom: 3rem;

		.card {
			background: var(--bg-gradient-r);
			border: 1px solid var(--line-color);
			border-radius: 12px;
			padding: 2rem;
			display: flex;
			align-items: center;
			gap: 1.5rem;
			transition: all 0.3s ease;

			&:hover {
				transform: translateY(-4px);
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
			}

			.card-icon {
				width: 60px;
				height: 60px;
				border-radius: 12px;
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;

				&.accounts-payable {
					background: linear-gradient(135deg, #ff6b6b, #ee5a52);
				}

				&.accounts-receivable {
					background: linear-gradient(135deg, #4ecdc4, #44a08d);
				}

				&.expenses {
					background: linear-gradient(135deg, #ffa726, #fb8c00);
				}

				&.income {
					background: linear-gradient(135deg, var(--tertiary-color), #3dd5b3);
				}

				svg {
					color: white;
				}
			}

			.card-content {
				h3 {
					font-size: 1.8rem;
					font-weight: 700;
					margin: 0 0 0.5rem 0;
				}

				p {
					color: var(--placeholder-color);
					margin: 0;
					font-size: 0.9rem;
				}
			}
		}
	}

	.content-grid {
		display: grid;
		gap: 2rem;
	}

	.transactions-section {
		background: var(--bg-gradient-r);
		border: 1px solid var(--line-color);
		border-radius: 12px;
		padding: 2rem;

		.section-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 2rem;

			h2 {
				font-size: 1.5rem;
				font-weight: 600;
				margin: 0;
			}

			.section-actions {
				display: flex;
				gap: 1rem;
			}
		}

		.transactions-table {
			overflow-x: auto;
			border-radius: 8px;
			border: 1px solid var(--line-color);

			table {
				width: 100%;
				border-collapse: collapse;

				thead {
					background: var(--primary-color);

					th {
						padding: 1rem;
						text-align: left;
						font-weight: 600;
						color: var(--text-color);
						border-bottom: 1px solid var(--line-color);
					}
				}

				tbody {
					tr {
						transition: background-color 0.2s ease;

						&:hover {
							background: var(--secondary-color);
						}

						td {
							padding: 1rem;
							border-bottom: 1px solid var(--line-color);

							&.amount {
								font-weight: 600;

								&.positive {
									color: var(--tertiary-color);
								}

								&.negative {
									color: #ff6b6b;
								}
							}
						}
					}
				}
			}
		}

		.pagination {
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 0.5rem;
			margin-top: 2rem;

			.page-indicator {
				padding: 0.5rem 1rem;
				border-radius: 6px;
				cursor: pointer;
				transition: all 0.2s ease;

				&.active {
					background: var(--tertiary-color);
					color: var(--primary-color);
				}

				&:hover:not(.active) {
					background: var(--secondary-color);
				}
			}
		}
	}

	.transaction-type {
		padding: 0.25rem 0.75rem;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 500;
		text-transform: capitalize;

		&.income {
			background: rgba(80, 227, 194, 0.2);
			color: var(--tertiary-color);
		}

		&.expense {
			background: rgba(255, 107, 107, 0.2);
			color: #ff6b6b;
		}

		&.transfer {
			background: rgba(255, 167, 38, 0.2);
			color: #ffa726;
		}
	}

	.status-badge {
		font-weight: 500;
		text-transform: capitalize;
	}

	// Button Styles
	.btn-primary {
		background: var(--tertiary-color);
		color: var(--primary-color);
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: #3dd5b3;
			transform: translateY(-2px);
		}
	}

	.btn-secondary {
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--line-color);
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: var(--secondary-color);
			transform: translateY(-2px);
		}
	}

	.btn-filter,
	.btn-export {
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--line-color);
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;

		&:hover {
			background: var(--secondary-color);
		}
	}

	.btn-action {
		background: transparent;
		color: var(--placeholder-color);
		border: none;
		padding: 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: var(--secondary-color);
			color: var(--text-color);
		}
	}

	.btn-pagination {
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--line-color);
		padding: 0.5rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: var(--secondary-color);
		}
	}

	@media (max-width: 768px) {
		.ledger-container {
			padding: 1rem;
		}

		.ledger-header {
			flex-direction: column;
			gap: 1.5rem;
			align-items: flex-start;

			.header-actions {
				width: 100%;
				justify-content: flex-start;
			}
		}

		.overview-cards {
			grid-template-columns: 1fr;
		}

		.section-header {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start !important;

			.section-actions {
				width: 100%;
				justify-content: flex-start;
			}
		}
	}
</style>
