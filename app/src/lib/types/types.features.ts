// types/features.ts
export enum Feature {
    // Chat Features
    CHAT_BASIC = 'chat_basic',           
    CHAT_UPLOAD = 'chat_upload',         
    CHAT_EXPORT = 'chat_export',         
    CHAT_ADVANCED = 'chat_advanced',     

    // Multi-Agent System Features (MAS)
    MAS_BASIC = 'mas_basic',            
    MAS_CUSTOM = 'mas_custom',          
    MAS_MEMORY = 'mas_memory',          
    MAS_TEMPLATES = 'mas_templates',     

    // Advanced Features
    ADVANCED_PROMPTING = 'advanced_prompting',  
    ADVANCED_BATCH = 'advanced_batch',          
    ADVANCED_API = 'advanced_api',              
    
    // Common Features
    COMMON_SHARE = 'common_share',          
    COMMON_WORKSPACE = 'common_workspace',   
    
    // Analytics Features
    ANALYTICS_USAGE = 'analytics_usage',         
    ANALYTICS_PERFORMANCE = 'analytics_performance', 
    
    // Storage Features
    STORAGE_HISTORY = 'storage_history',    
    STORAGE_1GB = 'storage_1gb',           
    STORAGE_10GB = 'storage_10gb',         
    STORAGE_100GB = 'storage_100gb'        
}

export type FeatureCategory = 'chat' | 'mas' | 'advanced' | 'common' | 'analytics' | 'storage';

export const FEATURE_CATEGORIES: Record<Feature, FeatureCategory> = {
    // Chat Features
    [Feature.CHAT_BASIC]: 'chat',
    [Feature.CHAT_UPLOAD]: 'chat',
    [Feature.CHAT_EXPORT]: 'chat',
    [Feature.CHAT_ADVANCED]: 'chat',

    // MAS Features
    [Feature.MAS_BASIC]: 'mas',
    [Feature.MAS_CUSTOM]: 'mas',
    [Feature.MAS_MEMORY]: 'mas',
    [Feature.MAS_TEMPLATES]: 'mas',

    // Advanced Features
    [Feature.ADVANCED_PROMPTING]: 'advanced',
    [Feature.ADVANCED_BATCH]: 'advanced',
    [Feature.ADVANCED_API]: 'advanced',

    // Common Features
    [Feature.COMMON_SHARE]: 'common',
    [Feature.COMMON_WORKSPACE]: 'common',

    // Analytics Features
    [Feature.ANALYTICS_USAGE]: 'analytics',
    [Feature.ANALYTICS_PERFORMANCE]: 'analytics',

    // Storage Features
    [Feature.STORAGE_HISTORY]: 'storage',
    [Feature.STORAGE_1GB]: 'storage',
    [Feature.STORAGE_10GB]: 'storage',
    [Feature.STORAGE_100GB]: 'storage'
};

const TIER1_FEATURES = [
    Feature.CHAT_BASIC,
    Feature.CHAT_UPLOAD,
    Feature.CHAT_EXPORT,
    Feature.MAS_TEMPLATES,
    Feature.STORAGE_1GB
] as const;

const TIER2_FEATURES = [
    ...TIER1_FEATURES,
    Feature.MAS_BASIC,
    Feature.MAS_CUSTOM,
    Feature.MAS_MEMORY,
    Feature.ADVANCED_PROMPTING,
    Feature.ANALYTICS_USAGE,
    Feature.STORAGE_10GB,
    Feature.STORAGE_HISTORY
] as const;

const TIER3_FEATURES = [
    ...TIER2_FEATURES,
    Feature.CHAT_ADVANCED,
    Feature.ADVANCED_BATCH,
    Feature.ADVANCED_API,
    Feature.COMMON_SHARE,
    Feature.COMMON_WORKSPACE,
    Feature.ANALYTICS_PERFORMANCE,
    Feature.STORAGE_100GB
] as const;

export const TIER_FEATURES = {
    tier1: TIER1_FEATURES,
    tier2: TIER2_FEATURES,
    tier3: TIER3_FEATURES
} as const;
