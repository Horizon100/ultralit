import { io, Socket } from 'socket.io-client';

export class SignalingClient {
  private socket: Socket;

  constructor(url: string) {
    this.socket = io(url);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.socket.on('connect', () => {
      console.log('Connected to signaling server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
    });
  }

  joinRoom(roomId: string, userId: string): void {
    this.socket.emit('join-room', { roomId, userId });
  }

  sendOffer(offer: RTCSessionDescriptionInit, targetUserId: string): void {
    this.socket.emit('offer', { offer, targetUserId });
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetUserId: string): void {
    this.socket.emit('answer', { answer, targetUserId });
  }
}
