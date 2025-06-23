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

		const attachment = unwrap(await pbTryCatch(
		pb.collection('posts_attachments').create<PostAttachment>(attachmentFormData),
		`create attachment for ${value.name}`
		));

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

export const GET: RequestHandler = async ({ params }) =>
  apiTryCatch(async () => {
    const postId = params.id;

    const attachments = await pb.collection('posts_attachments').getFullList({
      filter: `post = "${postId}"`,
      sort: 'created'
    });

    return json({
      success: true,
      attachments
    });
  }, 'Failed to fetch attachments');

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
