// src/lib/features/webrtc/services/webrtc-client.ts
import { io, type Socket } from 'socket.io-client';
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

interface Participant {
    userId: string;
    socketId: string;
    joinedAt: string;
    isActive: boolean;
    streamCount: number;
}

interface WebRTCConfig {
    iceServers: RTCIceServer[];
    iceTransportPolicy: RTCIceTransportPolicy;
    bundlePolicy: RTCBundlePolicy;
    rtcpMuxPolicy: RTCRtcpMuxPolicy;
}

interface StreamInfo {
    id: string;
    userId: string;
    type: 'video' | 'audio' | 'screen';
    startedAt: Date;
    active: boolean;
}

export class WebRTCClient {
    private socket: Socket | null = null;
    private peerConnections = new Map<string, RTCPeerConnection>();
    private localStream: MediaStream | null = null;
    private config: WebRTCConfig | null = null;
    private currentRoomId: string | null = null;
    private currentUserId: string | null = null;
    
    // Svelte stores for reactive UI updates
    public participants: Writable<Participant[]> = writable([]);
    public isConnected: Writable<boolean> = writable(false);
    public currentRoom: Writable<string | null> = writable(null);
    public localVideo: Writable<MediaStream | null> = writable(null);
    public remoteStreams: Writable<Map<string, MediaStream>> = writable(new Map());
    public connectionStates: Writable<Map<string, RTCPeerConnectionState>> = writable(new Map());
    public isInitialized: Writable<boolean> = writable(false);

constructor(private signalingUrl: string = 'ws://100.77.36.61:3025') {
        if (browser) {
            this.initialize();
        }
    }

    async initialize(): Promise<void> {
        if (!browser) return;
        
        try {
            console.log('Initializing WebRTC client...');
            
            // Get TURN server configuration
            const response = await fetch('/api/webrtc/turn');
            if (!response.ok) {
                throw new Error(`Failed to fetch TURN config: ${response.statusText}`);
            }
            
            this.config = await response.json();
            console.log('WebRTC configuration loaded:', this.config);
            
            this.isInitialized.set(true);
        } catch (error) {
            console.error('Failed to load WebRTC configuration:', error);
            
            // Use fallback configuration
            this.config = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ],
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            };
            
            this.isInitialized.set(true);
            console.log('Using fallback WebRTC configuration');
        }
    }

    async connect(): Promise<void> {
        if (!browser) {
            throw new Error('WebRTC client can only be used in browser environment');
        }

        if (this.socket?.connected) {
            console.log('Already connected to signaling server');
            return;
        }

        return new Promise((resolve, reject) => {
            console.log('Connecting to signaling server:', this.signalingUrl);
            
            this.socket = io(this.signalingUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                maxReconnectionAttempts: 5,
                forceNew: true
            });

            this.socket.on('connect', () => {
                console.log('Connected to signaling server, socket ID:', this.socket?.id);
                this.isConnected.set(true);
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('Signaling server connection failed:', error);
                this.isConnected.set(false);
                reject(new Error(`Connection failed: ${error.message}`));
            });

            this.socket.on('disconnect', (reason) => {
                console.log('Disconnected from signaling server:', reason);
                this.isConnected.set(false);
                this.cleanup();
            });

            this.setupSignalingHandlers();
        });
    }

    private setupSignalingHandlers(): void {
        if (!this.socket) return;

        // Handle existing participants when joining a room
        this.socket.on('existing-participants', (participants: Participant[]) => {
            console.log('Existing participants:', participants);
            this.participants.set(participants);
            
            // Create peer connections for existing participants
            participants.forEach(participant => {
                if (participant.socketId !== this.socket?.id) {
                    this.createPeerConnection(participant.socketId, true); // true = initiator
                }
            });
        });

        // Handle new user joining
        this.socket.on('user-joined', ({ userId, socketId }: { userId: string; socketId: string }) => {
            console.log('User joined:', userId, socketId);
            
            if (socketId !== this.socket?.id) {
                this.participants.update(current => [...current, { 
                    userId, 
                    socketId, 
                    joinedAt: new Date().toISOString(),
                    isActive: true,
                    streamCount: 0
                }]);
                
                // Create peer connection for new user (we are not the initiator)
                this.createPeerConnection(socketId, false);
            }
        });

        // Handle user leaving
        this.socket.on('user-left', ({ socketId }: { socketId: string }) => {
            console.log('User left:', socketId);
            this.participants.update(current => current.filter(p => p.socketId !== socketId));
            this.closePeerConnection(socketId);
        });

        // Handle WebRTC signaling
        this.socket.on('webrtc-signal', async ({ signal, from, type }) => {
            if (from !== this.socket?.id) {
                await this.handleSignal(signal, from, type);
            }
        });

        // Handle errors
        this.socket.on('room-error', ({ error, code }) => {
            console.error('Room error:', error, code);
            alert(`Room error: ${error}`);
        });
    }

    async joinRoom(roomId: string, userId: string): Promise<void> {
        if (!this.socket?.connected) {
            throw new Error('Not connected to signaling server');
        }

        console.log('Joining room:', roomId, 'as user:', userId);
        this.currentRoomId = roomId;
        this.currentUserId = userId;
        this.currentRoom.set(roomId);
        
        // Get local media stream first
        try {
            await this.getLocalStream();
        } catch (error) {
            console.warn('Could not get local stream:', error);
            // Continue without local stream - user might join as viewer only
        }
        
        // Join the room via signaling server
        this.socket.emit('join-room', { roomId, userId });
        
        // Register stream start with API
        try {
            await fetch('/api/webrtc/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId,
                    userId,
                    action: 'start',
                    streamType: 'video'
                })
            });
        } catch (error) {
            console.warn('Failed to register stream with API:', error);
        }
    }

    async leaveRoom(): Promise<void> {
        if (this.currentRoomId && this.currentUserId) {
            // Stop all streams
            try {
                await fetch('/api/webrtc/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: this.currentRoomId,
                        userId: this.currentUserId,
                        action: 'stop'
                    })
                });
            } catch (error) {
                console.warn('Failed to stop stream via API:', error);
            }
        }

        this.cleanup();
        this.currentRoom.set(null);
        this.currentRoomId = null;
        this.currentUserId = null;
    }

async getLocalStream(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    if (!browser) {
        throw new Error('Camera access only available in browser');
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not available - running in insecure context or unsupported browser');
        throw new Error('Media devices not available. Please use HTTPS or localhost.');
    }

    const defaultConstraints: MediaStreamConstraints = {
        video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 15 }
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
        }
    };

    try {
            // Stop existing stream if any
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            this.localStream = await navigator.mediaDevices.getUserMedia(
                constraints || defaultConstraints
            );
            
            console.log('Local stream acquired:', this.localStream.getTracks().map(t => `${t.kind}: ${t.label}`));
            this.localVideo.set(this.localStream);
            
            // Add stream to existing peer connections
            this.peerConnections.forEach((pc, socketId) => {
                this.localStream?.getTracks().forEach(track => {
                    const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
                    if (sender) {
                        sender.replaceTrack(track);
                    } else {
                        pc.addTrack(track, this.localStream!);
                    }
                });
            });
            
            return this.localStream;
        } catch (error) {
            console.error('Failed to get local stream:', error);
            throw new Error(`Camera/microphone access denied: ${error.message}`);
        }
    }

    async getScreenShare(): Promise<MediaStream> {
        if (!browser) {
            throw new Error('Screen sharing only available in browser');
        }

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: true
            });

            console.log('Screen share stream acquired');
            
            // Replace video track in peer connections
            this.peerConnections.forEach((pc, socketId) => {
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender && videoTrack) {
                    sender.replaceTrack(videoTrack);
                }
            });

            // Update local video to show screen share
            this.localVideo.set(screenStream);
            
            // Handle screen share ending
            screenStream.getVideoTracks()[0].onended = () => {
                console.log('Screen sharing ended');
                this.getLocalStream(); // Switch back to camera
            };

            return screenStream;
        } catch (error) {
            console.error('Failed to get screen share:', error);
            throw new Error(`Screen sharing failed: ${error.message}`);
        }
    }

    private createPeerConnection(remoteSocketId: string, isInitiator: boolean): RTCPeerConnection {
        if (!this.config) {
            throw new Error('WebRTC configuration not loaded');
        }

        console.log(`Creating peer connection for: ${remoteSocketId}, initiator: ${isInitiator}`);
        
        const pc = new RTCPeerConnection(this.config);
        this.peerConnections.set(remoteSocketId, pc);

        // Add local stream tracks if available
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
                console.log(`Added ${track.kind} track to peer connection`);
            });
        }

        // Handle incoming remote streams
        pc.ontrack = (event) => {
            console.log('Received remote stream from:', remoteSocketId);
            const [remoteStream] = event.streams;
            
            this.remoteStreams.update(streams => {
                const newStreams = new Map(streams);
                newStreams.set(remoteSocketId, remoteStream);
                return newStreams;
            });
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && this.socket) {
                console.log('Sending ICE candidate to:', remoteSocketId);
                this.socket.emit('webrtc-signal', {
                    signal: event.candidate,
                    targetSocketId: remoteSocketId,
                    type: 'ice-candidate'
                });
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log(`Connection state for ${remoteSocketId}: ${pc.connectionState}`);
            
            this.connectionStates.update(states => {
                const newStates = new Map(states);
                newStates.set(remoteSocketId, pc.connectionState);
                return newStates;
            });
            
            if (pc.connectionState === 'failed') {
                console.log('Connection failed, attempting ICE restart for:', remoteSocketId);
                this.restartIce(remoteSocketId);
            } else if (pc.connectionState === 'disconnected') {
                console.log('Connection disconnected for:', remoteSocketId);
                // Wait a bit before cleaning up in case it reconnects
                setTimeout(() => {
                    if (pc.connectionState === 'disconnected') {
                        this.closePeerConnection(remoteSocketId);
                    }
                }, 5000);
            }
        };

        // Handle ICE connection state changes
        pc.oniceconnectionstatechange = () => {
            console.log(`ICE connection state for ${remoteSocketId}: ${pc.iceConnectionState}`);
        };

        // If we're the initiator, create and send offer
        if (isInitiator) {
            // Small delay to ensure tracks are added
            setTimeout(() => {
                this.createAndSendOffer(pc, remoteSocketId);
            }, 100);
        }

        return pc;
    }

    private async createAndSendOffer(pc: RTCPeerConnection, remoteSocketId: string): Promise<void> {
        try {
            console.log('Creating offer for:', remoteSocketId);
            
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await pc.setLocalDescription(offer);
            console.log('Local description set, sending offer to:', remoteSocketId);
            
            if (this.socket) {
                this.socket.emit('webrtc-signal', {
                    signal: offer,
                    targetSocketId: remoteSocketId,
                    type: 'offer'
                });
            }
        } catch (error) {
            console.error('Failed to create offer for:', remoteSocketId, error);
        }
    }

    private async handleSignal(signal: any, from: string, type: string): Promise<void> {
        console.log(`Handling ${type} signal from:`, from);
        
        let pc = this.peerConnections.get(from);
        
        // Create peer connection if it doesn't exist (for answer/ice-candidate)
        if (!pc && (type === 'answer' || type === 'ice-candidate')) {
            console.log('Creating peer connection for incoming signal from:', from);
            pc = this.createPeerConnection(from, false);
        }
        
        if (!pc) {
            console.warn('No peer connection found for:', from);
            return;
        }

        try {
            switch (type) {
                case 'offer':
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    console.log('Remote description set for offer from:', from);
                    
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    console.log('Answer created and local description set for:', from);
                    
                    if (this.socket) {
                        this.socket.emit('webrtc-signal', {
                            signal: answer,
                            targetSocketId: from,
                            type: 'answer'
                        });
                        console.log('Answer sent to:', from);
                    }
                    break;

                case 'answer':
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    console.log('Remote description set for answer from:', from);
                    break;

                case 'ice-candidate':
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal));
                        console.log('ICE candidate added for:', from);
                    } else {
                        console.warn('Received ICE candidate before remote description for:', from);
                        // Queue the candidate for later
                        setTimeout(() => {
                            if (pc?.remoteDescription) {
                                pc.addIceCandidate(new RTCIceCandidate(signal));
                            }
                        }, 1000);
                    }
                    break;

                default:
                    console.warn('Unknown signal type:', type);
            }
        } catch (error) {
            console.error(`Failed to handle ${type} signal from ${from}:`, error);
        }
    }

    private async restartIce(remoteSocketId: string): Promise<void> {
        const pc = this.peerConnections.get(remoteSocketId);
        if (!pc) return;

        try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            
            if (this.socket) {
                this.socket.emit('webrtc-signal', {
                    signal: offer,
                    targetSocketId: remoteSocketId,
                    type: 'offer'
                });
            }
            
            console.log('ICE restart initiated for:', remoteSocketId);
        } catch (error) {
            console.error('Failed to restart ICE for:', remoteSocketId, error);
        }
    }

    private closePeerConnection(socketId: string): void {
        const pc = this.peerConnections.get(socketId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(socketId);
            
            this.remoteStreams.update(streams => {
                const newStreams = new Map(streams);
                newStreams.delete(socketId);
                return newStreams;
            });
            
            this.connectionStates.update(states => {
                const newStates = new Map(states);
                newStates.delete(socketId);
                return newStates;
            });
            
            console.log('Closed peer connection for:', socketId);
        }
    }

    private cleanup(): void {
        console.log('Cleaning up WebRTC client');
        
        // Close all peer connections
        this.peerConnections.forEach((pc, socketId) => {
            pc.close();
        });
        this.peerConnections.clear();
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Clear stores
        this.participants.set([]);
        this.remoteStreams.set(new Map());
        this.localVideo.set(null);
        this.connectionStates.set(new Map());
    }

    disconnect(): void {
        this.cleanup();
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected.set(false);
        this.currentRoom.set(null);
    }

    // Utility methods
    toggleAudio(): void {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                console.log('Audio toggled:', audioTrack.enabled ? 'on' : 'off');
            }
        }
    }

    toggleVideo(): void {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                console.log('Video toggled:', videoTrack.enabled ? 'on' : 'off');
            }
        }
    }

    async getActiveStreams(): Promise<StreamInfo[]> {
        if (!this.currentRoomId || !this.currentUserId) return [];
        
        try {
            const response = await fetch('/api/webrtc/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: this.currentRoomId,
                    userId: this.currentUserId,
                    action: 'list'
                })
            });
            
            const data = await response.json();
            return data.streams || [];
        } catch (error) {
            console.error('Failed to get active streams:', error);
            return [];
        }
    }
}