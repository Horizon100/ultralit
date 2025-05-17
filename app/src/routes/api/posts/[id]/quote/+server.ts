import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request, params, locals }) => {
    try {
        if (!locals.user) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const quotedPostId = params.id;
        const userId = locals.user.id;
        const formData = await request.formData();
        const content = formData.get('content') as string;

        if (!content?.trim()) {
            return json({ error: 'Content is required' }, { status: 400 });
        }

        // Get the quoted post to increment quote count
        const quotedPost = await pb.collection('posts').getOne(quotedPostId);
        
        // Create the new quote post data
        const postData: any = {
            content: content.trim(),
            user: userId,
            quotedPost: quotedPostId, 
            upvotedBy: [],
            downvotedBy: [],
            repostedBy: [],
            commentedBy: [],
            sharedBy: [],
            quotedBy: [],
            readBy: [],
            upvoteCount: 0,
            downvoteCount: 0,
            repostCount: 0,
            commentCount: 0,
            shareCount: 0,
            quoteCount: 0,
            readCount: 0,
            children: []
        };

        // Handle attachments if any
        const attachments: File[] = [];
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('attachment_') && value instanceof File && value.size > 0) {
                attachments.push(value);
            }
        }

        // If there are attachments, add them to the post data
        if (attachments.length > 0) {
            // Create the post first
            const newPost = await pb.collection('posts').create(postData);
            
            // Then handle attachments
            for (let i = 0; i < attachments.length; i++) {
                const file = attachments[i];
                const attachmentData = new FormData();
                attachmentData.append('post', newPost.id);
                attachmentData.append('file_path', file);
                attachmentData.append('file_type', getFileType(file.type));
                attachmentData.append('file_size', file.size.toString());
                attachmentData.append('original_name', file.name);
                attachmentData.append('mime_type', file.type);
                
                await pb.collection('post_attachments').create(attachmentData);
            }
            
            // Get the post with attachments
            const postWithAttachments = await pb.collection('posts').getOne(newPost.id, {
                expand: 'user,attachments(post)'
            });
            
            // Update the quoted post's quote count and quotedBy array
            await updateQuotedPost(quotedPost, userId);
            
            return json({
                success: true,
                post: postWithAttachments,
                quoteCount: (quotedPost.quoteCount || 0) + 1,
                quotedBy: [...(quotedPost.quotedBy || []), userId]
            });
        } else {
            // Create the post without attachments
            const newPost = await pb.collection('posts').create(postData);
            
            // Get the post with user expanded
            const postWithUser = await pb.collection('posts').getOne(newPost.id, {
                expand: 'user'
            });
            
            // Update the quoted post's quote count and quotedBy array
            await updateQuotedPost(quotedPost, userId);
            
            return json({
                success: true,
                post: postWithUser,
                quoteCount: (quotedPost.quoteCount || 0) + 1,
                quotedBy: [...(quotedPost.quotedBy || []), userId]
            });
        }
    } catch (error) {
        console.error('Error creating quote post:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create quote post';
        return json({ error: errorMessage }, { status: 500 });
    }
};

// Helper function to update the quoted post
async function updateQuotedPost(quotedPost: any, userId: string) {
    const quotedBy = quotedPost.quotedBy || [];
    const hasQuoted = quotedBy.includes(userId);
    
    if (!hasQuoted) {
        const updatedQuotedBy = [...quotedBy, userId];
        const quoteCount = (quotedPost.quoteCount || 0) + 1;
        
        await pb.collection('posts').update(quotedPost.id, {
            quotedBy: updatedQuotedBy,
            quoteCount: quoteCount
        });
    }
}

// Helper function to determine file type
function getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'document';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'code';
    return 'document';
}