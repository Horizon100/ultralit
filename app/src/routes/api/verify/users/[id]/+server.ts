import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params }) =>
  apiTryCatch(async () => {
    interface PocketBaseUser {
      id: string;
      name?: string;
      username?: string;
      email?: string;
      description?: string;
      role?: string;
      created?: string;
      updated?: string;
      verified?: boolean;
      theme_preference?: string;
      wallpaper_preference?: string;
      profileWallpaper?: string;
      model?: string | null;
      selected_provider?: string | null;
      prompt_preference?: string;
      sysprompt_preference?: string;
      model_preference?: string;
      avatar?: string;
      taskAssignments?: string[];
      last_login?: string;
      status?: 'online' | 'offline';
      userTaskStatus?: {
        backlog: number;
        todo: number;
        inprogress: number;
        focus: number;
        done: number;
        hold: number;
        postpone: number;
        cancel: number;
        review: number;
        delegate: number;
        archive: number;
      };
      expand?: {
        verification?: {
          status?: string;
          updated?: string;
        };
      };
    }

    function sanitizeUser(user: PocketBaseUser) {
      return {
        id: user.id,
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        description: user.description || '',
        role: user.role || '',
        created: user.created || '',
        updated: user.updated || '',
        verified: user.verified || false,
        theme_preference: user.theme_preference || '',
        wallpaper_preference: user.wallpaper_preference || '',
        model: user.model || null,
        selected_provider: user.selected_provider || null,
        prompt_preference: user.prompt_preference || '',
        sysprompt_preference: user.sysprompt_preference || '',
        api_keys: {},
        verification_status: user.expand?.verification?.status || '',
        last_verified: user.expand?.verification?.updated || '',
        model_preference: user.model_preference,
        taskAssignments: user.taskAssignments || [],
        userTaskStatus: user.userTaskStatus || {
          backlog: 0,
          todo: 0,
          inprogress: 0,
          focus: 0,
          done: 0,
          hold: 0,
          postpone: 0,
          cancel: 0,
          review: 0,
          delegate: 0,
          archive: 0
        },
        ...(user.avatar && { avatar: user.avatar })
      };
    }

    if (!params.id) {
      throw new Error('User ID is required');
    }

    const userResult = await pbTryCatch(pb.collection('users').getOne(params.id, { expand: 'verification' }), 'fetch user');
    const user = unwrap(userResult);

    return { success: true, user: sanitizeUser(user) };
  }, 'Failed to fetch user data', 400);

export const PATCH: RequestHandler = async ({ params, request, locals }) =>
  apiTryCatch(async () => {
    interface PocketBaseUser {
      id: string;
      name?: string;
      username?: string;
      email?: string;
      description?: string;
      role?: string;
      created?: string;
      updated?: string;
      verified?: boolean;
      theme_preference?: string;
      wallpaper_preference?: string;
      profileWallpaper?: string;
      model?: string | null;
      selected_provider?: string | null;
      prompt_preference?: string;
      sysprompt_preference?: string;
      model_preference?: string;
      avatar?: string;
      taskAssignments?: string[];
      userTaskStatus?: {
        backlog: number;
        todo: number;
        inprogress: number;
        focus: number;
        done: number;
        hold: number;
        postpone: number;
        cancel: number;
        review: number;
        delegate: number;
        archive: number;
      };
      expand?: {
        verification?: {
          status?: string;
          updated?: string;
        };
      };
    }

    interface UpdateData {
      [key: string]: string | File | null | undefined | string[] | Record<string, number>;
      updated: string;
    }

    function sanitizeUser(user: PocketBaseUser) {
      return {
        id: user.id,
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        description: user.description || '',
        role: user.role || '',
        created: user.created || '',
        updated: user.updated || '',
        verified: user.verified || false,
        theme_preference: user.theme_preference || '',
        wallpaper_preference: user.wallpaper_preference || '',
        profileWallpaper: user.profileWallpaper || '',
        model: user.model || null,
        selected_provider: user.selected_provider || null,
        prompt_preference: user.prompt_preference || '',
        sysprompt_preference: user.sysprompt_preference || '',
        api_keys: {},
        verification_status: user.expand?.verification?.status || '',
        last_verified: user.expand?.verification?.updated || '',
        model_preference: user.model_preference,
        taskAssignments: user.taskAssignments || [],
        userTaskStatus: user.userTaskStatus || {
          backlog: 0,
          todo: 0,
          inprogress: 0,
          focus: 0,
          done: 0,
          hold: 0,
          postpone: 0,
          cancel: 0,
          review: 0,
          delegate: 0,
          archive: 0
        },
        ...(user.avatar && { avatar: user.avatar })
      };
    }

    if (!locals.user?.id) {
      throw new Error('Authentication required');
    }

    if (params.id !== locals.user.id) {
      throw new Error('You can only update your own user data');
    }

    const contentType = request.headers.get('content-type') || '';
    const updateData: UpdateData = {
      updated: new Date().toISOString()
    };

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const MAX_FILE_SIZE = 2 * 1024 * 1024;

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          if (value.size > MAX_FILE_SIZE && key === 'avatar') {
            throw new Error('Avatar file size exceeds 2MB limit');
          }
          updateData[key] = value;
        } else {
          updateData[key] = value;
        }
      }
    } else {
      const data = (await request.json()) as Record<string, unknown>;

      const allowedFields = [
        'name',
        'username',
        'description',
        'email',
        'model',
        'selected_provider',
        'theme',
        'language',
        'prompt_preference',
        'sysprompt_preference',
        'avatar',
        'model_preference',
        'theme_preference',
        'wallpaper_preference',
        'profileWallpaper',
        'taskAssignments',
        'userTaskStatus'
      ] as const;

      for (const field of allowedFields) {
        if (field in data) {
          if (field === 'taskAssignments') {
            const taskAssignments = data[field];
            if (Array.isArray(taskAssignments)) {
              updateData[field] = taskAssignments.filter((item) => typeof item === 'string');
            }
          } else if (field === 'userTaskStatus') {
            const userTaskStatus = data[field];
            if (userTaskStatus && typeof userTaskStatus === 'object') {
              updateData[field] = {
                backlog: 0,
                todo: 0,
                inprogress: 0,
                focus: 0,
                done: 0,
                hold: 0,
                postpone: 0,
                cancel: 0,
                review: 0,
                delegate: 0,
                archive: 0,
                ...(userTaskStatus as Record<string, number>)
              };
            }
          } else {
            updateData[field] = data[field] as string;
          }
        }
      }
    }

    const updatedResult = await pbTryCatch(pb.collection('users').update(params.id, updateData), 'update user');
    const updated = unwrap(updatedResult);

    return { success: true, user: sanitizeUser(updated) };
  }, 'Update failed', 400);
