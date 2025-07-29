// src/routes/api/agents/[id]/auto-reply/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import { error } from '@sveltejs/kit';
import type { AIAgent } from '$lib/types/types';
import type { Post } from '$lib/types/types.posts';

async function generateAIResponse(agent: AIAgent, post: Post, parentPost: Post | null, fetch: any): Promise<string> {
	const postTags = post.tags || [];
	const tagContext = postTags.length > 0 ? ` Tags: ${postTags.join(', ')}.` : '';
	
	// Build the system instruction using agent's prompt
	const systemInstruction = agent.prompt || 'Respond helpfully to posts.';
	
	// Create the prompt with parent context if available
	let prompt: string;
	if (parentPost && post.parent) {
		// This is a comment on a post - include both contexts
		prompt = `Original post: "${parentPost.content}"

Comment: "${post.content}"${tagContext}

Response:`;
	} else {
		// This is a direct post
		prompt = `Post: "${post.content}"${tagContext}

Response:`;
	}

	// Get model from agent or fallback to qwen
	let agentModel = 'qwen2.5:0.5b'; // default fallback

	if (agent.model && agent.model.length > 0) {
		const modelId = agent.model[0];
		
		// If it looks like an ID (long string), fetch the model details
		if (modelId.length > 10) {
			try {
				const modelResult = await pbTryCatch(
					pb.collection('ai_models').getOne(modelId),
					'fetch model details'
				);
				const modelData = unwrap(modelResult);
				agentModel = modelData.name; // Use the actual model name
				console.log('🤖 Resolved model from ID:', modelId, 'to name:', agentModel);
			} catch (e) {
				console.warn('Could not resolve model ID to name, using fallback:', e);
				agentModel = 'qwen2.5:0.5b';
			}
		} else {
			// It's already a model name
			agentModel = modelId;
		}
	}
	
	console.log('🤖 Using model for agent response:', agentModel);
	
	const requestBody = {
		prompt: prompt,
		system: systemInstruction,
		model: agentModel,
		temperature: 0.8,
		max_tokens: 250,
		auto_optimize: true
	};
	
	console.log('🤖 AI Request details:', {
		prompt: prompt.substring(0, 150) + '...',
		system: systemInstruction.substring(0, 50) + '...',
		model: agentModel,
		hasParentContext: !!parentPost,
		requestBodySize: JSON.stringify(requestBody).length
	});

	try {
		console.log('🤖 Making fetch request to /api/ai/local/generate...');
		
		const response = await fetch('/api/ai/local/generate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		console.log('🤖 Fetch response status:', response.status);
		console.log('🤖 Fetch response ok:', response.ok);

		if (!response.ok) {
			const errorText = await response.text();
			console.log('🤖 Error response body:', errorText);
			throw new Error(`AI service error: ${response.status} - ${errorText}`);
		}

		const aiResponse = await response.json();
		console.log('🤖 AI Response received:', {
			hasResponse: !!(aiResponse.data?.response || aiResponse.response),
			responseLength: (aiResponse.data?.response || aiResponse.response)?.length || 0,
			responsePreview: (aiResponse.data?.response || aiResponse.response)?.substring(0, 100),
			fullResponse: aiResponse
		});

		// Get the response from the correct location
		const finalResponse = (aiResponse.data?.response || aiResponse.response)?.trim();
		if (!finalResponse) {
			console.log('🤖 Empty response from AI, using fallback');
			throw new Error('Empty response from AI service');
		}

		return finalResponse;
	} catch (fetchError) {
		console.error('🤖 Fetch error details:', fetchError);
		throw fetchError;
	}
}

function generateFallbackResponse(agent: AIAgent, post: Post): string {
	const postTags = post.tags || [];
	
	console.log('🤖 Generating fallback response for tags:', postTags);
	
	if (postTags.length > 0) {
		const relevantTags = postTags.slice(0, 2);
		return `Interesting points about ${relevantTags.join(' and ')}. Thanks for sharing your thoughts on this topic.`;
	}
	
	return "Thanks for sharing this. I'd be happy to discuss this further.";
}

export const POST: RequestHandler = async ({ params, request, cookies, fetch }) =>
	apiTryCatch(async () => {
		console.log('🤖 Auto-reply endpoint called for agent:', params.id);

		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw error(401, 'Authentication required');

		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch {
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) throw error(401, 'Invalid authentication');

		const { postId } = await request.json();
		const agentId = params.id;

		console.log('🤖 Processing auto-reply:', { agentId, postId });

		// Get agent details first
		const agentResult = await pbTryCatch(
			pb.collection('ai_agents').getOne(agentId),
			'fetch agent details'
		);
		const agent = unwrap(agentResult) as AIAgent;

		// Get post details with tags
		const postResult = await pbTryCatch(
			pb.collection('posts').getOne(postId, {
				expand: 'user'
			}),
			'fetch post details'
		);
		const post = unwrap(postResult) as unknown as Post;

		// Get parent post context if this is a comment
		let parentPost: Post | null = null;
		if (post.parent) {
			try {
				const parentResult = await pbTryCatch(
					pb.collection('posts').getOne(post.parent),
					'fetch parent post'
				);
				parentPost = unwrap(parentResult) as unknown as Post;
				console.log('🤖 Parent post context loaded:', parentPost.content?.substring(0, 50));
			} catch (e) {
				console.warn('Could not fetch parent post:', e);
			}
		}

		// Determine the correct parent ID for the agent reply
		// Use the same parent as the comment, so replies appear at the same level
		const replyParentId = post.parent || postId;

		console.log('🤖 Agent and post loaded:', { 
			agentName: agent.name, 
			agentPrompt: agent.prompt?.substring(0, 50) + '...',
			agentModel: agent.model,
			postContent: post.content?.substring(0, 50),
			postTags: post.tags,
			postParent: post.parent,
			replyParentId: replyParentId,
			hasParentContext: !!parentPost
		});

		try {
    console.log('🤖 Checking for existing replies to this specific comment...');
    
    const existingRepliesResult = await pbTryCatch(
        pb.collection('posts').getList(1, 10, {
            // Check if agent has replied directly to THIS comment (not the thread)
            filter: `parent = "${postId}" && agent = "${agentId}" && type = "agent_reply"`
        }),
        'check for existing direct agent replies to this comment'
    );
    const existingReplies = unwrap(existingRepliesResult);
    
    console.log('🤖 Existing direct replies to this comment:', existingReplies.totalItems);
    
    if (existingReplies.totalItems > 0) {
        console.log('🤖 Agent has already replied to this specific comment, skipping');
        console.log('🤖 Existing direct reply:', existingReplies.items[0]);
        return { 
            success: true, 
            skipped: true,
            reason: 'already_replied_to_this_comment',
            existing_reply: existingReplies.items[0]
        };
    }
    
    console.log('🤖 No existing direct replies to this comment found, proceeding...');
} catch (e) {
    console.warn('Could not check for existing direct replies:', e);
}

// Generate AI response using agent's prompt and post context
let agentResponse: string;

try {
    console.log('🤖 Attempting to generate AI response...');
    agentResponse = await generateAIResponse(agent, post, parentPost, fetch);
    console.log('🤖 AI response generated successfully:', agentResponse?.substring(0, 100));
} catch (error: any) {
    console.error('🤖 AI generation failed with full error:', error);
    console.error('🤖 Error stack:', error.stack);
    agentResponse = generateFallbackResponse(agent, post);
    console.log('🤖 Using fallback response:', agentResponse);
}

// Create reply data - reply directly to the comment that triggered this
const replyData = {
    content: agentResponse,
    parent: postId, // Reply directly to the comment, not the thread
    user: agent.owner,
    type: 'agent_reply' as const,
    agent: agentId,
    created: new Date().toISOString()
};

// Final duplicate check right before creating - check direct replies to this comment
try {
    const lastCheckResult = await pbTryCatch(
        pb.collection('posts').getList(1, 1, {
            filter: `parent = "${postId}" && agent = "${agentId}" && type = "agent_reply"`
        }),
        'final duplicate check for direct replies'
    );
    const lastCheck = unwrap(lastCheckResult);
    
    if (lastCheck.totalItems > 0) {
        console.log('🤖 Duplicate detected at final check, aborting');
        return { 
            success: true, 
            skipped: true,
            reason: 'duplicate_prevented_at_final_check',
            existing_reply: lastCheck.items[0]
        };
    }
} catch (e) {
    console.warn('Final duplicate check failed:', e);
}

console.log('🤖 Creating reply directly to comment:', postId);
const replyResult = await pbTryCatch(
    pb.collection('posts').create(replyData),
    'create agent reply'
);
const reply = unwrap(replyResult);

// Update agent status
try {
    await pbTryCatch(
        pb.collection('ai_agents').update(agentId, {
            status: 'active',
            last_reply: new Date().toISOString()
        }),
        'update agent status'
    );
} catch (e) {
    console.warn('Could not update agent last_reply field:', e);
}

console.log('✅ Agent reply created successfully:', reply.id);

return { 
    success: true, 
    reply: reply,
    agent: agent.name,
    content: agentResponse,
    parent_id: postId, // Direct parent is the comment
    triggered_by: postId
};
	}, 'Agent auto-reply');