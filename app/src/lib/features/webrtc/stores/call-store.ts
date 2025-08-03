// src/lib/features/webrtc/stores/call-store.ts
import { writable, derived } from 'svelte/store';
import { WebRTCClient } from '$lib/features/webrtc/services/webrtc-client';
import { browser } from '$app/environment';

interface CallState {
    isInCall: boolean;
    isConnecting: boolean;
    roomId: string | null;
    userId: string | null;
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    isScreenSharing: boolean;
    error: string | null;
}

// Create the call store
function createCallStore() {
    const { subscribe, set, update } = writable<CallState>({
        isInCall: false,
        isConnecting: false,
        roomId: null,
        userId: null,
        isVideoEnabled: true,
        isAudioEnabled: true,
        isScreenSharing: false,
        error: null
    });

    let webrtcClient: WebRTCClient | null = null;

    return {
        subscribe,
        
        // Initialize WebRTC client
        init: async () => {
            if (!browser || webrtcClient) return;
            
            try {
                webrtcClient = new WebRTCClient();
                await webrtcClient.initialize();
                console.log('WebRTC client initialized');
            } catch (error) {
                console.error('Failed to initialize WebRTC client:', error);
                update(state => ({ ...state, error: `Initialization failed: ${error.message}` }));
            }
        },

        // Join a room
        joinRoom: async (roomId: string, userId: string) => {
            if (!webrtcClient) {
                throw new Error('WebRTC client not initialized');
            }

            update(state => ({ ...state, isConnecting: true, error: null }));

            try {
                await webrtcClient.connect();
                await webrtcClient.joinRoom(roomId, userId);
                
                update(state => ({
                    ...state,
                    isInCall: true,
                    isConnecting: false,
                    roomId,
                    userId
                }));
                
                console.log(`Joined room ${roomId} as ${userId}`);
            } catch (error) {
                console.error('Failed to join room:', error);
                update(state => ({
                    ...state,
                    isConnecting: false,
                    error: `Failed to join room: ${error.message}`
                }));
                throw error;
            }
        },

        // Leave the current room
        leaveRoom: async () => {
            if (!webrtcClient) return;

            try {
                await webrtcClient.leaveRoom();
                update(state => ({
                    ...state,
                    isInCall: false,
                    roomId: null,
                    userId: null,
                    error: null
                }));
                console.log('Left room');
            } catch (error) {
                console.error('Failed to leave room:', error);
                update(state => ({ ...state, error: `Failed to leave room: ${error.message}` }));
            }
        },

        // Toggle video
        toggleVideo: () => {
            if (!webrtcClient) return;
            
            webrtcClient.toggleVideo();
            update(state => ({ ...state, isVideoEnabled: !state.isVideoEnabled }));
        },

        // Toggle audio
        toggleAudio: () => {
            if (!webrtcClient) return;
            
            webrtcClient.toggleAudio();
            update(state => ({ ...state, isAudioEnabled: !state.isAudioEnabled }));
        },

        // Start screen sharing
        startScreenShare: async () => {
            if (!webrtcClient) return;

            try {
                await webrtcClient.getScreenShare();
                update(state => ({ 
                    ...state, 
                    isScreenSharing: true,
                    isVideoEnabled: true // Screen sharing enables video
                }));
            } catch (error) {
                console.error('Failed to start screen sharing:', error);
                update(state => ({ ...state, error: `Screen sharing failed: ${error.message}` }));
            }
        },

        // Stop screen sharing
        stopScreenShare: async () => {
            if (!webrtcClient) return;

            try {
                await webrtcClient.getLocalStream(); // Switch back to camera
                update(state => ({ ...state, isScreenSharing: false }));
            } catch (error) {
                console.error('Failed to stop screen sharing:', error);
                update(state => ({ ...state, error: `Failed to stop screen sharing: ${error.message}` }));
            }
        },

        // Clear error
        clearError: () => {
            update(state => ({ ...state, error: null }));
        },

        // Get WebRTC client instance
        getClient: () => webrtcClient,

        // Cleanup
        destroy: () => {
            if (webrtcClient) {
                webrtcClient.disconnect();
                webrtcClient = null;
            }
            set({
                isInCall: false,
                isConnecting: false,
                roomId: null,
                userId: null,
                isVideoEnabled: true,
                isAudioEnabled: true,
                isScreenSharing: false,
                error: null
            });
        }
    };
}

// Export the store and actions
export const callStore = createCallStore();
export const { toggleVideo, toggleAudio } = callStore;