import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const DELETE: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) throw new Error('Unauthorized');

		const attachmentResult = await pbTryCatch(
			pb.collection('attachments').getOne(params.id),
			'fetch attachment'
		);
		const attachment = unwrap(attachmentResult);

		if (attachment.createdBy !== locals.user.id) {
			let hasAccess = false;

			if (attachment.attachedTasks) {
				const taskIds = attachment.attachedTasks.split(',');

				for (const taskId of taskIds) {
					if (!taskId) continue;

					try {
						const taskResult = await pbTryCatch(
							pb.collection('tasks').getOne(taskId),
							`fetch task ${taskId}`
						);
						const task = unwrap(taskResult);

						if (task.createdBy === locals.user.id) {
							hasAccess = true;
							break;
						}

						if (task.project_id) {
							try {
								const projectResult = await pbTryCatch(
									pb.collection('projects').getOne(task.project_id),
									`fetch project ${task.project_id}`
								);
								const project = unwrap(projectResult);

								if (project.owner === locals.user.id) {
									hasAccess = true;
									break;
								}
							} catch (e) {
								console.warn(
									`Could not check project ${task.project_id}: ${e instanceof Error ? e.message : 'Unknown error'}`
								);
							}
						}
					} catch (e) {
						console.warn(
							`Could not check task ${taskId}: ${e instanceof Error ? e.message : 'Unknown error'}`
						);
					}
				}
			}

			if (!hasAccess && attachment.attachedProjects) {
				const projectIds = attachment.attachedProjects.split(',');

				for (const projectId of projectIds) {
					if (!projectId) continue;

					try {
						const projectResult = await pbTryCatch(
							pb.collection('projects').getOne(projectId),
							`fetch project ${projectId}`
						);
						const project = unwrap(projectResult);

						if (project.owner === locals.user.id) {
							hasAccess = true;
							break;
						}
					} catch (e) {
						console.warn(
							`Could not check project ${projectId}: ${e instanceof Error ? e.message : 'Unknown error'}`
						);
					}
				}
			}

			if (!hasAccess) {
				throw new Error('Unauthorized');
			}
		}

		await pbTryCatch(pb.collection('attachments').delete(params.id), 'delete attachment');

		return json({ success: true });
	}, 'Failed to delete attachment');
