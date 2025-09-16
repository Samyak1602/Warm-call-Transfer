import axios from 'axios';

/**
 * API route to move caller to a new room (for warm transfer completion)
 * POST /api/move-caller
 * 
 * Expected body: { callerIdentity, newRoom }
 * Returns: { token, wsUrl }
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests' 
    });
  }

  try {
    const { callerIdentity, newRoom } = req.body;

    // Validate required fields
    if (!callerIdentity || !newRoom) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'callerIdentity and newRoom are required'
      });
    }

    // Generate token for caller to join the new room
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await axios.post(`${backendUrl}/token`, {
      identity: callerIdentity,
      room: newRoom
    });

    // Return the token data for caller to join new room
    return res.status(200).json(response.data);

  } catch (error) {
    console.error('Move Caller API Error:', error);

    // Handle different types of errors
    if (error.response) {
      // Backend returned an error response
      return res.status(error.response.status).json({
        error: 'Backend error',
        message: error.response.data?.detail || 'Failed to generate caller token'
      });
    } else if (error.request) {
      // Network error - backend not reachable
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Cannot connect to backend service. Please ensure the backend is running.'
      });
    } else {
      // Other error
      return res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while moving caller'
      });
    }
  }
}