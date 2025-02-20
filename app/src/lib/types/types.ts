import type { RecordModel } from 'pocketbase';
import { type ProviderType } from '$lib/constants/providers';

export interface User extends RecordModel {
	username: string;
	email: string;
	emailVisibility: boolean;
	verified: boolean;
	name?: string;
	avatar: string;
	role: string;
	network_preferences: string[];
	preferences: string[];
	messages: string[];
	last_login: Date;
	bookmarks: string[];
	timer_sessions: string[];
	token_balance: number;
	lifetime_tokens: number;
	current_subscription?: string;
	activated_features: string[];
	theme_preference?: string;
	created: string;
	updated: string;
	id: string;
	collectionId: string;
	collectionName: string;
	keys: string[];
	selected_provider?: string;
	model?: string;
}
export interface Prompt {
	value: PromptType;
	label: string;
	icon: unknown;
	description: string;
	youtubeUrl: string;
}
export type PromptType =
	| 'FLOW'
	| 'PLANNER'
	| 'CODER'
	| 'RESEARCH'
	| 'DESIGNER'
	| 'WRITER'
	| 'ANALYZER'
	| 'BRAINSTORM'
	| 'TUTOR';

export interface ThreadGroup {
	group: string;
	threads: Threads[];
}

export interface ThreadStoreState {
	threads: Threads[];
	currentThreadId: string | null;
	messages: Messages[];
	updateStatus: string;
	isThreadsLoaded: boolean;
	showThreadList: boolean;
	searchQuery: string;
	namingThreadId: string | null;
	currentThread: Threads | null;
	filteredThreads: Threads[];
	isEditingThreadName: boolean;
	editedThreadName: string;
	isNaming: boolean;
	project_id?: string;
}

export interface Threads extends RecordModel {
	id: string;
	name: string;
	op: string;
	created: string;
	updated: string;
	last_message?: Messages;
	current_thread: string;
	messageCount?: number;
	project_id: string;
	currentThread: Threads | null;
	filteredThreads: Threads[];
	isEditingThreadName: boolean;
	editedThreadName: string;
	isNaming: boolean; 
}
export interface Tag extends RecordModel {
	id: string;
	name: string;
	color: string;
	selected_threads: string[];
	user: string;
}

export interface PartialAIAgent {
	id?: string;
	user_id?: string;
	name?: string;
	description?: string;
	max_attempts?: number;
	user_input?: 'end' | 'never' | 'always';
	prompt?: string;
	model?: string[]; 
	actions?: string[];
	owner?: string;
	editors?: string[];
	viewers?: string[];
	avatar?: string;
	role?: RoleType;
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
	user_id: string;
	name: string;
	description: string;
	max_attempts: number;
	user_input: 'end' | 'never' | 'always';
	prompt: string;
	model: string[];
	actions: string[]; 
	owner: string; 
	editors: string[];
	viewers: string[];
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
}
export interface AIMessage {
	role: RoleType;
	content: string;
	model: string;
	prompt_type?: PromptType;
}
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
export interface UserModelPreferences {
	id: string;
	user: string;
	selected_provider: ProviderType;
	model: string;
	created: string;
	updated: string;
}
export interface AIResponse {
	response: string;
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
export interface Task extends RecordModel {
	id: string;
	title: string;
	prompt: string;
	context: string;
	task_outcome: string;
	status:
		| 'todo'
		| 'focus'
		| 'done'
		| 'hold'
		| 'postpone'
		| 'cancel'
		| 'review'
		| 'delegate'
		| 'archive';
	priority: 'high' | 'medium' | 'low';
	due_date: Date;
	parent_agent: string;
	dependencies: {
		type: 'subtask' | 'dependency' | 'resource' | 'precedence';
		task_id: string; 
	}[];
	messages: string[];
	attachments: string;
	eisenhower: string;
	rice_score: number;
	created: string;
	updated: string;
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
	model: string;
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
export interface Task extends RecordModel {
	id: string;
	description: string;
}
export interface Attachment {
	id: string;
	name: string;
	url: string;
	file?: File;
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

export interface NetworkData {
	id?: string;
	nodes: VisNode[];
	edges: { source: string; target: string }[];
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
	created: string;
	updated: string;
}

export interface Workflows {
	id: string;
	user_id: string;
	name: string;
	description: string;
	summary: string[];
	created: string;
	updated: string;
}

export interface Workspaces {
	id: string;
	name: string;
	description: string;
	created_by: string;
	collaborators: string[];
	created: string;
	updated: string;
	avatar: string;
	parent_agent: string;
}

export interface Workshops {
	id: string;
	name: string;
	description: string;
	workspace: string;
	workflow: string;
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
	prompt_type: PromptType;
	model: User['model'];
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
	prompt_type: string | null;
	model: string;
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
	selected: boolean;
	color: string;
	user: string;
}

export type Folders = {
	id: string;
	title: string;
	created_at: string;
	updated_at: string;
	order: number;
	parentId: string | null;
};

export interface Attachment {
	id: string;
	fileName: string;
	note: string;
	created: string;
	updated: string;
}
export type Notes = {
	id: string;
	title: string;
	content: string;
	folder: string;
	created_at: string;
	updated_at: string;
	attachments?: Attachment[];
	order: number;
};

export type FolderRecord = Folders & {
	collectionId: string;
	collectionName: 'folders';
};

export type NoteRecord = Notes & {
	collectionId: string;
	collectionName: 'notes';
};

export interface ProjectStoreState {
	threads: Threads[];
	currentProjectId: string | null;
	messages: Messages[];
	updateStatus: string;
	isProjectLoaded: boolean;
	searchQuery: string;
	namingProjectId: string | null;
	currentProject: Threads | null;
	filteredProject: Threads[];
	isEditingProjectName: boolean;
	editedProjectdName: string;
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
	op: string;
	collaborators: string[];
}

export interface ExpandedSections {
	prompts: boolean;
	models: boolean;
	bookmarks: boolean;
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
