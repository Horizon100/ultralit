import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type {
	LedgerAccount,
	Transaction,
	LedgerApiResponse,
	AccountFormData,
	TransactionFormData
} from '$lib/types/types.ledger';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		const type = url.searchParams.get('type');
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '20');

		switch (type) {
			case 'accounts':
				return await getAccounts(locals.user.id, page, limit);
			case 'transactions':
				return await getTransactions(locals.user.id, page, limit, url.searchParams);
			default:
				return json({ success: false, message: 'Invalid type parameter' }, { status: 400 });
		}
	} catch (error) {
		console.error('Ledger API error:', error);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { type, data } = body;

		switch (type) {
			case 'account':
				return await createAccount(data, locals.user.id);
			case 'transaction':
				return await createTransaction(data, locals.user.id);
			default:
				return json({ success: false, message: 'Invalid type' }, { status: 400 });
		}
	} catch (error) {
		console.error('Ledger API error:', error);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { type, id, data } = body;

		switch (type) {
			case 'account':
				return await updateAccount(id, data, locals.user.id);
			case 'transaction':
				return await updateTransaction(id, data, locals.user.id);
			default:
				return json({ success: false, message: 'Invalid type' }, { status: 400 });
		}
	} catch (error) {
		console.error('Ledger API error:', error);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { type, id } = body;

		switch (type) {
			case 'account':
				return await deleteAccount(id, locals.user.id);
			case 'transaction':
				return await deleteTransaction(id, locals.user.id);
			default:
				return json({ success: false, message: 'Invalid type' }, { status: 400 });
		}
	} catch (error) {
		console.error('Ledger API error:', error);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};

// Helper functions
async function getAccounts(userId: string, page: number, limit: number): Promise<Response> {
	try {
		const accounts = await pb.collection('ledger_accounts').getList(page, limit, {
			filter: `userId = "${userId}"`,
			sort: '-created'
		});

		const response: LedgerApiResponse<LedgerAccount[]> = {
			success: true,
			data: accounts.items as LedgerAccount[],
			total: accounts.totalItems,
			page: accounts.page,
			limit: accounts.perPage
		};

		return json(response);
	} catch (error) {
		console.error('Error fetching accounts:', error);
		return json({ success: false, message: 'Failed to fetch accounts' }, { status: 500 });
	}
}

async function getTransactions(
	userId: string,
	page: number,
	limit: number,
	searchParams: URLSearchParams
): Promise<Response> {
	try {
		let filter = `userId = "${userId}"`;

		// Add filters based on search parameters
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');
		const type = searchParams.get('transactionType');
		const status = searchParams.get('status');
		const accountId = searchParams.get('accountId');
		const search = searchParams.get('search');

		if (startDate) {
			filter += ` && date >= "${startDate}"`;
		}
		if (endDate) {
			filter += ` && date <= "${endDate}"`;
		}
		if (type) {
			filter += ` && type = "${type}"`;
		}
		if (status) {
			filter += ` && status = "${status}"`;
		}
		if (accountId) {
			filter += ` && accountId = "${accountId}"`;
		}
		if (search) {
			filter += ` && (description ~ "${search}" || reference ~ "${search}")`;
		}

		const transactions = await pb.collection('ledger_transactions').getList(page, limit, {
			filter,
			sort: '-date',
			expand: 'accountId,categoryId,contactId'
		});

		const response: LedgerApiResponse<Transaction[]> = {
			success: true,
			data: transactions.items as Transaction[],
			total: transactions.totalItems,
			page: transactions.page,
			limit: transactions.perPage
		};

		return json(response);
	} catch (error) {
		console.error('Error fetching transactions:', error);
		return json({ success: false, message: 'Failed to fetch transactions' }, { status: 500 });
	}
}

async function createAccount(data: AccountFormData, userId: string): Promise<Response> {
	try {
		const accountData = {
			...data,
			userId,
			balance: data.initialBalance || 0,
			currency: data.currency || 'USD',
			isActive: true
		};

		const account = await pb.collection('ledger_accounts').create(accountData);

		const response: LedgerApiResponse<LedgerAccount> = {
			success: true,
			data: account as LedgerAccount,
			message: 'Account created successfully'
		};

		return json(response);
	} catch (error) {
		console.error('Error creating account:', error);
		return json({ success: false, message: 'Failed to create account' }, { status: 500 });
	}
}

async function createTransaction(data: TransactionFormData, userId: string): Promise<Response> {
	try {
		const transactionData = {
			...data,
			userId,
			currency: 'USD', // Default currency, should be configurable
			created: new Date().toISOString(),
			updated: new Date().toISOString()
		};

		const transaction = await pb.collection('ledger_transactions').create(transactionData);

		// Update account balance
		await updateAccountBalance(data.accountId, data.amount, data.type);

		const response: LedgerApiResponse<Transaction> = {
			success: true,
			data: transaction as Transaction,
			message: 'Transaction created successfully'
		};

		return json(response);
	} catch (error) {
		console.error('Error creating transaction:', error);
		return json({ success: false, message: 'Failed to create transaction' }, { status: 500 });
	}
}

async function updateAccount(
	id: string,
	data: Partial<AccountFormData>,
	userId: string
): Promise<Response> {
	try {
		// Verify ownership
		const existingAccount = await pb.collection('ledger_accounts').getOne(id);
		if (existingAccount.userId !== userId) {
			return json({ success: false, message: 'Unauthorized' }, { status: 403 });
		}

		const account = await pb.collection('ledger_accounts').update(id, {
			...data,
			updated: new Date().toISOString()
		});

		const response: LedgerApiResponse<LedgerAccount> = {
			success: true,
			data: account as LedgerAccount,
			message: 'Account updated successfully'
		};

		return json(response);
	} catch (error) {
		console.error('Error updating account:', error);
		return json({ success: false, message: 'Failed to update account' }, { status: 500 });
	}
}

async function updateTransaction(
	id: string,
	data: Partial<TransactionFormData>,
	userId: string
): Promise<Response> {
	try {
		// Verify ownership
		const existingTransaction = await pb.collection('ledger_transactions').getOne(id);
		if (existingTransaction.userId !== userId) {
			return json({ success: false, message: 'Unauthorized' }, { status: 403 });
		}

		// If amount or type changed, need to revert old balance and apply new
		if (data.amount !== undefined || data.type !== undefined) {
			// Revert previous transaction effect
			await updateAccountBalance(
				existingTransaction.accountId,
				-existingTransaction.amount,
				existingTransaction.type
			);

			// Apply new transaction effect
			await updateAccountBalance(
				data.accountId || existingTransaction.accountId,
				data.amount || existingTransaction.amount,
				data.type || existingTransaction.type
			);
		}

		const transaction = await pb.collection('ledger_transactions').update(id, {
			...data,
			updated: new Date().toISOString()
		});

		const response: LedgerApiResponse<Transaction> = {
			success: true,
			data: transaction as Transaction,
			message: 'Transaction updated successfully'
		};

		return json(response);
	} catch (error) {
		console.error('Error updating transaction:', error);
		return json({ success: false, message: 'Failed to update transaction' }, { status: 500 });
	}
}

async function deleteAccount(id: string, userId: string): Promise<Response> {
	try {
		// Verify ownership
		const account = await pb.collection('ledger_accounts').getOne(id);
		if (account.userId !== userId) {
			return json({ success: false, message: 'Unauthorized' }, { status: 403 });
		}

		// Check if account has transactions
		const transactions = await pb.collection('ledger_transactions').getList(1, 1, {
			filter: `accountId = "${id}"`
		});

		if (transactions.totalItems > 0) {
			return json(
				{
					success: false,
					message: 'Cannot delete account with existing transactions'
				},
				{ status: 400 }
			);
		}

		await pb.collection('ledger_accounts').delete(id);

		return json({
			success: true,
			message: 'Account deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting account:', error);
		return json({ success: false, message: 'Failed to delete account' }, { status: 500 });
	}
}

async function deleteTransaction(id: string, userId: string): Promise<Response> {
	try {
		// Verify ownership
		const transaction = await pb.collection('ledger_transactions').getOne(id);
		if (transaction.userId !== userId) {
			return json({ success: false, message: 'Unauthorized' }, { status: 403 });
		}

		// Revert transaction effect on account balance
		await updateAccountBalance(transaction.accountId, -transaction.amount, transaction.type);

		await pb.collection('ledger_transactions').delete(id);

		return json({
			success: true,
			message: 'Transaction deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting transaction:', error);
		return json({ success: false, message: 'Failed to delete transaction' }, { status: 500 });
	}
}

async function updateAccountBalance(
	accountId: string,
	amount: number,
	type: string
): Promise<void> {
	try {
		const account = await pb.collection('ledger_accounts').getOne(accountId);
		let balanceChange = 0;

		// Calculate balance change based on account type and transaction type
		switch (account.type) {
			case 'asset':
				balanceChange = type === 'income' ? amount : -amount;
				break;
			case 'liability':
				balanceChange = type === 'expense' ? -amount : amount;
				break;
			case 'equity':
				balanceChange = type === 'income' ? amount : -amount;
				break;
			case 'revenue':
				balanceChange = type === 'income' ? amount : -amount;
				break;
			case 'expense':
				balanceChange = type === 'expense' ? amount : -amount;
				break;
		}

		await pb.collection('ledger_accounts').update(accountId, {
			balance: account.balance + balanceChange,
			updated: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error updating account balance:', error);
		throw error;
	}
}
