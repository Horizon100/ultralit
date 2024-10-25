// src/lib/types.ts

import type { RecordModel } from 'pocketbase'; 

export interface Prompt {
    value: PromptType;
    label: string;
    icon: any;
    description: string;
    youtubeUrl: string;
  }
export type PromptType = 
    'SCENARIO_GENERATION' | 
    'TASK_GENERATION' | 
    'AGENT_CREATION' | 
    'NETWORK_STRUCTURE' | 
    'REFINE_SUGGESTION' | 
    'SUMMARY_GENERATION' | 
    'NETWORK_GENERATION' | 
    'GUIDANCE_GENERATION' | 
    'CASUAL_CHAT' ;

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
    role: 'hub' | 'proxy' | 'assistant' | 'moderator';
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
    user_input: 'end' | 'never' | 'always';
    prompt?: string;
    model?: string[];
    actions?: string[];
    owner?: string;
    editors?: string[];
    viewers?: string[];
    avatar?: string;
    role: 'hub' | 'proxy' | 'assistant' | 'moderator';
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
    focus?: string;
    created?: string
    updated?: string;
}

export interface AIMessage {
    role: 'user' | 'assistant' | 'system' | 'thinking';
    content: string;
}

// export type AIModel = 'gpt-3.5-turbo' | 'gpt-4' | 'claude-v1' | 'other-model';

export interface AIModel {
    id: string;
    name: string;
    api_key: string;
    base_url: string;
    api_type: 'gpt-3.5-turbo' | 'gpt-4' | 'claude-v1' | 'other-model';
    api_version: string;
    description: string;
    user: string[];
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
    role: 'decision_maker' | 'processor' | 'communicator' | 'recommender' | 'monitor' | 'optimizer' | 'evaluator' | 'learner';
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
    status: 'todo' | 'focus' | 'done' | 'hold' | 'postpone' | 'cancel' | 'review' | 'delegate' | 'archive';
    priority: 'high' | 'medium' | 'low';
    due_date: Date;
    parent_agent: string;
    dependencies: {
        type: 'subtask' | 'dependency' | 'resource' | 'precedence';
        task_id: string;  // Reference to other tasks or resources
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
        upvote: number,
        downvote: number,
        bookmark: string[], // Array of user IDs who bookmarked
        highlight: string[], // Array of user IDs who highlighted
        question: number
      }; 
    update_status: 'not_updated' | 'updated' | 'deleted';
    prompt_type: string | null;
    model: string | null;

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


export interface ChatMessage extends RecordModel {
    text: string;
    role: 'user' | 'assistant' | 'thinking';
    user: string;
    expand?: {
        user?: {
            username: string;
        };
    };
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

// export interface NetworkStructure extends RecordModel {
//     type: string;
//     agents: AIAgent[];
// }

// export interface NetworkNode {
//     id: string;
//     label: string;
//     x?: number;  // Made optional
//     y?: number;  // Made optional
// }


// export interface NetworkEdge {
//     source: string;
//     target: string;
// }

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
// export type NetworkData = {
//     id: string;
//     nodes: NetworkNode[];
//     edges: NetworkEdge[];
// };


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



export interface InternalChatMessage extends ChatMessage {
    id: string;
    isTyping?: boolean;
    isHighlighted?: boolean;
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
    reactions: {
        upvote: number,
        downvote: number,
        bookmark: string[], // Array of user IDs who bookmarked
        highlight: string[], // Array of user IDs who highlighted
        question: number
      };
    created: string;
    updated: string;
    prompt_type: string | null;
    model: string | null;
}

export interface Threads extends RecordModel {
    id: string;
    name: string;
    op: string;
    updated: string;
    tags: string[]; 
}

export interface Tag {
    id: number;
    name: string;
    selected: boolean;
    color: string;
}

export type Folders = {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    order: number;
    parentId: string | null;

}

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
}

export type FolderRecord = Folders & {
    collectionId: string;
    collectionName: 'folders';
}

export type NoteRecord = Notes & {
    collectionId: string;
    collectionName: 'notes';
}