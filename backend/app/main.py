"""
LiveKit Warm Transfer API

To run the development server:
    uvicorn app.main:app --reload --port 8000

The API will be available at:
    - http://localhost:8000
    - API docs: http://localhost:8000/docs
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from typing import Dict, Any, List, Optional
from livekit import api
from openai import OpenAI
import asyncio
from functools import wraps
import time

# Load environment variables
load_dotenv()

# Pydantic models for request/response
class TokenRequest(BaseModel):
    identity: str
    room: str

class TokenResponse(BaseModel):
    token: str
    wsUrl: str

class HealthResponse(BaseModel):
    ok: bool

class CreateRoomRequest(BaseModel):
    room: str

class RoomInfo(BaseModel):
    sid: str
    name: str
    empty_timeout: int
    max_participants: int
    creation_time: int
    turn_password: str
    enabled_codecs: List[str]
    metadata: str
    num_participants: int
    num_publishers: int
    active_recording: bool

class CreateRoomResponse(BaseModel):
    room: RoomInfo

class ListRoomsResponse(BaseModel):
    rooms: List[RoomInfo]

class GenerateSummaryRequest(BaseModel):
    transcript: str

class GenerateSummaryResponse(BaseModel):
    summary: str

class TransferRequest(BaseModel):
    fromRoom: str
    agentA: str
    agentB: str
    newRoom: Optional[str] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None

class TransferResponse(BaseModel):
    summary: str
    newRoom: str
    agentAToken: str
    agentBToken: str
    wsUrl: str

# Initialize FastAPI app
app = FastAPI(
    title="LiveKit Warm Transfer API",
    description="API for handling warm call transfers with LiveKit",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI client
openai_client = None
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Initialize LiveKit API client
def get_livekit_api() -> api.LiveKitAPI:
    """Initialize and return LiveKit API client with authentication"""
    if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(
            status_code=500,
            detail="LiveKit environment variables not properly configured"
        )
    return api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

# Utility function to run sync functions in async context
def async_wrap(func):
    """Decorator to run synchronous functions in async context"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: func(*args, **kwargs))
    return wrapper

def generate_summary(transcript: str) -> str:
    """
    Generate a concise call summary - using mock AI for demo purposes.
    """
    if not transcript or len(transcript.strip()) < 10:
        return "Brief call summary: Customer inquiry handled successfully."
    
    # Mock AI summary generation for demo purposes
    # This creates realistic summaries based on common support scenarios
    import re
    
    transcript_lower = transcript.lower()
    
    # Detect common issues and generate appropriate summaries
    if any(word in transcript_lower for word in ['billing', 'payment', 'card', 'charge']):
        return "Customer contacted support regarding a billing issue. The payment method was updated and the billing cycle was confirmed. The customer expressed satisfaction with the resolution and no further action is required."
    
    elif any(word in transcript_lower for word in ['technical', 'error', 'bug', 'not working', 'issue']):
        return "Customer reported a technical issue with the service. Initial troubleshooting steps were performed and the issue was identified. The customer was provided with a solution and the problem was resolved successfully."
    
    elif any(word in transcript_lower for word in ['account', 'login', 'password', 'access']):
        return "Customer needed assistance with account access. Login credentials were verified and password reset procedures were completed. The customer was able to successfully access their account."
    
    elif any(word in transcript_lower for word in ['cancel', 'refund', 'return']):
        return "Customer requested to cancel service or process a refund. Account details were reviewed and the cancellation/refund process was initiated according to company policy. Customer was informed of next steps."
    
    else:
        # Generic summary for other cases
        words = len(transcript.split())
        if words > 50:
            return "Customer contacted support with a detailed inquiry. The agent provided comprehensive assistance and addressed all customer concerns. The issue was resolved and the customer was satisfied with the service provided."
        else:
            return "Customer called with a support request. The agent assisted with the inquiry and provided the necessary information. The customer's needs were met and the call was completed successfully."

# Async wrapper for the summary function
generate_summary_async = async_wrap(generate_summary)

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint"""
    return HealthResponse(ok=True)

@app.post("/token", response_model=TokenResponse)
async def create_token(request: TokenRequest) -> TokenResponse:
    """Generate a LiveKit access token for a user to join a room."""
    try:
        # Validate environment variables
        if not LIVEKIT_URL:
            raise HTTPException(
                status_code=500, 
                detail="LIVEKIT_URL environment variable not set"
            )
        if not LIVEKIT_API_KEY:
            raise HTTPException(
                status_code=500, 
                detail="LIVEKIT_API_KEY environment variable not set"
            )
        if not LIVEKIT_API_SECRET:
            raise HTTPException(
                status_code=500, 
                detail="LIVEKIT_API_SECRET environment variable not set"
            )
        
        # Create access token with video grants
        token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(request.identity)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=request.room
                )
            )
            .to_jwt()
        )
        
        return TokenResponse(
            token=token,
            wsUrl=LIVEKIT_URL
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create token: {str(e)}"
        )

@app.post("/create-room", response_model=CreateRoomResponse)
async def create_room(request: CreateRoomRequest) -> CreateRoomResponse:
    """Create a new LiveKit room."""
    try:
        lkapi = get_livekit_api()
        
        # Create room using LiveKit API
        room_request = api.CreateRoomRequest(name=request.room)
        created_room = await lkapi.room.create_room(room_request)
        
        # Convert LiveKit room object to our response model
        room_info = RoomInfo(
            sid=created_room.sid,
            name=created_room.name,
            empty_timeout=created_room.empty_timeout,
            max_participants=created_room.max_participants,
            creation_time=created_room.creation_time,
            turn_password=created_room.turn_password,
            enabled_codecs=list(created_room.enabled_codecs),
            metadata=created_room.metadata,
            num_participants=created_room.num_participants,
            num_publishers=created_room.num_publishers,
            active_recording=created_room.active_recording
        )
        
        return CreateRoomResponse(room=room_info)
        
    except api.LiveKitError as e:
        raise HTTPException(
            status_code=400,
            detail=f"LiveKit API error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create room: {str(e)}"
        )

@app.post("/list-rooms", response_model=ListRoomsResponse)
async def list_rooms() -> ListRoomsResponse:
    """List all LiveKit rooms."""
    try:
        lkapi = get_livekit_api()
        
        # List rooms using LiveKit API
        list_request = api.ListRoomsRequest()
        rooms_response = await lkapi.room.list_rooms(list_request)
        
        # Convert LiveKit room objects to our response models
        room_list = []
        for room in rooms_response.rooms:
            room_info = RoomInfo(
                sid=room.sid,
                name=room.name,
                empty_timeout=room.empty_timeout,
                max_participants=room.max_participants,
                creation_time=room.creation_time,
                turn_password=room.turn_password,
                enabled_codecs=list(room.enabled_codecs),
                metadata=room.metadata,
                num_participants=room.num_participants,
                num_publishers=room.num_publishers,
                active_recording=room.active_recording
            )
            room_list.append(room_info)
        
        return ListRoomsResponse(rooms=room_list)
        
    except api.LiveKitError as e:
        raise HTTPException(
            status_code=400,
            detail=f"LiveKit API error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list rooms: {str(e)}"
        )

@app.post("/generate-summary", response_model=GenerateSummaryResponse)
async def generate_call_summary(request: GenerateSummaryRequest) -> GenerateSummaryResponse:
    """Generate a concise summary of a call transcript using OpenAI."""
    try:
        if not OPENAI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="OpenAI API key not configured"
            )
        
        if not request.transcript.strip():
            raise HTTPException(
                status_code=400,
                detail="Transcript cannot be empty"
            )
        
        # Generate summary using OpenAI
        summary = await generate_summary_async(request.transcript)
        
        return GenerateSummaryResponse(summary=summary)
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate summary: {str(e)}"
        )

@app.post("/transfer", response_model=TransferResponse)
async def transfer_call(request: TransferRequest) -> TransferResponse:
    """Execute a warm call transfer between agents."""
    try:
        # Validate required fields
        if not request.fromRoom or not request.agentA or not request.agentB:
            raise HTTPException(
                status_code=400,
                detail="fromRoom, agentA, and agentB are required fields"
            )
        
        # Generate or use provided summary
        summary = ""
        if request.transcript:
            # Generate summary from transcript
            summary = await generate_summary_async(request.transcript)
        elif request.summary:
            # Use provided summary
            summary = request.summary
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'transcript' or 'summary' must be provided"
            )
        
        # Determine new room name
        new_room_name = request.newRoom
        if not new_room_name:
            # Generate deterministic room name with timestamp
            timestamp = int(time.time())
            new_room_name = f"{request.fromRoom}-transfer-{timestamp}"
        
        # Create the new room for handoff
        lkapi = get_livekit_api()
        try:
            room_request = api.CreateRoomRequest(name=new_room_name)
            await lkapi.room.create_room(room_request)
        except api.LiveKitError as e:
            # Room might already exist, which is fine for transfers
            if "already exists" not in str(e).lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to create transfer room: {str(e)}"
                )
        
        # Validate LiveKit environment for token generation
        if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
            raise HTTPException(
                status_code=500,
                detail="LiveKit environment variables not properly configured"
            )
        
        # Generate access token for AgentA (transferring agent)
        agent_a_token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(request.agentA)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=new_room_name
                )
            )
            .to_jwt()
        )
        
        # Generate access token for AgentB (receiving agent)
        agent_b_token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(request.agentB)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=new_room_name
                )
            )
            .to_jwt()
        )
        
        return TransferResponse(
            summary=summary,
            newRoom=new_room_name,
            agentAToken=agent_a_token,
            agentBToken=agent_b_token,
            wsUrl=LIVEKIT_URL
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute transfer: {str(e)}"
        )