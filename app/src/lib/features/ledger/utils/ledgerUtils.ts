import type {
	Transaction,
	LedgerAccount,
	TransactionFilter,
	MonthlyTrend
} from '$lib/types/types.ledger';

/**
 * Format currency amount with proper locale and currency symbol
 */
export function formatCurrency(
	amount: number,
	currency: string = 'USD',
	locale: string = 'en-US'
): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}

/**
 * Format number with proper locale formatting
 */
export function formatNumber(
	value: number,
	locale: string = 'en-US',
	minimumFractionDigits: number = 0,
	maximumFractionDigits: number = 2
): string {
	return new Intl.NumberFormat(locale, {
		minimumFractionDigits,
		maximumFractionDigits
	}).format(value);
}

/**
 * Format date in a readable format
 */
export function formatDate(
	date: string | Date,
	locale: string = 'en-US',
	options?: Intl.DateTimeFormatOptions
): string {
	const dateObj = typeof date === 'string' ? new Date(date) : date;
	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	};

	return dateObj.toLocaleDateString(locale, options || defaultOptions);
}

/**
 * Get relative time string (e.g., "2 days ago", "in 3 hours")
 */
export function getRelativeTime(date: string | Date, locale: string = 'en-US'): string {
	const dateObj = typeof date === 'string' ? new Date(date) : date;
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

	const units = [
		{ unit: 'year', seconds: 31536000 },
		{ unit: 'month', seconds: 2592000 },
		{ unit: 'week', seconds: 604800 },
		{ unit: 'day', seconds: 86400 },
		{ unit: 'hour', seconds: 3600 },
		{ unit: 'minute', seconds: 60 }
	] as const;

	for (const { unit, seconds } of units) {
		const value = Math.floor(Math.abs(diffInSeconds) / seconds);
		if (value >= 1) {
			return rtf.format(diffInSeconds < 0 ? value : -value, unit);
		}
	}

	return rtf.format(-diffInSeconds, 'second');
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
	if (oldValue === 0) return newValue > 0 ? 100 : 0;
	return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Get status color based on transaction or invoice status
 */
export function getStatusColor(status: string): string {
	const statusColors: Record<string, string> = {
		paid: '#50e3c2',
		pending: '#ffa726',
		overdue: '#ff6b6b',
		cancelled: '#78909c',
		draft: '#ab47bc',
		sent: '#42a5f5'
	};

	return statusColors[status] || '#78909c';
}

/**
 * Get transaction type color
 */
export function getTransactionTypeColor(type: string): string {
	const typeColors: Record<string, string> = {
		income: '#50e3c2',
		expense: '#ff6b6b',
		transfer: '#ffa726'
	};

	return typeColors[type] || '#78909c';
}

/**
 * Calculate account balance based on account type and transaction type
 */
export function calculateBalanceChange(
	accountType: string,
	transactionType: string,
	amount: number
): number {
	// Asset accounts: income increases, expense decreases
	// Liability accounts: expense decreases, income increases
	// Equity accounts: income increases, expense decreases
	// Revenue accounts: income increases
	// Expense accounts: expense increases

	switch (accountType) {
		case 'asset':
		case 'equity':
			return transactionType === 'income' ? amount : -amount;
		case 'liability':
			return transactionType === 'expense' ? -amount : amount;
		case 'revenue':
			return transactionType === 'income' ? amount : -amount;
		case 'expense':
			return transactionType === 'expense' ? amount : -amount;
		default:
			return 0;
	}
}

/**
 * Filter transactions based on criteria
 */
export function filterTransactions(
	transactions: Transaction[],
	filter: TransactionFilter
): Transaction[] {
	return transactions.filter((transaction) => {
		// Date range filter
		if (filter.startDate && transaction.date < filter.startDate) return false;
		if (filter.endDate && transaction.date > filter.endDate) return false;

		// Type filter
		if (filter.type && transaction.type !== filter.type) return false;

		// Status filter
		if (filter.status && transaction.status !== filter.status) return false;

		// Account filter
		if (filter.accountId && transaction.accountId !== filter.accountId) return false;

		// Category filter
		if (filter.categoryId && transaction.categoryId !== filter.categoryId) return false;

		// Contact filter
		if (filter.contactId && transaction.contactId !== filter.contactId) return false;

		// Amount range filter
		if (filter.minAmount !== undefined && transaction.amount < filter.minAmount) return false;
		if (filter.maxAmount !== undefined && transaction.amount > filter.maxAmount) return false;

		// Search filter (description and reference)
		if (filter.search) {
			const searchLower = filter.search.toLowerCase();
			const matchesDescription = transaction.description.toLowerCase().includes(searchLower);
			const matchesReference = transaction.reference?.toLowerCase().includes(searchLower);
			if (!matchesDescription && !matchesReference) return false;
		}

		return true;
	});
}

/**
 * Sort transactions by specified field and direction
 */
export function sortTransactions(
	transactions: Transaction[],
	field: keyof Transaction,
	direction: 'asc' | 'desc' = 'desc'
): Transaction[] {
	return [...transactions].sort((a, b) => {
		const aValue = a[field];
		const bValue = b[field];

		if (aValue === bValue) return 0;

		const comparison = aValue < bValue ? -1 : 1;
		return direction === 'asc' ? comparison : -comparison;
	});
}

/**
 * Group transactions by month for trend analysis
 */
export function groupTransactionsByMonth(transactions: Transaction[]): MonthlyTrend[] {
	const groups: Record<string, { income: number; expenses: number }> = {};

	transactions.forEach((transaction) => {
		const date = new Date(transaction.date);
		const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

		if (!groups[monthKey]) {
			groups[monthKey] = { income: 0, expenses: 0 };
		}

		if (transaction.type === 'income') {
			groups[monthKey].income += transaction.amount;
		} else if (transaction.type === 'expense') {
			groups[monthKey].expenses += transaction.amount;
		}
	});

	return Object.entries(groups)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([monthKey, data]) => ({
			month: new Date(monthKey + '-01').toLocaleDateString('en-US', {
				month: 'short',
				year: 'numeric'
			}),
			income: data.income,
			expenses: data.expenses,
			profit: data.income - data.expenses
		}));
}

/**
 * Calculate account summary statistics
 */
export function calculateAccountSummary(accounts: LedgerAccount[]) {
	const summary = {
		totalAssets: 0,
		totalLiabilities: 0,
		totalEquity: 0,
		netWorth: 0,
		assetAccounts: 0,
		liabilityAccounts: 0,
		equityAccounts: 0
	};

	accounts.forEach((account) => {
		if (!account.isActive) return;

		switch (account.type) {
			case 'asset':
				summary.totalAssets += account.balance;
				summary.assetAccounts++;
				break;
			case 'liability':
				summary.totalLiabilities += account.balance;
				summary.liabilityAccounts++;
				break;
			case 'equity':
				summary.totalEquity += account.balance;
				summary.equityAccounts++;
				break;
		}
	});

	summary.netWorth = summary.totalAssets - summary.totalLiabilities;

	return summary;
}

/**
 * Validate transaction data
 */
export function validateTransaction(data: Partial<Transaction>): string[] {
	const errors: string[] = [];

	if (!data.amount || data.amount <= 0) {
		errors.push('Amount must be greater than 0');
	}

	if (!data.date) {
		errors.push('Date is required');
	}

	if (!data.type || !['income', 'expense', 'transfer'].includes(data.type)) {
		errors.push('Valid transaction type is required');
	}

	if (!data.accountId) {
		errors.push('Account is required');
	}

	if (!data.description || data.description.trim().length === 0) {
		errors.push('Description is required');
	}

	return errors;
}

/**
 * Validate account data
 */
export function validateAccount(data: Partial<LedgerAccount>): string[] {
	const errors: string[] = [];

	if (!data.name || data.name.trim().length === 0) {
		errors.push('Account name is required');
	}

	if (!data.type || !['asset', 'liability', 'equity', 'revenue', 'expense'].includes(data.type)) {
		errors.push('Valid account type is required');
	}

	if (!data.currency || !/^[A-Z]{3}$/.test(data.currency)) {
		errors.push('Valid 3-letter currency code is required');
	}

	return errors;
}

/**
 * Generate unique transaction reference number
 */
export function generateTransactionReference(type: string, date: Date = new Date()): string {
	const typePrefix = type.toUpperCase().charAt(0);
	const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
	const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();

	return `${typePrefix}${dateStr}${randomSuffix}`;
}

/**
 * Generate unique invoice number
 */
export function generateInvoiceNumber(type: 'invoice' | 'bill' | 'quote' = 'invoice'): string {
	const typePrefix = {
		invoice: 'INV',
		bill: 'BILL',
		quote: 'QUO'
	}[type];

	const year = new Date().getFullYear();
	const randomNum = Math.floor(Math.random() * 9999)
		.toString()
		.padStart(4, '0');

	return `${typePrefix}-${year}-${randomNum}`;
}

/**
 * Parse CSV bank statement data
 */
export function parseBankStatementCSV(csvText: string): Array<{
	date: string;
	description: string;
	amount: number;
	type: 'debit' | 'credit';
	balance?: number;
}> {
	const lines = csvText.split('\n').filter((line) => line.trim());
	const transactions: Array<any> = [];

	// Skip header row if present
	const dataLines = lines.slice(1);

	dataLines.forEach((line) => {
		const columns = line.split(',').map((col) => col.trim().replace(/"/g, ''));

		// Common CSV formats:
		// Date, Description, Amount, Balance
		// Date, Description, Debit, Credit, Balance

		if (columns.length >= 3) {
			const date = parseDate(columns[0]);
			const description = columns[1];

			if (columns.length === 4) {
				// Format: Date, Description, Amount, Balance
				const amount = parseFloat(columns[2]);
				const balance = parseFloat(columns[3]);

				transactions.push({
					date: date?.toISOString().split('T')[0] || '',
					description,
					amount: Math.abs(amount),
					type: amount < 0 ? 'debit' : 'credit',
					balance
				});
			} else if (columns.length >= 5) {
				// Format: Date, Description, Debit, Credit, Balance
				const debit = parseFloat(columns[2]) || 0;
				const credit = parseFloat(columns[3]) || 0;
				const balance = parseFloat(columns[4]) || 0;

				if (debit > 0) {
					transactions.push({
						date: date?.toISOString().split('T')[0] || '',
						description,
						amount: debit,
						type: 'debit',
						balance
					});
				}

				if (credit > 0) {
					transactions.push({
						date: date?.toISOString().split('T')[0] || '',
						description,
						amount: credit,
						type: 'credit',
						balance
					});
				}
			}
		}
	});

	return transactions.filter((t) => t.date && t.amount > 0);
}

/**
 * Parse various date formats commonly found in bank statements
 */
function parseDate(dateStr: string): Date | null {
	if (!dateStr) return null;

	// Common date formats
	const formats = [
		/^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
		/^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
		/^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
		/^\d{2}\.\d{2}\.\d{4}$/, // MM.DD.YYYY
		/^\d{1,2}\/\d{1,2}\/\d{4}$/ // M/D/YYYY
	];

	for (const format of formats) {
		if (format.test(dateStr)) {
			const date = new Date(dateStr);
			if (!isNaN(date.getTime())) {
				return date;
			}
		}
	}

	return null;
}

/**
 * Suggest category for transaction based on description
 */
export function suggestCategory(description: string, type: 'income' | 'expense'): string {
	const desc = description.toLowerCase();

	if (type === 'income') {
		if (desc.includes('salary') || desc.includes('payroll') || desc.includes('wage')) {
			return 'Salary';
		}
		if (desc.includes('freelance') || desc.includes('consulting') || desc.includes('contract')) {
			return 'Freelance';
		}
		if (desc.includes('dividend') || desc.includes('interest') || desc.includes('investment')) {
			return 'Investment Income';
		}
		return 'Other Income';
	} else {
		if (desc.includes('grocery') || desc.includes('restaurant') || desc.includes('food')) {
			return 'Food & Dining';
		}
		if (
			desc.includes('gas') ||
			desc.includes('fuel') ||
			desc.includes('uber') ||
			desc.includes('taxi')
		) {
			return 'Transportation';
		}
		if (
			desc.includes('electric') ||
			desc.includes('water') ||
			desc.includes('utility') ||
			desc.includes('internet')
		) {
			return 'Utilities';
		}
		if (desc.includes('rent') || desc.includes('mortgage') || desc.includes('housing')) {
			return 'Housing';
		}
		if (
			desc.includes('doctor') ||
			desc.includes('medical') ||
			desc.includes('pharmacy') ||
			desc.includes('health')
		) {
			return 'Healthcare';
		}
		if (desc.includes('movie') || desc.includes('entertainment') || desc.includes('streaming')) {
			return 'Entertainment';
		}
		if (desc.includes('amazon') || desc.includes('store') || desc.includes('shopping')) {
			return 'Shopping';
		}
		if (desc.includes('insurance')) {
			return 'Insurance';
		}
		if (desc.includes('tax') || desc.includes('irs')) {
			return 'Taxes';
		}
		return 'Other Expenses';
	}
}

/**
 * Export transactions to CSV format
 */
export function exportTransactionsToCSV(transactions: Transaction[]): string {
	const headers = [
		'Date',
		'Type',
		'Amount',
		'Currency',
		'Account',
		'Category',
		'Description',
		'Reference',
		'Status',
		'Contact',
		'Payment Method'
	];

	const rows = transactions.map((transaction) => [
		transaction.date,
		transaction.type,
		transaction.amount.toString(),
		transaction.currency,
		transaction.account || '',
		transaction.categoryId || '',
		transaction.description,
		transaction.reference || '',
		transaction.status,
		transaction.contactName || '',
		transaction.paymentMethod || ''
	]);

	const csvContent = [headers, ...rows]
		.map((row) => row.map((cell) => `"${cell}"`).join(','))
		.join('\n');

	return csvContent;
}

/**
 * Calculate tax amount based on rate and amount
 */
export function calculateTax(amount: number, taxRate: number): number {
	return Math.round(amount * (taxRate / 100) * 100) / 100;
}

/**
 * Calculate invoice totals
 */
export function calculateInvoiceTotals(
	items: Array<{
		quantity: number;
		unitPrice: number;
		taxRate?: number;
	}>
) {
	let subtotal = 0;
	let taxAmount = 0;

	items.forEach((item) => {
		const lineTotal = item.quantity * item.unitPrice;
		subtotal += lineTotal;

		if (item.taxRate) {
			taxAmount += calculateTax(lineTotal, item.taxRate);
		}
	});

	const total = subtotal + taxAmount;

	return {
		subtotal: Math.round(subtotal * 100) / 100,
		taxAmount: Math.round(taxAmount * 100) / 100,
		total: Math.round(total * 100) / 100
	};
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: number | undefined;

	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = window.setTimeout(() => func(...args), wait);
	};
}

/**
 * Generate color palette for categories
 */
export function generateCategoryColors(count: number): string[] {
	const colors = [
		'#50e3c2',
		'#ff6b6b',
		'#ffa726',
		'#ab47bc',
		'#ef5350',
		'#26a69a',
		'#ff7043',
		'#ec407a',
		'#66bb6a',
		'#5c6bc0',
		'#8d6e63',
		'#78909c',
		'#42a5f5',
		'#96ceb4',
		'#85c1e9',
		'#f8b500',
		'#a8e6cf',
		'#ffd93d',
		'#6c5ce7',
		'#fd79a8'
	];

	if (count <= colors.length) {
		return colors.slice(0, count);
	}

	// Generate additional colors if needed
	const additionalColors = [];
	for (let i = colors.length; i < count; i++) {
		const hue = (i * 137.5) % 360; // Golden angle approximation
		additionalColors.push(`hsl(${hue}, 70%, 60%)`);
	}

	return [...colors, ...additionalColors];
}
