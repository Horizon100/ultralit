import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type {
	LedgerDashboardData,
	LedgerOverview,
	Transaction,
	LedgerAccount,
	MonthlyTrend
} from '$lib/types/types.ledger';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		const userId = locals.user.id;

		// Get overview data
		const overview = await getLedgerOverview(userId);
		const recentTransactions = await getRecentTransactions(userId);
		const accounts = await getActiveAccounts(userId);
		const monthlyTrends = await getMonthlyTrends(userId);

		const dashboardData: LedgerDashboardData = {
			overview,
			recentTransactions,
			accounts,
			upcomingBills: [], // Will implement this later
			monthlyTrends
		};

		return json({
			success: true,
			data: dashboardData
		});
	} catch (error) {
		console.error('Overview API error:', error);
		return json({ success: false, message: 'Internal server error' }, { status: 500 });
	}
};

async function getLedgerOverview(userId: string): Promise<LedgerOverview> {
	try {
		// Check if collections exist
		const collections = await pb.collections.getFullList();
		const hasLedgerCollections = collections.some((c) => c.name === 'ledger_transactions');

		if (!hasLedgerCollections) {
			console.warn('Ledger collections not found - returning empty overview');
			return {
				accountsPayable: 0,
				accountsReceivable: 0,
				totalExpenses: 0,
				totalIncome: 0,
				netBalance: 0,
				currency: 'USD'
			};
		}

		// Get all transactions for calculations
		const currentMonth = new Date();
		const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
		const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

		const startDate = startOfMonth.toISOString().split('T')[0];
		const endDate = endOfMonth.toISOString().split('T')[0];

		// Get income transactions
		const incomeTransactions = await pb.collection('ledger_transactions').getFullList({
			filter: `userId = "${userId}" && type = "income" && date >= "${startDate}" && date <= "${endDate}" && status != "cancelled"`
		});

		// Get expense transactions
		const expenseTransactions = await pb.collection('ledger_transactions').getFullList({
			filter: `userId = "${userId}" && type = "expense" && date >= "${startDate}" && date <= "${endDate}" && status != "cancelled"`
		});

		// Get accounts receivable (unpaid invoices)
		const receivableTransactions = await pb.collection('ledger_transactions').getFullList({
			filter: `userId = "${userId}" && type = "income" && status = "pending"`
		});

		// Get accounts payable (unpaid bills)
		const payableTransactions = await pb.collection('ledger_transactions').getFullList({
			filter: `userId = "${userId}" && type = "expense" && status = "pending"`
		});

		const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
		const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
		const accountsReceivable = receivableTransactions.reduce((sum, t) => sum + t.amount, 0);
		const accountsPayable = payableTransactions.reduce((sum, t) => sum + t.amount, 0);

		return {
			accountsPayable,
			accountsReceivable,
			totalExpenses,
			totalIncome,
			netBalance: totalIncome - totalExpenses,
			currency: 'USD'
		};
	} catch (error) {
		console.error('Error calculating ledger overview:', error);
		return {
			accountsPayable: 0,
			accountsReceivable: 0,
			totalExpenses: 0,
			totalIncome: 0,
			netBalance: 0,
			currency: 'USD'
		};
	}
}

async function getRecentTransactions(userId: string, limit: number = 10): Promise<Transaction[]> {
	try {
		// Check if collections exist
		const collections = await pb.collections.getFullList();
		const hasLedgerCollections = collections.some((c) => c.name === 'ledger_transactions');

		if (!hasLedgerCollections) {
			console.warn('Ledger collections not found - returning empty transactions');
			return [];
		}

		const transactions = await pb.collection('ledger_transactions').getList(1, limit, {
			filter: `userId = "${userId}"`,
			sort: '-date',
			expand: 'accountId,categoryId,contactId'
		});

		return transactions.items.map((item) => ({
			...item,
			account: item.expand?.accountId?.name || 'Unknown Account'
		})) as Transaction[];
	} catch (error) {
		console.error('Error fetching recent transactions:', error);
		return [];
	}
}

async function getActiveAccounts(userId: string): Promise<LedgerAccount[]> {
	try {
		// Check if collections exist
		const collections = await pb.collections.getFullList();
		const hasLedgerCollections = collections.some((c) => c.name === 'ledger_accounts');

		if (!hasLedgerCollections) {
			console.warn('Ledger collections not found - returning empty accounts');
			return [];
		}

		const accounts = await pb.collection('ledger_accounts').getFullList({
			filter: `userId = "${userId}" && isActive = true`,
			sort: 'name'
		});

		return accounts as LedgerAccount[];
	} catch (error) {
		console.error('Error fetching active accounts:', error);
		return [];
	}
}

async function getMonthlyTrends(userId: string, months: number = 6): Promise<MonthlyTrend[]> {
	try {
		const trends: MonthlyTrend[] = [];
		const currentDate = new Date();

		for (let i = months - 1; i >= 0; i--) {
			const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
			const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
			const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

			const startDateStr = startDate.toISOString().split('T')[0];
			const endDateStr = endDate.toISOString().split('T')[0];

			// Get income for this month
			const incomeTransactions = await pb.collection('ledger_transactions').getFullList({
				filter: `userId = "${userId}" && type = "income" && date >= "${startDateStr}" && date <= "${endDateStr}" && status != "cancelled"`
			});

			// Get expenses for this month
			const expenseTransactions = await pb.collection('ledger_transactions').getFullList({
				filter: `userId = "${userId}" && type = "expense" && date >= "${startDateStr}" && date <= "${endDateStr}" && status != "cancelled"`
			});

			const income = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
			const expenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

			trends.push({
				month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
				income,
				expenses,
				profit: income - expenses
			});
		}

		return trends;
	} catch (error) {
		console.error('Error calculating monthly trends:', error);
		return [];
	}
}
