// src/lib/types/types.email.ts

export interface EmailAccount {
	id: string;
	userId: string;
	email: string;
	provider: 'gmail' | 'outlook' | 'imap';
	accessToken: string;
	refreshToken: string;
	tokenExpiry: Date;
	isActive: boolean;
	lastSyncAt: Date;
	syncStatus: 'idle' | 'syncing' | 'error';
	syncError?: string;
	displayName?: string;
	created: Date;
	updated: Date;
}

export interface EmailMessage {
	id: string;
	accountId: string;
	messageId: string;
	threadId: string;
	subject: string;
	from: EmailAddress;
	to: EmailAddress[];
	cc?: EmailAddress[];
	bcc?: EmailAddress[];
	replyTo?: EmailAddress[];
	date: Date;
	bodyText?: string;
	bodyHtml?: string;
	snippet: string;
	attachments: EmailAttachment[];
	labels: string[];
	isRead: boolean;
	isStarred: boolean;
	isImportant: boolean;
	aiAnalysis?: EmailAIAnalysis;
	created: Date;
	updated: Date;
}
export interface EmailDraft {
	id: string;
	accountId: string;
	to: EmailAddress[];
	cc?: EmailAddress[];
	bcc?: EmailAddress[];
	subject: string;
	body: string;
	isHtml: boolean;
	attachments?: EmailAttachment[];
	replyToMessageId?: string;
	priority: 'low' | 'normal' | 'high' | 'urgent';
	scheduledSendAt?: Date;
	tags?: string[];
	templateId?: string;
	created: Date;
	updated: Date;
	lastModified: Date;
}
export interface EmailTemplate {
	id: string;
	userId: string;
	name: string;
	subject: string;
	body: string;
	isHtml: boolean;
	category:
		| 'business'
		| 'personal'
		| 'marketing'
		| 'support'
		| 'announcement'
		| 'reminder'
		| 'newsletter'
		| 'other';
	tags: string[];
	variables?: string[];
	isPublic: boolean;
	useCount: number;
	created: Date;
	updated: Date;
}
export interface EmailAddress {
	name?: string;
	email: string;
}

export interface EmailAttachment {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	attachmentId: string;
	contentId?: string;
	isInline: boolean;
	downloadUrl?: string;
	localPath?: string;
}

export interface EmailAIAnalysis {
	id: string;
	messageId: string;
	sentiment: 'positive' | 'negative' | 'neutral';
	priority: 'low' | 'medium' | 'high' | 'urgent';
	category: string;
	tags: string[];
	summary: string;
	actionItems: string[];
	suggestedResponse?: string;
	confidenceScore: number;
	processedAt: Date;
}

export interface EmailThread {
	id: string;
	accountId: string;
	threadId: string;
	subject: string;
	participants: EmailAddress[];
	messageCount: number;
	lastMessage: Date;
	isRead: boolean;
	labels: string[];
	messages: EmailMessage[];
}

export interface EmailSyncStatus {
	accountId: string;
	lastSyncAt: Date;
	nextSyncAt: Date;
	status: 'idle' | 'syncing' | 'error';
	error?: string;
	messagesSynced: number;
	totalMessages: number;
}

export interface EmailFilter {
	accountId?: string;
	isRead?: boolean;
	isStarred?: boolean;
	hasAttachments?: boolean;
	fromDate?: Date;
	toDate?: Date;
	query?: string;
	labels?: string[];
	limit?: number;
	offset?: number;
}

export interface EmailAuthConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	scopes: string[];
}

export interface EmailSyncConfig {
	batchSize: number;
	syncInterval: number; // in minutes
	maxHistoryDays: number;
	downloadAttachments: boolean;
	processWithAI: boolean;
}

export interface EmailStats {
	totalMessages: number;
	unreadMessages: number;
	todayMessages: number;
	weekMessages: number;
	monthMessages: number;
	avgResponseTime: number;
	topSenders: Array<{
		email: string;
		count: number;
	}>;
}

// API Response types
export interface EmailApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	pagination?: {
		total: number;
		page: number;
		limit: number;
		hasMore: boolean;
	};
}

export interface EmailAccountSetup {
	provider: 'gmail' | 'outlook' | 'imap';
	email: string;
	authCode?: string;
	imapConfig?: {
		host: string;
		port: number;
		secure: boolean;
		username: string;
		password: string;
	};
}
