<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type {
		TransactionFormData,
		LedgerAccount,
		Category,
		Contact
	} from '$lib/types/types.ledger';
	import {
		validateTransaction,
		generateTransactionReference
	} from '$lib/features/ledger/utils/ledgerUtils';

	export let accounts: LedgerAccount[] = [];
	export let categories: Category[] = [];
	export let contacts: Contact[] = [];
	export let isEditing: boolean = false;
	export let initialData: Partial<TransactionFormData> | null = null;

	const dispatch = createEventDispatcher<{
		submit: TransactionFormData;
		cancel: void;
	}>();

	let formData: TransactionFormData = {
		date: new Date().toISOString().split('T')[0],
		type: 'expense',
		amount: 0,
		accountId: '',
		categoryId: '',
		description: '',
		reference: '',
		contactId: '',
		status: 'paid',
		paymentMethod: '',
		tags: [],
		attachments: []
	};

	let errors: string[] = [];
	let isSubmitting = false;

	// Filter categories based on selected type
	$: filteredCategories = categories.filter((cat) => cat.type === formData.type);
	$: filteredContacts = contacts.filter((contact) =>
		formData.type === 'income'
			? ['customer', 'other'].includes(contact.type)
			: ['vendor', 'employee', 'other'].includes(contact.type)
	);

	// Initialize form data if editing
	if (initialData && isEditing) {
		formData = { ...formData, ...initialData };
	}

	function generateReference() {
		formData.reference = generateTransactionReference(formData.type);
	}

	function handleSubmit() {
		errors = validateTransaction(formData);

		if (errors.length > 0) {
			return;
		}

		isSubmitting = true;
		dispatch('submit', formData);
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files) {
			formData.attachments = Array.from(target.files);
		}
	}

	function addTag() {
		const tagInput = document.getElementById('tagInput') as HTMLInputElement;
		const tag = tagInput.value.trim();

		if (tag) {
			if (!formData.tags) {
				formData.tags = [];
			}

			if (!formData.tags.includes(tag)) {
				formData.tags = [...formData.tags, tag];
				tagInput.value = '';
			}
		}
	}
	function removeTag(tagToRemove: string) {
		if (formData.tags) {
			formData.tags = formData.tags.filter((tag) => tag !== tagToRemove);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addTag();
		}
	}
</script>

<div class="transaction-form-overlay">
	<div class="transaction-form">
		<div class="form-header">
			<h2>{isEditing ? 'Edit Transaction' : 'Create New Transaction'}</h2>
			<button class="close-btn" on:click={handleCancel}>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M18 6L6 18"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M6 6L18 18"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>

		{#if errors.length > 0}
			<div class="error-banner">
				<ul>
					{#each errors as error}
						<li>{error}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<form on:submit|preventDefault={handleSubmit}>
			<div class="form-grid">
				<div class="form-group">
					<label for="date">Date</label>
					<input id="date" type="date" bind:value={formData.date} required />
				</div>

				<div class="form-group">
					<label for="type">Type</label>
					<select id="type" bind:value={formData.type} required>
						<option value="income">Income</option>
						<option value="expense">Expense</option>
						<option value="transfer">Transfer</option>
					</select>
				</div>

				<div class="form-group">
					<label for="amount">Amount</label>
					<input
						id="amount"
						type="number"
						step="0.01"
						min="0"
						bind:value={formData.amount}
						placeholder="0.00"
						required
					/>
				</div>

				<div class="form-group">
					<label for="status">Status</label>
					<select id="status" bind:value={formData.status} required>
						<option value="paid">Paid</option>
						<option value="pending">Pending</option>
						<option value="overdue">Overdue</option>
					</select>
				</div>

				<div class="form-group">
					<label for="account">Account</label>
					<select id="account" bind:value={formData.accountId} required>
						<option value="">Select an account</option>
						{#each accounts as account}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="category">Category</label>
					<select id="category" bind:value={formData.categoryId}>
						<option value="">Select a category</option>
						{#each filteredCategories as category}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group full-width">
					<label for="description">Description</label>
					<input
						id="description"
						type="text"
						bind:value={formData.description}
						placeholder="Enter transaction description"
						required
					/>
				</div>

				<div class="form-group">
					<label for="reference">Reference</label>
					<div class="reference-input">
						<input
							id="reference"
							type="text"
							bind:value={formData.reference}
							placeholder="Transaction reference"
						/>
						<button type="button" class="generate-btn" on:click={generateReference}>
							Generate
						</button>
					</div>
				</div>

				<div class="form-group">
					<label for="contact">Contact</label>
					<select id="contact" bind:value={formData.contactId}>
						<option value="">Select a contact</option>
						{#each filteredContacts as contact}
							<option value={contact.id}>{contact.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="paymentMethod">Payment Method</label>
					<input
						id="paymentMethod"
						type="text"
						bind:value={formData.paymentMethod}
						placeholder="Cash, Card, Bank Transfer, etc."
					/>
				</div>

				<div class="form-group full-width">
					<label for="tags">Tags</label>
					<div class="tags-input">
						<div class="tags-container">
							{#each formData.tags || [] as tag}
								<span class="tag">
									{tag}
									<button type="button" on:click={() => removeTag(tag)}>×</button>
								</span>
							{/each}
							<input
								id="tagInput"
								type="text"
								placeholder="Add tag and press Enter"
								on:keydown={handleKeydown}
							/>
						</div>
						<button type="button" class="add-tag-btn" on:click={addTag}> Add Tag </button>
					</div>
				</div>

				<div class="form-group full-width">
					<label for="attachments">Attachments</label>
					<input
						id="attachments"
						type="file"
						multiple
						accept="image/*,.pdf,.csv,.xlsx"
						on:change={handleFileChange}
					/>
					<small>Supported formats: Images, PDF, CSV, Excel</small>
				</div>
			</div>

			<div class="form-actions">
				<button type="button" class="btn-secondary" on:click={handleCancel}> Cancel </button>
				<button type="submit" class="btn-primary" disabled={isSubmitting}>
					{#if isSubmitting}
						Processing...
					{:else if isEditing}
						Update Transaction
					{:else}
						Create Transaction
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;

	.transaction-form-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.transaction-form {
		background: var(--bg-gradient);
		border: 1px solid var(--line-color);
		border-radius: 12px;
		width: 100%;
		max-width: 800px;
		max-height: 90vh;
		overflow-y: auto;
		color: var(--text-color);
		font-family: var(--font-family);
	}

	.form-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 2rem 2rem 1rem 2rem;
		border-bottom: 1px solid var(--line-color);

		h2 {
			margin: 0;
			font-size: 1.5rem;
			font-weight: 600;
		}

		.close-btn {
			background: transparent;
			border: none;
			color: var(--placeholder-color);
			cursor: pointer;
			padding: 0.5rem;
			border-radius: 6px;
			transition: all 0.2s ease;

			&:hover {
				background: var(--secondary-color);
				color: var(--text-color);
			}
		}
	}

	.error-banner {
		background: rgba(255, 107, 107, 0.1);
		border: 1px solid #ff6b6b;
		border-radius: 8px;
		padding: 1rem;
		margin: 1rem 2rem;

		ul {
			margin: 0;
			padding-left: 1.5rem;
			color: #ff6b6b;

			li {
				margin-bottom: 0.5rem;

				&:last-child {
					margin-bottom: 0;
				}
			}
		}
	}

	form {
		padding: 2rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;

		&.full-width {
			grid-column: 1 / -1;
		}

		label {
			font-weight: 600;
			margin-bottom: 0.5rem;
			color: var(--text-color);
		}

		input,
		select {
			background: var(--secondary-color);
			border: 1px solid var(--line-color);
			border-radius: 6px;
			padding: 0.75rem;
			color: var(--text-color);
			font-family: var(--font-family);
			transition: border-color 0.2s ease;

			&:focus {
				outline: none;
				border-color: var(--tertiary-color);
			}

			&::placeholder {
				color: var(--placeholder-color);
			}
		}

		small {
			margin-top: 0.5rem;
			color: var(--placeholder-color);
			font-size: 0.85rem;
		}
	}

	.reference-input {
		display: flex;
		gap: 0.5rem;

		input {
			flex: 1;
		}

		.generate-btn {
			background: var(--tertiary-color);
			color: var(--primary-color);
			border: none;
			padding: 0.75rem 1rem;
			border-radius: 6px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.2s ease;
			white-space: nowrap;

			&:hover {
				background: #3dd5b3;
			}
		}
	}

	.tags-input {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		.tags-container {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			align-items: center;
			background: var(--secondary-color);
			border: 1px solid var(--line-color);
			border-radius: 6px;
			padding: 0.5rem;
			min-height: 2.5rem;

			input {
				border: none;
				background: transparent;
				flex: 1;
				min-width: 120px;
				padding: 0.25rem;

				&:focus {
					outline: none;
				}
			}
		}

		.tag {
			display: inline-flex;
			align-items: center;
			background: var(--tertiary-color);
			color: var(--primary-color);
			padding: 0.25rem 0.5rem;
			border-radius: 20px;
			font-size: 0.85rem;
			font-weight: 500;

			button {
				background: none;
				border: none;
				color: var(--primary-color);
				margin-left: 0.25rem;
				cursor: pointer;
				font-weight: bold;
				line-height: 1;

				&:hover {
					opacity: 0.7;
				}
			}
		}

		.add-tag-btn {
			align-self: flex-start;
			background: transparent;
			color: var(--tertiary-color);
			border: 1px solid var(--tertiary-color);
			padding: 0.5rem 1rem;
			border-radius: 6px;
			font-size: 0.85rem;
			cursor: pointer;
			transition: all 0.2s ease;

			&:hover {
				background: var(--tertiary-color);
				color: var(--primary-color);
			}
		}
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		padding-top: 2rem;
		border-top: 1px solid var(--line-color);
	}

	.btn-primary {
		background: var(--tertiary-color);
		color: var(--primary-color);
		border: none;
		padding: 0.75rem 2rem;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover:not(:disabled) {
			background: #3dd5b3;
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	}

	.btn-secondary {
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--line-color);
		padding: 0.75rem 2rem;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: var(--secondary-color);
		}
	}

	@media (max-width: 768px) {
		.transaction-form-overlay {
			padding: 0.5rem;
		}

		.transaction-form {
			max-height: 95vh;
		}

		.form-header {
			padding: 1.5rem 1.5rem 1rem 1.5rem;
		}

		form {
			padding: 1.5rem;
		}

		.form-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.form-actions {
			flex-direction: column-reverse;

			button {
				width: 100%;
			}
		}

		.reference-input {
			flex-direction: column;

			.generate-btn {
				align-self: flex-start;
			}
		}
	}
</style>
