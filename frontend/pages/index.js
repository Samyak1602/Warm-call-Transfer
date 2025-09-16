import { useState } from 'react';
import { Room } from 'livekit-client';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

export default function Home() {
  const [formData, setFormData] = useState({
    identity: '',
    room: '',
    role: 'caller'
  });
  const [connectionData, setConnectionData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate form data
      if (!formData.identity || !formData.room) {
        throw new Error('Please fill in all required fields');
      }

      // Call our API to get token
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity: formData.identity,
          room: formData.room
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get access token');
      }

      const data = await response.json();
      
      // Store connection data for LiveKit
      setConnectionData({
        token: data.token,
        wsUrl: data.wsUrl,
        identity: formData.identity,
        room: formData.room,
        role: formData.role
      });

    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setConnectionData(null);
    setIsConnected(false);
    setFormData({
      identity: '',
      room: '',
      role: 'caller'
    });
  };

  const handleConnected = () => {
    setIsConnected(true);
  };

  const handleDisconnected = () => {
    setIsConnected(false);
  };

  // If we have connection data, show the room
  if (connectionData) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  LiveKit Room: {connectionData.room}
                </h1>
                <p className="text-sm text-gray-600">
                  Connected as: {connectionData.identity} ({connectionData.role})
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>

        {/* LiveKit Room */}
        <div className="flex-1 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
              <LiveKitRoom
                video={true}
                audio={true}
                token={connectionData.token}
                serverUrl={connectionData.wsUrl}
                data-lk-theme="default"
                style={{ height: '100%' }}
                onConnected={handleConnected}
                onDisconnected={handleDisconnected}
              >
                <VideoConference />
              </LiveKitRoom>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="fixed bottom-4 right-4">
          <div className={`px-3 py-2 rounded-full text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </div>
    );
  }

  // Show the connection form
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">LiveKit Warm Transfer</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your details to join a room
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identity Input */}
            <div>
              <label htmlFor="identity" className="block text-sm font-medium text-gray-700">
                Identity *
              </label>
              <div className="mt-1">
                <input
                  id="identity"
                  name="identity"
                  type="text"
                  required
                  value={formData.identity}
                  onChange={handleInputChange}
                  placeholder="e.g., agent-001, caller-123"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Unique identifier for this session
              </p>
            </div>

            {/* Room Input */}
            <div>
              <label htmlFor="room" className="block text-sm font-medium text-gray-700">
                Room Name *
              </label>
              <div className="mt-1">
                <input
                  id="room"
                  name="room"
                  type="text"
                  required
                  value={formData.room}
                  onChange={handleInputChange}
                  placeholder="e.g., support-call-001"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Name of the room to join
              </p>
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <div className="mt-1">
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="caller">Caller</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Your role in the call
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Connection Error
                    </h3>
                    <div className="mt-1 text-sm text-red-700">
                      {error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                } transition-colors`}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Connecting...
                  </div>
                ) : (
                  'Join Room'
                )}
              </button>
            </div>
          </form>

          {/* Info Section */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="text-sm text-gray-600">
              <h4 className="font-medium text-gray-900 mb-2">Quick Start:</h4>
              <ul className="space-y-1 text-xs">
                <li>• Enter a unique identity (e.g., your name or ID)</li>
                <li>• Enter or create a room name</li>
                <li>• Select your role (caller or agent)</li>
                <li>• Click "Join Room" to connect</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}