// src/lib/stores/participants-store.ts
import { writable, derived } from 'svelte/store';
import { callStore } from './call-store';

interface Participant {
    id: string;
    name: string;
    stream: MediaStream | null;
    isLocal: boolean;
    socketId?: string;
    joinedAt?: string;
    isActive?: boolean;
    connectionState?: RTCPeerConnectionState;
}

function createParticipantsStore() {
    const { subscribe, set, update } = writable<Participant[]>([]);

    return {
        subscribe,
        
        // Add participant
        addParticipant: (participant: Participant) => {
            update(participants => {
                const existing = participants.find(p => p.id === participant.id);
                if (existing) {
                    // Update existing participant
                    return participants.map(p => 
                        p.id === participant.id ? { ...p, ...participant } : p
                    );
                } else {
                    // Add new participant
                    return [...participants, participant];
                }
            });
        },

        // Remove participant
        removeParticipant: (participantId: string) => {
            update(participants => participants.filter(p => p.id !== participantId));
        },

        // Update participant stream
        updateParticipantStream: (participantId: string, stream: MediaStream | null) => {
            update(participants => 
                participants.map(p => 
                    p.id === participantId ? { ...p, stream } : p
                )
            );
        },

        // Update participant connection state
        updateConnectionState: (participantId: string, state: RTCPeerConnectionState) => {
            update(participants => 
                participants.map(p => 
                    p.id === participantId ? { ...p, connectionState: state } : p
                )
            );
        },

        // Clear all participants
        clear: () => {
            set([]);
        },

        // Initialize from WebRTC client
        initFromClient: () => {
            const client = callStore.getClient();
            if (!client) return;

            // Subscribe to WebRTC client updates
            client.participants.subscribe(webrtcParticipants => {
                update(currentParticipants => {
                    // Convert WebRTC participants to our format
                    const converted = webrtcParticipants.map(p => ({
                        id: p.socketId,
                        name: p.userId,
                        stream: null, // Will be updated separately
                        isLocal: false,
                        socketId: p.socketId,
                        joinedAt: p.joinedAt,
                        isActive: p.isActive,
                        connectionState: 'new' as RTCPeerConnectionState
                    }));

                    // Keep existing local participant if any
                    const localParticipant = currentParticipants.find(p => p.isLocal);
                    
                    return localParticipant ? [localParticipant, ...converted] : converted;
                });
            });

            // Subscribe to remote streams
            client.remoteStreams.subscribe(streamMap => {
                streamMap.forEach((stream, socketId) => {
                    update(participants => 
                        participants.map(p => 
                            p.socketId === socketId ? { ...p, stream } : p
                        )
                    );
                });
            });

            // Subscribe to local video
            client.localVideo.subscribe(localStream => {
                update(participants => {
                    const withoutLocal = participants.filter(p => !p.isLocal);
                    if (localStream) {
                        return [{
                            id: 'local',
                            name: 'You',
                            stream: localStream,
                            isLocal: true
                        }, ...withoutLocal];
                    }
                    return withoutLocal;
                });
            });

            // Subscribe to connection states
            client.connectionStates.subscribe(stateMap => {
                stateMap.forEach((state, socketId) => {
                    update(participants => 
                        participants.map(p => 
                            p.socketId === socketId ? { ...p, connectionState: state } : p
                        )
                    );
                });
            });
        }
    };
}

export const participantsStore = createParticipantsStore();
