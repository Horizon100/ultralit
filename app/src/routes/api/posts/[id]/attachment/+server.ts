// src/routes/api/posts/[id]/attachment/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { PostAttachment } from '$lib/types/types.posts';
import { getFileType } from '$lib/utils/fileHandlers';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ params, request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const postId = params.id;

		const post = unwrap(await pbTryCatch(pb.collection('posts').getOne(postId), 'fetch post'));

		if (post.user !== locals.user.id) {
			throw new Error('Unauthorized to add attachments to this post');
		}

		const formData = await request.formData();
		const attachments: PostAttachment[] = [];

		for (const [key, value] of formData.entries()) {
			if (key.startsWith('attachment_') && value instanceof File && value.size > 0) {
				const attachmentFormData = new FormData();
				attachmentFormData.append('post', postId);
				attachmentFormData.append('file_path', value);
				attachmentFormData.append('file_type', getFileType(value.type));
				attachmentFormData.append('file_size', value.size.toString());
				attachmentFormData.append('original_name', value.name);
				attachmentFormData.append('mime_type', value.type);

				const attachment = unwrap(
					await pbTryCatch(
						pb.collection('posts_attachments').create<PostAttachment>(attachmentFormData),
						`create attachment for ${value.name}`
					)
				);

				attachments.push(attachment);
			}
		}

		if (attachments.length === 0) {
			throw new Error('No valid attachments provided');
		}

		return json({
			success: true,
			attachments,
			count: attachments.length
		});
	}, 'Failed to upload attachments');

export const GET: RequestHandler = async ({ params, url }) =>
	apiTryCatch(async () => {
		const postId = params.id;
		const attachmentId = url.searchParams.get('attachmentId');

		if (attachmentId) {
			// Get specific attachment with tags
			const attachment = unwrap(
				await pbTryCatch(
					pb.collection('posts_attachments').getOne(attachmentId),
					'fetch specific attachment'
				)
			);

			// Verify the attachment belongs to this post
			if (attachment.post !== postId) {
				throw new Error('Attachment does not belong to this post');
			}

			return json({
				success: true,
				attachment: {
					...attachment,
					tags: attachment.tags || [],
					tagCount: attachment.tagCount || 0,
					analysis: attachment.analysis || null
				}
			});
		} else {
			// Get all attachments for the post
			const attachments = await pb.collection('posts_attachments').getFullList({
				filter: `post = "${postId}"`,
				sort: 'created'
			});

			return json({
				success: true,
				attachments: attachments.map((attachment) => ({
					...attachment,
					tags: attachment.tags || [],
					tagCount: attachment.tagCount || 0,
					analysis: attachment.analysis || null
				}))
			});
		}
	}, 'Failed to fetch attachments');

export const PATCH: RequestHandler = async ({ params, request, url, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const postId = params.id;
		const attachmentId = url.searchParams.get('attachmentId');

		if (!attachmentId) {
			throw new Error('Attachment ID is required');
		}

		const data = await request.json();
		console.log('🔍 Received PATCH data:', JSON.stringify(data, null, 2));

		const { tags, tagCount, analysis } = data;

		if (!Array.isArray(tags)) {
			throw new Error('Tags must be an array');
		}

		console.log('🏷️ Updating attachment tags:', {
			postId,
			attachmentId,
			tags: tags.slice(0, 3), // Log first 3 tags
			tagCount,
			hasAnalysis: !!analysis
		});

		// Verify the post exists and user has permission
		const post = unwrap(await pbTryCatch(pb.collection('posts').getOne(postId), 'fetch post'));

		if (post.user !== locals.user.id) {
			throw new Error('Unauthorized to modify attachments of this post');
		}

		// Get the attachment to verify it belongs to this post
		const attachment = unwrap(
			await pbTryCatch(pb.collection('posts_attachments').getOne(attachmentId), 'fetch attachment')
		);

		if (attachment.post !== postId) {
			throw new Error('Attachment does not belong to this post');
		}

		// Update the attachment with tags and analysis
		const updateData: Partial<PostAttachment> = {
			tags: tags,
			tagCount: tagCount || tags.length
		};

		// Add analysis if provided (for image descriptions)
		if (analysis) {
			updateData.analysis = analysis;
		}

		const updatedAttachment = unwrap(
			await pbTryCatch(
				pb.collection('posts_attachments').update(attachmentId, updateData),
				'update attachment with tags'
			)
		);

		console.log('✅ Successfully updated attachment with tags:', updatedAttachment.id);

		return json({
			success: true,
			attachment: {
				...updatedAttachment,
				tags: updatedAttachment.tags || [],
				tagCount: updatedAttachment.tagCount || 0,
				analysis: updatedAttachment.analysis || null
			},
			message: `Updated attachment with ${tags.length} tags`
		});
	}, 'Failed to update attachment tags');

export const DELETE: RequestHandler = async ({ params, url, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const postId = params.id;
		const attachmentId = url.searchParams.get('attachmentId');
		if (!attachmentId) throw new Error('Attachment ID is required');

		const post = unwrap(await pbTryCatch(pb.collection('posts').getOne(postId), 'fetch post'));

		if (post.user !== locals.user.id) {
			throw new Error('Unauthorized to delete attachments from this post');
		}

		await pbTryCatch(pb.collection('posts_attachments').delete(attachmentId), 'delete attachment');

		return json({ success: true });
	}, 'Failed to delete attachment');
