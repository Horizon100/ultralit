import type { RecordModel } from 'pocketbase';
import type { ThreadSortOption } from '$lib/stores/threadsStore';

export interface PocketBaseError {
	response?: {
		code: number;
		message: string;
		data?: Record<string, unknown>;
	};
	data?: Record<string, unknown>;
	originalError?: Record<string, unknown>;
	message?: string;
}

export interface PocketBaseAuthStore {
	token: string | null;
	model?: {
		id?: string;
		email?: string;
		username?: string;
		name?: string;
		collectionId?: string;
		[key: string]: unknown;
	} | null;
}
export interface CacheData<T> {
	data: T;
	timestamp: number;
}

export interface BatchRequestBody {
	userIds: string[];
}

export interface BatchResponse {
	success: boolean;
	users: (PublicUserProfile | null)[];
	meta: {
		requested: number;
		found: number;
		cached: boolean;
		requestId?: string;
		responseTime?: number;
	};
}
export interface TimerSession {
	date: string;
	startTime: string;
	endTime: string;
	duration: number;
}
export interface TimerSessionSummary {
	date: string;
	totalDuration: number;
	sessions: TimerSession[];
}
export interface FeatureCardType {
	title: string;
	description: string;
	icon?: string;
	button?: string;
	name?: string;
	month?: string;
	price?: string;
	isPro?: boolean;
	features?: string[];
}

export interface PricingPlan {
	name: string;
	description: string;
	price: string;
	month: string;
	button: string;
	features: string[];
	isPro?: boolean;
	title?: string;
}
export interface HierarchyData {
	name: string;
	value?: number;
	children?: HierarchyData[];
	taskId?: string;
	taskData?: {
		title: string;
		description?: string;
		status?: string;
		priority?: string;
		assignedTo?: string;
		due_date?: string;
		start_date?: string;
	};
}

export interface User extends RecordModel {
	username: string;
	description: string;
	email: string;
	emailVisibility: boolean;
	verified: boolean;
	name?: string;
	avatar: string;
	role: 'admin' | 'tester' | 'client';
	network_preferences: string[];
	preferences: string[];
	messages: string[];
	last_login: string;
	status: 'online' | 'offline';
	bookmarks: string[];
	favoriteThreads: string[];
	timer_sessions: TimerSessionSummary[];
	token_balance: number;
	lifetime_tokens: number;
	current_subscription?: string;
	activated_features: string[];
	languagePreference?: string;
	theme_preference?: string;
	wallpaper_preference: string[];
	  timezonePreference?: string;
  notificationPreferences?: Record<string, boolean>;
  factorValidated?: boolean; 

	profileWallpaper: string;
	created: string;
	updated: string;
	id: string;
	collectionId: string;
	collectionName: string;
	api_keys: string[];
	selected_provider?: string;
	model?: string;
	prompt_preference: string[];
	sysprompt_preference: string;
	model_preference?: string[];
	taskAssignments: string[];
	projects: string[];
	hero: string;
	followers: string[];
	following: string[];
	userTaskStatus: {
		backlog: number;
		todo: number;
		focus: number;
		inprogress: number;
		done: number;
		hold: number;
		postpone: number;
		cancel: number;
		review: number;
		delegate: number;
		archive: number;
	};
	location?: string;
	website?: string;
}

export interface PublicUserProfile {
	id: string;
	username: string;
	name: string;
	email: string;
	avatar: string;
	avatarUrl: string | null;
	verified: boolean;
	description: string;
	role: string;
	last_login: string;
	perks: string[];
	taskAssignments: string[];
	followers: string[];
	following: string[];
	userTaskStatus: {
		backlog: number;
		todo: number;
		focus: number;
		done: number;
		hold: number;
		postpone: number;
		cancel: number;
		review: number;
		delegate: number;
		archive: number;
	};
	userProjects: string[];
	hero: string;
	location: string;
	website: string;
	created: string;
}
export interface UserProfile {
	id: string;
	name: string;
	username: string;
	email: string;
	avatarUrl: string;
	avatar: string;
}
export interface DMMessage {
	id: string;
	content: string;
	senderId: string;
	receiverId: string;
	replyId?: string;
	created: string;
	updated: string;
}
export interface DMConversation {
	id: string;
	content: DMMessage[];
	user: ConversationUser;
	lastMessage?: {
		content: string;
		timestamp: Date;
		senderId: string;
	};
	unreadCount: number;
	isActive?: boolean;
}
export interface DMMessageWithExpand extends DMMessage {
	expand?: {
		senderId?: User;
		receiverId?: User;
	};
}
export interface ConversationUser {
	id: string;
	name: string;
	avatar?: string;
	status?: 'online' | 'offline';
	username?: string;
}
export interface Prompt {
	value: PromptType;
	label: string;
	icon: unknown;
	description: string;
	youtubeUrl: string;
}

export interface PromptInput {
	id: string;
	createdBy: string;
	prompt: string;
	created: string;
	updated: string;
	selectedInputPrompt: string;
	project?: Projects;
}

export type PromptType = 'NORMAL' | 'CONCISE' | 'CRITICAL' | 'INTERVIEW';

export interface PromptState {
	promptType: PromptType;
	currentStage: 'initial' | 'scenarios' | 'guidance' | 'tasks' | 'refinement' | 'final' | 'summary';
	scenarios: Scenario[];
	tasks: Task[];
	guidance: Guidance | null;
	selectedScenario: Scenario | null;
	selectedTask: Task | null;
	summary: string;
	networkData: string;
}
export interface PromptSelectEvent {
	promptId: string;
	promptText: string;
}
export interface PromptAuxClickEvent {
	promptId: string;
	event: MouseEvent;
}
export interface ThreadGroup {
	group: string;
	threads: Threads[];
}

export interface ThreadStoreState {
	threads: Threads[];
	currentThreadId: string | null;
	messages: Messages[];
	updateStatus: string | null;
	isThreadsLoaded: boolean;
	showThreadList: boolean;
	searchQuery: string;
	namingThreadId: string | null;
	currentThread: Threads | null;
	filteredThreads: Threads[];
	isEditingThreadName: boolean;
	editedThreadName: string;
	isNaming: boolean;
	project_id: string | null;
	sortOption: ThreadSortOption;
	selectedUserIds: Set<string>;
	selectedTagIds: Set<string>;
	availableUsers: { id: string; name: string }[];
	isLoading: boolean;
	isUpdating: boolean;
	error: string | null;
	currentProjectId?: string | null;
	showFavoriteThreads: boolean;
}
export interface ThreadMember {
	id: string;
}
export interface Threads extends RecordModel {
	id: string;
	name: string;
	op: string;
	members?: string | (ThreadMember | string)[];
	created: string;
	updated: string;
	last_message?: Messages;
	current_thread: string;
	messageCount?: number;
	project_id: string | null;
	agents: string[];
	project?: string | null;

	/*
	 * currentThread: Threads | null;
	 * filteredThreads: Threads[];
	 * isEditingThreadName: boolean;
	 * editedThreadName: string;
	 * isNaming: boolean;
	 */
}

export type RoleType =
	| 'system'
	| 'human'
	| 'user'
	| 'assistant'
	| 'proxy'
	| 'hub'
	| 'moderator'
	| 'thinking';

export interface PartialAIAgent {
	id?: string;
	name?: string;
	owner?: string;
	editors?: string[];
	viewers?: string[];
	activityLog?: string[];
	currentUsers?: string[];
	currentProjects?: string[];
	currentThreads?: string[];
	currentMessages?: string[];
	currentPosts?: string[];
	currentTasks?: string[];
	description?: string;
	avatar?: string;
	role?: RoleType;
	max_attempts?: number;
	user_input?: 'end' | 'never' | 'always';
	prompt?: string;
	model?: string[];
	actions?: string[];
	capabilities?: string[];
	tasks?: string[];
	status?: 'active' | 'inactive' | 'maintenance' | 'paused';
	messages?: string[];
	tags?: string[];
	performance?: number;
	version?: string;
	last_activity?: Date;
	parent_agent?: string;
	child_agents?: string[];
	base_priority?: number;
	adaptive_priority?: number;
	weight_altruism?: number;
	weight_survival?: number;
	weight_exploration?: number;
	weight_aspiration?: number;
	weight_surrogate?: number;
	weight_selfdev?: number;
	label?: string;
	position: string | { x: number; y: number };
	expanded?: boolean;
	type?: 'host' | 'sub' | 'peer';
	created?: string;
	updated?: string;
	provider: ProviderType;
	collectionId: string;
	collectionName: string;
}
export interface AIAgent extends RecordModel {
	id: string;
	name: string;
	description: string;
	owner: string;
	editors: string[];
	activityLog: string[];
	currentUsers: string[];
	currentProjects: string[];
	currentThreads: string[];
	currentMessages: string[];
	currentPosts: string[];
	currentTasks: string[];
	max_attempts: number;
	user_input: 'end' | 'never' | 'always';
	prompt: string;
	model: string[];
	actions: string[];
	avatar: string;
	role: RoleType;
	capabilities: string[];
	tasks: string[];
	status: 'active' | 'inactive' | 'maintenance' | 'paused';
	messages: string[];
	tags: string[];
	performance: number;
	version: string;
	last_activity: Date;
	parent_agent?: string;
	child_agents: string[];
	base_priority: number;
	adaptive_priority: number;
	weight_altruism: number;
	weight_survival: number;
	weight_exploration: number;
	weight_aspiration: number;
	weight_surrogate: number;
	weight_selfdev: number;
	label?: string;
	position: string | { x: number; y: number };
	expanded: boolean;
	created: string;
	updated: string;
		last_reply?: string; 
	auto_reply_enabled?: boolean; 
	reply_delay?: number; 
	reply_conditions?: {
		keywords?: string[]; 
		user_types?: string[];
		min_content_length?: number;
	};
}
export interface AgentAutoReplyConfig {
	enabled: boolean;
	delay: number; // seconds
	conditions?: {
		keywords?: string[];
		user_types?: string[];
		min_content_length?: number;
		max_replies_per_hour?: number;
	};
	response_template?: string;
}
export interface AIMessage {
	role: RoleType;
	content: string;
	provider: ProviderType;
	model: string;
	prompt_type?: PromptType;
	prompt_input?: string;
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'grok' | 'deepseek' | 'local';

export interface AIModel extends RecordModel {
	id: string;
	name: string;
	api_key: string;
	base_url: string;
	api_type: string;
	api_version: string;
	description: string;
	user: string[];
	created: string;
	updated: string;
	provider: ProviderType;
	collectionId: string;
	collectionName: string;
}

export interface AIResponse {
	response: string;
}
export interface UserModelPreferences {
	id: string;
	user: string;
	selected_provider: ProviderType;
	model: string;
	created: string;
	updated: string;
}


export interface SelectableAIModel {
	id: string;
	name: string;
	provider: ProviderType;
	context_length?: number;
	description?: string;
	api_type?: string;
	size?: number;
	parameters?: string;
	families?: string[];
	available?: boolean;
	collectionId?: string;
	collectionName?: string;
	created?: string;
	updated?: string;
}


export interface NodeConfig {
	maxTokens: number;
	temperature: number;
}
export interface AIPreferences extends RecordModel {
	reference_agent: string[];
	role:
		| 'decision_maker'
		| 'processor'
		| 'communicator'
		| 'recommender'
		| 'monitor'
		| 'optimizer'
		| 'evaluator'
		| 'learner';
	ai_model: AIModel;
	capabilities: string[];
	base_priority_weights: string;
	context_weights: number;
	ai_interaction_style: string;
	privacy_level: string;
	learning_rate: number;
}

export interface CursorPosition extends RecordModel {
	user: string;
	position: {
		x: number;
		y: number;
	};
	name: string;
	userData: User;
}

export interface Node extends RecordModel {
	id: string;
	title: string;
	content: string;
	x: number;
	y: number;
	expanded: boolean;
	seedPrompt: string;
	config: NodeConfig;
	label: string;
	networkLayoutId?: string;
}
export interface NodeConfig {
	maxTokens: number;
	temperature: number;
}
export interface Scenario extends RecordModel {
	id: string;
	description: string;
}

export interface Network extends RecordModel {
	id: string;
	name: string;
	description: string;
	user_id: string;
	root_agent: string;
	agents: string[];
}
/*
 * export interface NetworkStructure extends RecordModel {
 *     type: string;
 *     agents: AIAgent[];
 * }
 */

/*
 * export interface NetworkNode {
 *     id: string;
 *     label: string;
 *     x?: number;  // Made optional
 *     y?: number;  // Made optional
 * }
 */

/*
 * export interface NetworkEdge {
 *     source: string;
 *     target: string;
 * }
 */
export interface VisNode {
	id: string;
	label: string;
	x?: number;
	y?: number;
}
export interface NetworkEdge {
	source: string;
	target: string;
}
export interface NetworkData {
	id?: string;
	nodes: VisNode[];
	edges: NetworkEdge[];
	rootAgent: VisNode;
	childAgents: VisNode[];
	tasks: Task[];
}
/*
 * export type NetworkData = {
 *     id: string;
 *     nodes: NetworkNode[];
 *     edges: NetworkEdge[];
 * };
 */

export interface Guidance {
	type: string;
	content: string;
}

export interface TextFile {
	type: string;
	name: string;
	content: string;
	lastModified: number;
	size: number;
}

export interface Transform {
	scale: number;
	offsetX: number;
	offsetY: number;
}

export interface Shape {
	id: string;
	svg: string;
	component: {
		template: string;
		style: string;
	};
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	ref?: HTMLElement | null;
}

export interface Actions {
	id: string;
	name: string;
	description: string;
	code: string;
	createdBy: User;
	created: string;
	updated: string;
}

export interface Workflows {
	id: string;
	createdBy: string;
	name: string;
	description: string;
	summary: string[];
	project?: Projects;
	workshop: Workshops[];
	workspace: Workspaces;
	created: string;
	updated: string;
}

export interface Workspaces {
	id: string;
	name: string;
	description: string;
	createdBy: string;
	collaborators: string[];
	project?: Projects;
	workshops: Workshops[];
	workflows: Workflows[];
	created: string;
	updated: string;
	avatar: string;
	parent_agent: string;
}

export interface Workshops {
	id: string;
	name: string;
	createdBy: string;
	description: string;
	workspace: Workspaces;
	workflow: Workflows[];
	project?: Projects;
	prompt: string;
	replies: string[];
	created: string;
	updated: string;
	tags?: number[];
	status?: string;
}

export interface InternalChatMessage extends ChatMessage {
	id: string;
	isTyping?: boolean;
	isHighlighted?: boolean;
	content: string;
	text: string;
	collectionId: string;
	collectionName: string;
	parent_msg: string | null;
	reactions?: {
		upvote: number;
		downvote: number;
		bookmark: string[];
		highlight: string[];
		question: number;
	};
	prompt_type: string | null;
	prompt_input: string | null;
	model: User['model'];
	provider: ProviderType;
	thread?: string;
	role: RoleType;
}
export interface Messages extends RecordModel {
	id: string;
	text: string;
	user: string;
	parent_msg: string | null;
	task_relation: string | null;
	agent_relation: string | null;
	type: 'human' | 'robot';
	read_by: string[];
	thread: string;
	attachments: string;
	created: string;
	updated: string;
	prompt_type: PromptType | null;
	prompt_input: string | null;
	model: string;
}
export interface MessageState {
	messages: Messages[];
	chatMessages: InternalChatMessage[];
	userInput: string;
	messageIdCounter: number;
	latestMessageId: string | null;
	thinkingMessageId: string | null;
	typingMessageId: string | null;
	quotedMessage: Messages | null;
}

export interface Message extends RecordModel {
	text: string;
	user: string;
	parent_msg: string | null;
	task_relation: string | null;
	agent_relation: string | null;
	type: 'text' | 'img' | 'video' | 'audio' | 'file' | 'link' | 'network';
	read_by: string[];
	sender: string;
	receiver: string;
	attachments: string;
	reactions: {
		bookmark: string[];
		copy: string;
	};
	update_status: 'not_updated' | 'updated' | 'deleted';
	prompt_type: string | null;
	prompt_input: string | null;
	model: string;
}

export interface ChatMessage extends RecordModel {
	text: string;
	role: RoleType;
	user: string;
	expand?: {
		user?: {
			username: string;
		};
	};
}

export interface Tag {
	id: string;
	name: string;
	tagDescription: string;
	taggedProjects?: string;
	taggedThreads?: string;
	taggedTasks?: string;
	taggedPosts?: string[];
	color: string;
	createdBy: string;
	project?: Projects;
	selected: boolean;
}
export interface Tag extends RecordModel {
	id: string;
	name: string;
	color: string;
	thread_id: string[];
	user: string;
}

export type FolderEventDetail =
	| { type: 'select'; detail: Folders }
	| { type: 'toggle'; detail: string }
	| { type: 'rename'; detail: Folders }
	| { type: 'delete'; detail: string }
	| { type: 'create'; detail: { parentId: string; name: string } }
	| { type: 'move'; detail: { folderId: string; newParentId: string } }
	| { type: 'toggleFolder'; detail: Folders }
	| {
			type: 'handleDragStart';
			detail: { event: DragEvent; item: Folders | Notes; isFolder: boolean };
	  }
	| { type: 'handleDragOver'; detail: { event: DragEvent; folder: Folders } }
	| { type: 'handleDrop'; detail: { event: DragEvent; folder: Folders } }
	| {
			type: 'showContextMenu';
			detail: { event: MouseEvent; item: Folders | Notes; isFolder: boolean };
	  }
	| { type: 'openNote'; detail: Notes };

export type Folders = {
	id: string;
	title: string;
	created_at: string;
	updated_at: string;
	order: number;
	parentId: string | null;
	notes: Notes[];
};

export interface Attachment {
	id: string;
	file: string;
	fileName: string;
	note?: string;
	url?: string;
	attachedProjects?: string;
	attachedThreads?: string;
	attachedTasks?: string;
	createdBy: string;
	created: string;
	updated: string;
}

export type Notes = {
	id: string;
	createdBy: User;
	title: string;
	content: string;
	folder: string;
	created_at: string;
	updated_at: string;
	attachments?: Attachment[];
	order: number;
	project?: Projects;
	parentId?: string;
};

export type NoteRecord = Notes & {
	collectionId: string;
	collectionName: 'notes';
};

export type FolderRecord = Folders & {
	collectionId: string;
	collectionName: 'folders';
};

export interface KanbanColumn {
	id: number;
	title: string;
	status: KanbanTask['status'] | 'backlog' | 'inprogress';
	tasks: KanbanTask[];
	isOpen: boolean;
}
export interface Task extends RecordModel {
	id: string;
	project_id: string;
	createdBy: User | string;
	title: string;
	prompt: string;
	context: string;
	task_outcome: string;
	status:
		| 'backlog'
		| 'todo'
		| 'inprogress'
		| 'review'
		| 'done'
		| 'hold'
		| 'postpone'
		| 'cancel'
		| 'delegate'
		| 'archive';
	priority: 'high' | 'medium' | 'low';
	due_date: Date | string | null;
	start_date: Date | string | null;
	allocatedAgents: string[];
	parent_task: string;
	dependencies: {
		type: 'subtask' | 'dependency' | 'resource' | 'precedence';
		task_id: string;
	}[];
	agentMessages: string[];
	attachments: string;
	taskDescription: string;
	taskTags: string[];
	assignedTo: string;
	created: string;
	updated: string;
}

export interface KanbanTask {
	id: string;
	title: string;
	taskDescription: string;
	creationDate: Date;
	due_date: Date | null;
	start_date: Date | null;
	tags: string[];
	attachments: KanbanAttachment[];
	project_id?: string;
	createdBy?: string;
	parent_task?: string;
	allocatedAgents: string[];
	status: Task['status'];
	priority: 'high' | 'medium' | 'low';
	prompt?: string;
	context?: string;
	task_outcome?: string;
	dependencies?: {
		type: 'subtask' | 'dependency' | 'resource' | 'precedence';
		task_id: string;
	}[];
	agentMessages?: string[];
	assignedTo?: string;
	_scrollAccumulation?: { day: number; month: number; year: number };
	_updateTimeout?: number | ReturnType<typeof setTimeout>;
}

export interface KanbanAttachment {
	id: string;
	fileName: string;
	url: string;
	file?: File;
	note?: string;
}

export interface ProjectStoreState {
	threads: Projects[];
	currentProjectId: string | null;
	messages: Messages[];
	updateStatus: string;
	isProjectLoaded: boolean;
	searchQuery: string;
	namingProjectId: string | null;
	currentProject: Projects | null;
	filteredProject: Projects[];
	isEditingProjectName: boolean;
	editedProjectdName: string;
	owner: User | null;
	collaborators: User[];
}

export interface Projects extends RecordModel {
	id: string;
	name: string;
	description: string;
	created: string;
	updated: string;
	current_project: string;
	threads: string[];
	owner: string;
	collaborators: string[];
	aiSuggestions: string[];
}

export interface ProjectStatsData {
	messageCount?: number;
	documentCount?: number;
	collaboratorCount?: number;
	completionPercentage?: number;
	lastActive?: string;
}

export interface ProjectStatsResponse {
	success: boolean;
	data?: ProjectStatsData;
	error?: string;
}
export interface ExpandedSections {
	prompts: boolean;
	sysprompts: boolean;
	models: boolean;
	bookmarks: boolean;
	cites: boolean;
	collaborators: boolean;
}

export interface UIState {
	isLoading: boolean;
	isLoadingMessages: boolean;
	showPromptCatalog: boolean;
	showModelSelector: boolean;
	isMinimized: boolean;
	showNetworkVisualization: boolean;
	expandedDates: Set<string>;
	searchQuery: string;
}
export interface Reminder {
	id: string;
	title: string;
	dueDate?: Date | null;
	completed: boolean;
	priority?: 'low' | 'medium' | 'high';
	notes?: string;
	listId?: string;
	created?: Date;
	updated?: Date;
	source: 'apple';
}
export interface ReminderList {
	id: string;
	name: string;
	color?: string;
	reminders: Reminder[];
}
export interface PerkFilterCondition {
	parameter: 'messages' | 'threads' | 'tasks' | 'tags' | 'combined' | 'timer';
	operator: '=' | '>' | '>=' | '<' | '<=' | 'between';
	value: number;
	secondValue?: number;
}
export interface Perk extends RecordModel {
	id: string;
	created: string;
	updated: string;
	perkName: string;
	perkDescription: string;
	perkIcon: string;
	filterConditions: PerkFilterCondition[];
	achievedBy?: string[];
}

export interface SwipeConfig {
	threshold?: number;
	direction?: 'horizontal' | 'vertical' | 'both';
	touchTarget?: HTMLElement;
}
