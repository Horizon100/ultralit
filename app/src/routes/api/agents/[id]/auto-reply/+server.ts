//  src/routes/api/agents/[id]/auto-reply/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import { error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, request, cookies }) =>
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

		// DUPLICATE PREVENTION: Check if this agent has already replied to this post
		try {
			const existingRepliesResult = await pbTryCatch(
				pb.collection('posts').getList(1, 5, {
					filter: `parent = "${postId}" && user = "${pb.authStore.model?.id}" && content ~ "${agentId}"`
				}),
				'check for existing agent replies'
			);
			const existingReplies = unwrap(existingRepliesResult);
			
			if (existingReplies.totalItems > 0) {
				console.log('🤖 Agent has already replied to this post, skipping');
				return { 
					success: true, 
					skipped: true,
					reason: 'already_replied',
					existing_reply: existingReplies.items[0]
				};
			}
		} catch (e) {
			console.warn('Could not check for existing replies:', e);
		}

		// Get agent details
		const agentResult = await pbTryCatch(
			pb.collection('ai_agents').getOne(agentId),
			'fetch agent details'
		);
		const agent = unwrap(agentResult);

		// Get post details
		const postResult = await pbTryCatch(
			pb.collection('posts').getOne(postId, {
				expand: 'user'
			}),
			'fetch post details'
		);
		const post = unwrap(postResult);

		console.log('🤖 Agent and post loaded:', { 
			agentName: agent.name, 
			postContent: post.content?.substring(0, 50) 
		});

		// Generate a unique response with agent ID to help prevent duplicates
		const timestamp = new Date().toLocaleTimeString();
		const agentResponse = `Hello! I'm ${agent.name}, an AI ${agent.role}. I've reviewed your post and wanted to share my thoughts.

This is an automated response generated at ${timestamp}.

[Agent ID: ${agentId}]`;

		// Create reply as a comment
		const replyData = {
			content: agentResponse,
			parent: postId,
			user: agent.owner, // The agent's owner creates the reply
			type: 'agent_reply',
			created: new Date().toISOString()
		};

		// Add agent field if your schema supports it
		try {
			(replyData as any).agent = agentId;
		} catch (e) {
			console.warn('Agent field not supported in posts schema');
		}

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
			content: agentResponse
		};
	}, 'Agent auto-reply');