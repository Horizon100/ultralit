export interface LedgerAccount {
	id: string;
	name: string;
	type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
	balance: number;
	currency: string;
	description?: string;
	parentAccount?: string;
	isActive: boolean;
	created: string;
	updated: string;
}

export interface Transaction {
	id: string;
	date: string;
	type: 'income' | 'expense' | 'transfer';
	amount: number;
	currency: string;
	account: string;
	accountId: string;
	category: string;
	categoryId?: string;
	description: string;
	reference?: string;
	status: 'pending' | 'paid' | 'overdue' | 'cancelled';
	paymentMethod?: string;
	attachments?: string[];
	tags?: string[];
	contactId?: string;
	contactName?: string;
	projectId?: string;
	invoiceId?: string;
	recurringId?: string;
	created: string;
	updated: string;
	userId: string;
}

export interface LedgerOverview {
	accountsPayable: number;
	accountsReceivable: number;
	totalExpenses: number;
	totalIncome: number;
	netBalance: number;
	currency?: string;
}

export interface Category {
	id: string;
	name: string;
	type: 'income' | 'expense';
	color: string;
	icon?: string;
	parentCategory?: string;
	isActive: boolean;
	created: string;
	updated: string;
}

export interface Contact {
	id: string;
	name: string;
	email?: string;
	phone?: string;
	address?: string;
	type: 'customer' | 'vendor' | 'employee' | 'other';
	taxId?: string;
	paymentTerms?: number;
	currency: string;
	notes?: string;
	isActive: boolean;
	created: string;
	updated: string;
}

export interface Invoice {
	id: string;
	number: string;
	type: 'invoice' | 'bill' | 'quote' | 'credit_note';
	status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
	contactId: string;
	contactName: string;
	issueDate: string;
	dueDate: string;
	paidDate?: string;
	currency: string;
	subtotal: number;
	taxAmount: number;
	total: number;
	paidAmount: number;
	balanceDue: number;
	items: InvoiceItem[];
	notes?: string;
	terms?: string;
	attachments?: string[];
	recurringId?: string;
	created: string;
	updated: string;
	userId: string;
}

export interface InvoiceItem {
	id: string;
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
	taxRate?: number;
	categoryId?: string;
	projectId?: string;
}

export interface RecurringTransaction {
	id: string;
	name: string;
	type: 'income' | 'expense';
	amount: number;
	currency: string;
	accountId: string;
	categoryId: string;
	description: string;
	frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
	startDate: string;
	endDate?: string;
	nextDate: string;
	isActive: boolean;
	contactId?: string;
	created: string;
	updated: string;
	userId: string;
}

export interface BankStatement {
	id: string;
	bankName: string;
	accountNumber: string;
	statementDate: string;
	fileName: string;
	fileType: 'pdf' | 'csv' | 'xlsx' | 'image';
	status: 'uploaded' | 'processing' | 'processed' | 'failed';
	transactions: ParsedTransaction[];
	created: string;
	updated: string;
	userId: string;
}

export interface ParsedTransaction {
	id: string;
	date: string;
	description: string;
	amount: number;
	type: 'debit' | 'credit';
	balance?: number;
	reference?: string;
	category?: string;
	isMatched: boolean;
	matchedTransactionId?: string;
	confidence: number;
	created: string;
}

export interface BudgetCategory {
	id: string;
	name: string;
	categoryId: string;
	budgetAmount: number;
	spentAmount: number;
	period: 'monthly' | 'quarterly' | 'yearly';
	startDate: string;
	endDate: string;
	isActive: boolean;
	created: string;
	updated: string;
	userId: string;
}

export interface FinancialReport {
	id: string;
	name: string;
	type: 'profit_loss' | 'balance_sheet' | 'cash_flow' | 'budget_vs_actual';
	period: 'monthly' | 'quarterly' | 'yearly' | 'custom';
	startDate: string;
	endDate: string;
	data: any;
	generatedAt: string;
	userId: string;
}

export interface LedgerSettings {
	id: string;
	defaultCurrency: string;
	fiscalYearStart: string;
	dateFormat: string;
	numberFormat: string;
	taxRates: TaxRate[];
	paymentMethods: string[];
	bankAccounts: BankAccount[];
	created: string;
	updated: string;
	userId: string;
}

export interface TaxRate {
	id: string;
	name: string;
	rate: number;
	type: 'sales' | 'purchase' | 'payroll';
	isActive: boolean;
}

export interface BankAccount {
	id: string;
	name: string;
	accountNumber: string;
	routingNumber?: string;
	bankName: string;
	accountType: 'checking' | 'savings' | 'credit' | 'loan';
	currency: string;
	balance: number;
	isActive: boolean;
}

export interface AttachmentFile {
	id: string;
	fileName: string;
	fileType: string;
	fileSize: number;
	url: string;
	thumbnailUrl?: string;
	uploadedAt: string;
	userId: string;
}

// API Response Types
export interface LedgerApiResponse<T> {
	data: T;
	message?: string;
	success: boolean;
	total?: number;
	page?: number;
	limit?: number;
}

export interface LedgerDashboardData {
	overview: LedgerOverview;
	recentTransactions: Transaction[];
	accounts: LedgerAccount[];
	upcomingBills: Invoice[];
	monthlyTrends: MonthlyTrend[];
}

export interface MonthlyTrend {
	month: string;
	income: number;
	expenses: number;
	profit: number;
}

// Filter and Search Types
export interface TransactionFilter {
	startDate?: string;
	endDate?: string;
	type?: 'income' | 'expense' | 'transfer';
	status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
	accountId?: string;
	categoryId?: string;
	contactId?: string;
	minAmount?: number;
	maxAmount?: number;
	search?: string;
}

export interface AccountFilter {
	type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
	isActive?: boolean;
	search?: string;
}

// Form Data Types
export interface TransactionFormData {
	date: string;
	type: 'income' | 'expense' | 'transfer';
	amount: number;
	accountId: string;
	categoryId: string;
	description: string;
	reference?: string;
	contactId?: string;
	status: 'pending' | 'paid';
	paymentMethod?: string;
	tags?: string[];
	attachments?: File[];
}

export interface AccountFormData {
	name: string;
	type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
	description?: string;
	parentAccount?: string;
	currency: string;
	initialBalance?: number;
}

export interface InvoiceFormData {
	type: 'invoice' | 'bill';
	contactId: string;
	issueDate: string;
	dueDate: string;
	currency: string;
	items: InvoiceItemFormData[];
	notes?: string;
	terms?: string;
}

export interface InvoiceItemFormData {
	description: string;
	quantity: number;
	unitPrice: number;
	taxRate?: number;
	categoryId?: string;
}

// AI Analysis Types
export interface AIAnalysisResult {
	id: string;
	type: 'statement_parsing' | 'expense_categorization' | 'fraud_detection' | 'budget_insights';
	confidence: number;
	results: any;
	processedAt: string;
	userId: string;
}

export interface StatementParsingResult {
	extractedTransactions: ParsedTransaction[];
	bankInfo: {
		bankName: string;
		accountNumber: string;
		statementPeriod: string;
	};
	totalTransactions: number;
	successRate: number;
	errors: string[];
}

export interface ExpenseCategorizationResult {
	transactionId: string;
	suggestedCategory: string;
	confidence: number;
	reasoning: string;
}

export interface FraudDetectionResult {
	transactionId: string;
	riskLevel: 'low' | 'medium' | 'high';
	flags: string[];
	recommendation: string;
}

export interface BudgetInsight {
	categoryId: string;
	categoryName: string;
	budgetAmount: number;
	actualAmount: number;
	variance: number;
	variancePercentage: number;
	trend: 'up' | 'down' | 'stable';
	recommendation: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
	field: string;
	direction: SortDirection;
}

export interface PaginationOptions {
	page: number;
	limit: number;
	total: number;
}

export const LEDGER_COLLECTIONS = {
	ACCOUNTS: 'ledger_accounts',
	TRANSACTIONS: 'ledger_transactions',
	CATEGORIES: 'ledger_categories',
	CONTACTS: 'ledger_contacts',
	INVOICES: 'ledger_invoices',
	RECURRING_TRANSACTIONS: 'ledger_recurring_transactions',
	BANK_STATEMENTS: 'ledger_bank_statements',
	PARSED_TRANSACTIONS: 'ledger_parsed_transactions',
	BUDGET_CATEGORIES: 'ledger_budget_categories',
	FINANCIAL_REPORTS: 'ledger_financial_reports',
	LEDGER_SETTINGS: 'ledger_settings',
	ATTACHMENTS: 'ledger_attachments',
	AI_ANALYSIS: 'ledger_ai_analysis'
} as const;
