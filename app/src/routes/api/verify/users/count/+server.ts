import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async () =>
  apiTryCatch(async () => {
    const resultList = await pbServer.pb.collection('users').getList(1, 1, {
      sort: '-created'
    });

    const count = resultList.totalItems;

    return json({
      success: true,
      count
    });
  }, 'Failed to get user count');
