// types/transactions.ts

import type { Feature, FeatureCategory } from './types.features';

// Base costs per operation type
export const TOKEN_COSTS = {
    // Chat operations
    chat_text: 1,          // Per 100 tokens of text
    chat_code: 2,          // Per 100 tokens of code
    chat_image: 10,        // Per image analysis
    chat_file: 5,          // Per file processed

    // MAS operations
    mas_message: 2,        // Per agent message
    mas_creation: 50,      // New agent creation
    mas_training: 100,     // Agent training session
    mas_memory_write: 1,   // Writing to agent memory
    mas_memory_read: 0.5,  // Reading from agent memory

    // Advanced operations
    advanced_prompt: 3,    // Per custom prompt
    advanced_batch: 0.8,   // Per batch item
    advanced_api: 1,       // Per API call

    // Storage operations
    storage_write: 0.1,    // Per MB written
    storage_read: 0.05     // Per MB read
};

// Transaction types with specific metadata
export type TransactionType = 
    | 'purchase'           // Buying tokens
    | 'usage'             // Using tokens
    | 'refund'            // Refund of tokens
    | 'bonus'             // Bonus tokens (promotions)
    | 'subscription'      // Monthly subscription allocation
    | 'transfer';         // Transfer between users

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type PaymentMethod = 'stripe' | 'paypal' | 'bank_transfer' | 'crypto';

export interface TokenTransaction {
    id: string;
    user: string;           // Relation to users
    type: TransactionType;
    amount: number;         // Number of tokens
    cost?: number;          // Cost in base currency (if purchase)
    currency?: string;      // Currency used (if purchase)
    feature?: Feature;      // Related feature (if usage)
    category?: FeatureCategory; // Feature category
    status: TransactionStatus;
    created: string;
    description: string;
    metadata: {
        operation_type?: keyof typeof TOKEN_COSTS;
        related_user?: string;      // For transfers
        subscription_tier?: 'tier1' | 'tier2' | 'tier3';  // For subscription allocations
        payment_method?: PaymentMethod;     // For purchases
        payment_reference?: string;         // External payment reference
        refund_reason?: string;      // For refunds
        bonus_campaign?: string;     // For promotional bonuses
    };
}

export interface TokenUsage {
    id: string;
    user: string;          // Relation to users
    feature: Feature;      // Feature used
    category: FeatureCategory; // Feature category
    tokens_used: number;   // Number of tokens consumed
    operation_type: keyof typeof TOKEN_COSTS;
    agents?: string[];     // Related agent IDs if applicable
    created: string;
    metadata: {
        // Chat metadata
        message_length?: number;
        file_size?: number;
        file_type?: string;
        model_used?: string;
        prompt_tokens?: number;
        completion_tokens?: number;
        
        // MAS metadata
        agent_count?: number;
        training_steps?: number;
        memory_size?: number;
        conversation_turns?: number;
        memory_accessed?: boolean;
        
        // Storage metadata
        storage_size?: number;
        storage_operation?: 'read' | 'write' | 'delete';
        
        // Processing metadata
        batch_size?: number;
        processing_time?: number;
        error_rate?: number;
        success_rate?: number;
        items_processed?: number;
        
        // API metadata
        endpoint?: string;
        response_size?: number;
        status_code?: number;
        
        // Error tracking
        error?: string;
        success?: boolean;
    };
}

