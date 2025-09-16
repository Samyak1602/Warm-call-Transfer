import axios from 'axios';

/**
 * API route to proxy transfer requests to the backend
 * POST /api/transfer
 * 
 * Expected body: { fromRoom, agentA, agentB, newRoom?, transcript?, summary? }
 * Returns: { summary, newRoom, agentAToken, agentBToken, wsUrl }
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
    const { fromRoom, agentA, agentB, newRoom, transcript, summary } = req.body;

    // Validate required fields
    if (!fromRoom || !agentA || !agentB) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'fromRoom, agentA, and agentB are required'
      });
    }

    // Forward request to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await axios.post(`${backendUrl}/transfer`, {
      fromRoom,
      agentA,
      agentB,
      newRoom,
      transcript,
      summary
    });

    // Return the transfer data from backend
    return res.status(200).json(response.data);

  } catch (error) {
    console.error('Transfer API Error:', error);

    // Handle different types of errors
    if (error.response) {
      // Backend returned an error response
      return res.status(error.response.status).json({
        error: 'Backend error',
        message: error.response.data?.detail || 'Failed to initiate transfer'
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
        message: 'An unexpected error occurred during transfer'
      });
    }
  }
}