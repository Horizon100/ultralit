import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { userId } = await request.json();
    const { id } = params;
    
    if (!id) {
      return json({ 
        success: false, 
        message: 'No invitation code ID provided' 
      }, { status: 400 });
    }
    
    if (!userId) {
      return json({ 
        success: false, 
        message: 'No user ID provided' 
      }, { status: 400 });
    }
    
    try {
      const invitationCode = await pb.collection('invitation_codes').getOne(id);
      
      if (invitationCode.used) {
        return json({
          success: false,
          message: 'Invitation code has already been used'
        }, { status: 400 });
      }
      
      console.log(`Updating invitation code ${id} for user ${userId}`);
      
      const updateData = {
        "used": true,
        "usedBy": userId,
        "usedAt": new Date().toISOString()
      };
      
      console.log('Update data:', JSON.stringify(updateData));
      
      const result = await pb.collection('invitation_codes').update(id, updateData);
      
      console.log('Update result:', JSON.stringify(result));
      
      return json({
        success: true,
        message: 'Invitation code marked as used',
        result: result
      });
    } catch (error) {
      console.error('Error marking invitation code as used:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      return json({
        success: false,
        message: 'Failed to mark invitation code as used: ' + (error.message || String(error))
      }, { status: error.status || 500 });
    }
  } catch (error) {
    console.error('Server error marking invitation code as used:', error);
    return json({
      success: false,
      message: 'Server error processing invitation code'
    }, { status: 500 });
  }
};