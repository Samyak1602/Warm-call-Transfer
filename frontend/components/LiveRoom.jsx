"use client";

import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

/**
 * LiveRoom Component
 * 
 * A React component that manages LiveKit room connection and audio streaming.
 * Handles participant management, audio tracks, and connection lifecycle.
 * 
 * Props:
 * - wsUrl: LiveKit WebSocket URL
 * - token: JWT access token for room authentication
 */
export default function LiveRoom({ wsUrl, token }) {
  const [room, setRoom] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false);
  
  // Ref to store room instance for cleanup
  const roomRef = useRef(null);
  
  useEffect(() => {
    if (!wsUrl || !token) {
      console.warn('LiveRoom: Missing wsUrl or token');
      return;
    }

    connectToRoom();

    // Cleanup on unmount
    return () => {
      disconnectFromRoom();
    };
  }, [wsUrl, token]);

  const connectToRoom = async () => {
    console.log('LiveRoom: Attempting to connect to room...');
    setIsConnecting(true);
    setError(null);

    try {
      // Create new room instance
      const newRoom = new Room();
      roomRef.current = newRoom;
      setRoom(newRoom);

      // Set up event listeners before connecting
      setupRoomEventListeners(newRoom);

      // Connect to the room
      console.log('LiveRoom: Connecting to', wsUrl);
      await newRoom.connect(wsUrl, token);
      
      console.log('LiveRoom: Successfully connected to room');
      setIsConnected(true);

      // Enable local microphone after connection
      try {
        console.log('LiveRoom: Enabling local microphone...');
        await newRoom.localParticipant.enableMicrophone();
        setLocalAudioEnabled(true);
        console.log('LiveRoom: Local microphone enabled');
      } catch (micError) {
        console.warn('LiveRoom: Failed to enable microphone:', micError);
        // Continue even if microphone fails - user might not have one or denied permission
      }

    } catch (err) {
      console.error('LiveRoom: Connection failed:', err);
      setError(`Failed to connect: ${err.message}`);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const setupRoomEventListeners = (room) => {
    console.log('LiveRoom: Setting up room event listeners');

    // When a participant connects
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('LiveRoom: Participant connected:', participant.identity);
      updateParticipantsList(room);
    });

    // When a participant disconnects
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('LiveRoom: Participant disconnected:', participant.identity);
      updateParticipantsList(room);
    });

    // When a track is subscribed (e.g., audio from remote participant)
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('LiveRoom: Track subscribed:', track.kind, 'from', participant.identity);
      
      if (track.kind === Track.Kind.Audio) {
        // Automatically play audio tracks
        const audioElement = track.attach();
        audioElement.play().catch(e => 
          console.warn('LiveRoom: Failed to autoplay audio:', e)
        );
        document.body.appendChild(audioElement);
      }
      
      updateParticipantsList(room);
    });

    // When a track is unsubscribed
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('LiveRoom: Track unsubscribed:', track.kind, 'from', participant.identity);
      
      // Detach and remove audio elements
      track.detach().forEach(element => {
        element.remove();
      });
      
      updateParticipantsList(room);
    });

    // Connection quality updates
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      console.log('LiveRoom: Connection quality changed for', 
        participant?.identity || 'local', ':', quality);
    });

    // Room disconnected
    room.on(RoomEvent.Disconnected, (reason) => {
      console.log('LiveRoom: Room disconnected:', reason);
      setIsConnected(false);
      setParticipants([]);
    });

    // Connection state changes
    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('LiveRoom: Connection state changed:', state);
    });
  };

  const updateParticipantsList = (room) => {
    if (!room || !room.remoteParticipants) return;
    
    try {
      const remoteParticipants = Array.from(room.remoteParticipants.values()).map(participant => ({
        identity: participant.identity,
        isSpeaking: participant.isSpeaking,
        audioTrack: participant.getTrackPublication(Track.Source.Microphone)?.track,
        metadata: participant.metadata
      }));
      
      console.log('LiveRoom: Updated participants list:', remoteParticipants.map(p => p.identity));
      setParticipants(remoteParticipants);
    } catch (error) {
      console.error('LiveRoom: Error updating participants list:', error);
      setParticipants([]);
    }
  };

  const disconnectFromRoom = async () => {
    if (roomRef.current) {
      console.log('LiveRoom: Disconnecting from room...');
      
      try {
        // Remove all audio elements
        document.querySelectorAll('audio').forEach(audio => {
          if (audio.srcObject) {
            audio.remove();
          }
        });
        
        // Disconnect from room
        await roomRef.current.disconnect();
        console.log('LiveRoom: Successfully disconnected');
      } catch (err) {
        console.error('LiveRoom: Error during disconnect:', err);
      }
      
      roomRef.current = null;
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
      setLocalAudioEnabled(false);
    }
  };

  const toggleMicrophone = async () => {
    if (!room) return;
    
    try {
      if (localAudioEnabled) {
        await room.localParticipant.disableMicrophone();
        setLocalAudioEnabled(false);
        console.log('LiveRoom: Microphone disabled');
      } else {
        await room.localParticipant.enableMicrophone();
        setLocalAudioEnabled(true);
        console.log('LiveRoom: Microphone enabled');
      }
    } catch (err) {
      console.error('LiveRoom: Failed to toggle microphone:', err);
      setError(`Microphone error: ${err.message}`);
    }
  };

  // Render the component
  return (
    <div className="live-room p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          LiveKit Room Connection
        </h2>
        
        {/* Connection Status */}
        <div className="flex items-center space-x-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500' : 
            isConnecting ? 'bg-yellow-500' : 
            'bg-red-500'
          }`}></div>
          <span className="text-sm text-gray-600">
            {isConnecting ? 'Connecting...' : 
             isConnected ? 'Connected' : 
             'Disconnected'}
          </span>
        </div>

        {/* Local Controls */}
        {isConnected && (
          <div className="mb-4">
            <button
              onClick={toggleMicrophone}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                localAudioEnabled 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              } transition-colors`}
            >
              {localAudioEnabled ? '🎤 Mute' : '🔇 Unmute'}
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button
            onClick={connectToRoom}
            className="mt-2 text-sm text-red-700 hover:text-red-900 underline"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Participants List */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          Participants ({participants.length + (isConnected ? 1 : 0)})
        </h3>
        
        <div className="space-y-2">
          {/* Local Participant */}
          {isConnected && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900">
                  You (Local)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  localAudioEnabled 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {localAudioEnabled ? 'Audio On' : 'Audio Off'}
                </span>
              </div>
            </div>
          )}

          {/* Remote Participants */}
          {participants.map((participant) => (
            <div key={participant.identity} 
                 className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  participant.isSpeaking ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <span className="text-sm font-medium text-gray-900">
                  {participant.identity}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  participant.audioTrack 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {participant.audioTrack ? 'Audio On' : 'Audio Off'}
                </span>
                {participant.isSpeaking && (
                  <span className="text-xs text-green-600">Speaking</span>
                )}
              </div>
            </div>
          ))}

          {/* No participants message */}
          {participants.length === 0 && isConnected && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No other participants in the room
            </div>
          )}
        </div>
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer font-medium">Debug Info</summary>
            <div className="mt-2 space-y-1">
              <div>WebSocket URL: {wsUrl}</div>
              <div>Token: {token ? `${token.substring(0, 20)}...` : 'None'}</div>
              <div>Room Instance: {room ? 'Created' : 'None'}</div>
              <div>Participants Count: {participants.length}</div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}