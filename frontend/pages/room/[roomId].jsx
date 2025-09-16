"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Room } from 'livekit-client';
import LiveRoom from '../../components/LiveRoom';

export default function RoomPage() {
  const router = useRouter();
  const { roomId } = router.query;
  
  // Connection states
  const [connectionData, setConnectionData] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  
  // Transfer states
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStep, setTransferStep] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferData, setTransferData] = useState(null);
  
  // Form data
  const [agentIdentity, setAgentIdentity] = useState('');
  const [agentBIdentity, setAgentBIdentity] = useState('');
  const [transcript, setTranscript] = useState('');
  
  // Room instances
  const primaryRoomRef = useRef(null);
  const secondaryRoomRef = useRef(null);
  
  // Speech synthesis
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    // Check speech synthesis support
    setSpeechSupported('speechSynthesis' in window);
    
    // Auto-connect if we have room ID
    if (roomId && !connectionData) {
      // Default identity for demo purposes
      const defaultIdentity = `agent-${Date.now()}`;
      setAgentIdentity(defaultIdentity);
      connectToRoom(roomId, defaultIdentity);
    }
  }, [roomId]);

  const connectToRoom = async (room, identity) => {
    setIsConnecting(true);
    setConnectionError('');

    try {
      // Get token from our API
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity: identity,
          room: room
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get access token');
      }

      const data = await response.json();
      
      setConnectionData({
        token: data.token,
        wsUrl: data.wsUrl,
        identity: identity,
        room: room
      });

    } catch (err) {
      console.error('Connection error:', err);
      setConnectionError(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const initiateWarmTransfer = async () => {
    if (!agentBIdentity.trim()) {
      setTransferError('Please enter Agent B identity');
      return;
    }

    setIsTransferring(true);
    setTransferError('');
    setTransferStep('Initiating transfer...');

    try {
      // Step 1: Call backend transfer endpoint
      setTransferStep('Creating transfer room...');
      const transferResponse = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromRoom: roomId,
          agentA: agentIdentity,
          agentB: agentBIdentity,
          transcript: transcript.trim() || undefined,
          summary: transcript.trim() ? undefined : 'Call transfer initiated by Agent A'
        }),
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse.json();
        throw new Error(errorData.message || 'Transfer failed');
      }

      const transferResult = await transferResponse.json();
      setTransferData(transferResult);
      
      console.log('Transfer initiated:', transferResult);
      setTransferStep('Transfer room created. Connecting to Agent B...');

      // Step 2: Connect to secondary room for handoff
      setTransferStep('Connecting to handoff room...');
      const secondaryRoom = new Room();
      secondaryRoomRef.current = secondaryRoom;

      await secondaryRoom.connect(transferResult.wsUrl, transferResult.agentAToken);
      console.log('Connected to secondary room:', transferResult.newRoom);

      setTransferStep('Connected to Agent B room. Waiting for Agent B...');

      // Step 3: Enable microphone in secondary room
      try {
        await secondaryRoom.localParticipant.enableMicrophone();
        console.log('Microphone enabled in secondary room');
      } catch (micError) {
        console.warn('Failed to enable microphone in secondary room:', micError);
      }

      // Step 4: Wait a moment then speak the summary
      setTimeout(() => {
        speakSummary(transferResult.summary);
      }, 2000);

    } catch (err) {
      console.error('Transfer failed:', err);
      setTransferError(err.message);
      setTransferStep('');
    } finally {
      // Don't set transferring to false yet - will do after summary is spoken
    }
  };

  const speakSummary = (summary) => {
    if (!speechSupported) {
      setTransferStep('Speech synthesis not supported. Please manually explain to Agent B.');
      setIsTransferring(false);
      return;
    }

    setTransferStep('Speaking summary to Agent B...');
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(summary);
    
    // Configure speech
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      console.log('Started speaking summary');
    };

    utterance.onend = () => {
      console.log('Finished speaking summary');
      setIsSpeaking(false);
      setTransferStep('Summary delivered. Ready to complete transfer.');
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      setTransferStep('Speech failed. Please manually explain to Agent B.');
    };

    // Speak the summary
    window.speechSynthesis.speak(utterance);
  };

  const completeTransfer = async () => {
    setTransferStep('Completing transfer...');

    try {
      // Disconnect from primary room (leaving caller with Agent B)
      if (primaryRoomRef.current) {
        await primaryRoomRef.current.disconnect();
        console.log('Disconnected from primary room');
      }

      // Keep secondary room connected for a bit longer
      setTransferStep('Transfer completed! Agent B should now handle the caller.');
      
      // Clean up after a delay
      setTimeout(() => {
        if (secondaryRoomRef.current) {
          secondaryRoomRef.current.disconnect();
          console.log('Disconnected from secondary room');
        }
        setIsTransferring(false);
        setTransferStep('');
      }, 5000);

    } catch (err) {
      console.error('Error completing transfer:', err);
      setTransferError(`Error completing transfer: ${err.message}`);
    }
  };

  const cancelTransfer = () => {
    // Clean up secondary room if exists
    if (secondaryRoomRef.current) {
      secondaryRoomRef.current.disconnect();
      secondaryRoomRef.current = null;
    }

    // Stop speech if speaking
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    setIsTransferring(false);
    setTransferStep('');
    setTransferData(null);
    setTransferError('');
  };

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Agent Console - Room: {roomId}
              </h1>
              <p className="text-sm text-gray-600">
                Connected as: {agentIdentity}
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Primary Room Connection */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Current Call Room
            </h2>
            
            {connectionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{connectionError}</p>
              </div>
            )}

            {isConnecting && (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Connecting to room...</p>
              </div>
            )}

            {connectionData && (
              <LiveRoom 
                wsUrl={connectionData.wsUrl} 
                token={connectionData.token}
                ref={primaryRoomRef}
              />
            )}
          </div>

          {/* Transfer Controls */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Warm Transfer Controls
            </h2>

            {!isTransferring ? (
              <div className="space-y-4">
                {/* Agent B Identity */}
                <div>
                  <label htmlFor="agentB" className="block text-sm font-medium text-gray-700 mb-1">
                    Agent B Identity *
                  </label>
                  <input
                    id="agentB"
                    type="text"
                    value={agentBIdentity}
                    onChange={(e) => setAgentBIdentity(e.target.value)}
                    placeholder="e.g., agent-bob, support-002"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Transcript/Notes */}
                <div>
                  <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 mb-1">
                    Call Notes/Transcript (Optional)
                  </label>
                  <textarea
                    id="transcript"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Enter call summary, customer issue, or any notes for Agent B..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Transfer Button */}
                <button
                  onClick={initiateWarmTransfer}
                  disabled={!agentBIdentity.trim()}
                  className={`w-full py-3 px-4 rounded-md text-white font-medium ${
                    agentBIdentity.trim()
                      ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      : 'bg-gray-400 cursor-not-allowed'
                  } transition-colors`}
                >
                  Initiate Warm Transfer
                </button>

                {/* Speech Support Info */}
                <div className="text-xs text-gray-500">
                  {speechSupported 
                    ? '✓ Text-to-speech supported for summary delivery'
                    : '⚠️ Text-to-speech not supported in this browser'
                  }
                </div>
              </div>
            ) : (
              /* Transfer Progress */
              <div className="space-y-4">
                {/* Transfer Status */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">
                    Transfer in Progress
                  </h3>
                  <p className="text-sm text-blue-700">{transferStep}</p>
                  
                  {isSpeaking && (
                    <div className="mt-2 flex items-center text-sm text-blue-700">
                      <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      Speaking summary...
                    </div>
                  )}
                </div>

                {/* Transfer Data Preview */}
                {transferData && (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">
                      Transfer Details:
                    </h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>New Room: {transferData.newRoom}</div>
                      <div>Agent B: {agentBIdentity}</div>
                      <div className="mt-2">
                        <strong>Summary:</strong>
                        <div className="mt-1 text-sm bg-white p-2 rounded border">
                          {transferData.summary}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  {transferStep.includes('Ready to complete') && (
                    <button
                      onClick={completeTransfer}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                    >
                      Complete Transfer
                    </button>
                  )}
                  
                  <button
                    onClick={cancelTransfer}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancel Transfer
                  </button>
                </div>
              </div>
            )}

            {/* Transfer Error */}
            {transferError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <h3 className="text-sm font-medium text-red-800">Transfer Error</h3>
                <p className="text-sm text-red-700 mt-1">{transferError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}