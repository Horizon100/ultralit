import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TURN_SERVER, TURN_PORT, TURN_USERNAME, TURN_PASSWORD } from '$env/static/private';

export const GET: RequestHandler = async () => {
    return json({
        iceServers: [
            {
                urls: [
                    `turn:${TURN_SERVER}:${TURN_PORT}?transport=udp`,
                    `turn:${TURN_SERVER}:${TURN_PORT}?transport=tcp`
                ],
                username: TURN_USERNAME,
                credential: TURN_PASSWORD
            },
            {
                urls: [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302'
                ]
            }
        ],
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 0
    });
};