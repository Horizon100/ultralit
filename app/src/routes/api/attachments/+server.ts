// src/routes/api/attachments/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Upload a new attachment
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Parse the multipart form data
        const formData = await request.formData();
        
        // Ensure createdBy is set
        formData.append('createdBy', locals.user.id);
        
        // Create the attachment record
        const attachment = await pb.collection('attachments').create(formData);
        
        // Get the file URL
        const fileUrl = pb.getFileUrl(attachment, attachment.file);
        
        return json({
            id: attachment.id,
            fileName: attachment.fileName,
            file: attachment.file,
            url: fileUrl,
            note: attachment.note || ''
        });
    } catch (error) {
        console.error('Error uploading attachment:', error);
        return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Failed to upload attachment' 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};


