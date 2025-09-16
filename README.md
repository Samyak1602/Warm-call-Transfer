# LiveKit Warm Call Transfer

A real-time communication application enabling seamless warm call transfers using LiveKit, built with FastAPI backend and Next.js frontend. This system demonstrates professional call center capabilities with AI-powered summaries and text-to-speech handoff explanations.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   FastAPI       │    │   LiveKit       │
│   Frontend      │◄──►│   Backend       │◄──►│   Server        │
│                 │    │                 │    │                 │
│ • Room UI       │    │ • Token Gen     │    │ • Room Mgmt     │
│ • Transfer Flow │    │ • Room API      │    │ • Audio/Video   │
│ • TTS Controls  │    │ • Transfer API  │    │ • Participants  │
│ • Agent Console │    │ • AI Summaries  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   OpenAI API    │              │
         └──────────────┤   (GPT-3.5)     │──────────────┘
                        │ • Call Summary  │
                        │ • Transcription │
                        └─────────────────┘
```

### System Components

- **Frontend (Next.js)**: User interface for agents and callers
- **Backend (FastAPI)**: API server handling LiveKit integration and AI processing
- **LiveKit Server**: Real-time communication infrastructure
- **OpenAI API**: AI-powered call summarization
- **Twilio** (Optional): Phone system integration

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18 or later
- **Python** 3.11 or later
- **LiveKit Server** (cloud or self-hosted)
- **OpenAI API Key**
- **Twilio Account** (optional)

### Environment Variables

Create `backend/.env` with the following variables:

```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Twilio Configuration (Optional)
TWILIO_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM=+1234567890
```

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env with your actual API keys

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The backend will be available at:
- **API**: http://localhost:8000
- **Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Start the Next.js development server
npm run dev
```

The frontend will be available at:
- **Application**: http://localhost:3000
- **Room Interface**: http://localhost:3000/room/[roomId]

## 🎬 Demo Flow for Recording

### Step 1: Setup Participants

1. **Start both servers** (backend on :8000, frontend on :3000)
2. **Open 3 browser tabs/windows**:
   - Tab 1: Caller - `http://localhost:3000`
   - Tab 2: Agent A - `http://localhost:3000/room/support-call-001`
   - Tab 3: Agent B - `http://localhost:3000`

### Step 2: Connect Caller and Agent A

**Caller (Tab 1):**
```
Identity: caller-123
Room: support-call-001
Role: Caller
→ Click "Join Room"
```

**Agent A (Tab 2):**
- Should auto-connect to room `support-call-001`
- Verify both participants appear in the room
- Test audio connection

### Step 3: Initiate Warm Transfer

**Agent A (Tab 2):**
```
Agent B Identity: agent-bob
Caller Identity: caller-123
Call Notes: "Customer needs billing support. Account #12345. Issue with recent charge."
→ Click "Initiate Warm Transfer"
```

**Expected Results:**
- Transfer room created (e.g., `support-call-001-transfer-1726502400`)
- Agent A connects to handoff room
- Summary generated via OpenAI
- TTS speaks summary automatically

### Step 4: Agent B Joins Handoff

**Agent B (Tab 3):**
```
Identity: agent-bob
Room: support-call-001-transfer-1726502400  (from Agent A's screen)
Role: Agent
→ Click "Join Room"
```

**Expected Results:**
- Agent B joins handoff room with Agent A
- Both agents can communicate
- Summary is heard by Agent B

### Step 5: Complete Transfer

**Agent A (Tab 2):**
```
→ Wait for TTS summary to complete
→ Click "Move Caller to Agent B"
```

**Expected Results:**
- Caller token generated for handoff room
- Agent A disconnects from original room
- Transfer completed

### Alternative Flow: Agent B to Original Room

**Agent B (Tab 3):**
```
→ Disconnect from handoff room
→ Navigate to http://localhost:3000
Identity: agent-bob
Room: support-call-001  (original room)
Role: Agent
→ Click "Join Room"
```

**Expected Results:**
- Agent B now handles the caller in original room
- Warm transfer complete

## 📚 API Reference

### Authentication & Room Management

#### Generate Access Token
```bash
curl -X POST http://localhost:8000/token \
  -H "Content-Type: application/json" \
  -d '{
    "identity": "agent-001",
    "room": "support-call-001"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "wsUrl": "wss://your-livekit-server.com"
}
```

#### Create Room
```bash
curl -X POST http://localhost:8000/create-room \
  -H "Content-Type: application/json" \
  -d '{
    "room": "support-call-001"
  }'
```

**Response:**
```json
{
  "room": {
    "sid": "RM_abc123",
    "name": "support-call-001",
    "creation_time": 1726502400,
    "num_participants": 0,
    "max_participants": 50
  }
}
```

#### List Rooms
```bash
curl -X POST http://localhost:8000/list-rooms \
  -H "Content-Type: application/json"
```

### AI & Transfer Operations

#### Generate Call Summary
```bash
curl -X POST http://localhost:8000/generate-summary \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Customer called about billing issue. Account number 12345. Charge of $99.99 appears incorrect. Customer has been loyal for 3 years. Needs immediate resolution."
  }'
```

**Response:**
```json
{
  "summary": "Customer reports incorrect $99.99 charge on account #12345. Long-term customer (3 years) requiring urgent billing resolution. Recommend immediate account review and potential credit adjustment."
}
```

#### Initiate Warm Transfer
```bash
curl -X POST http://localhost:8000/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "fromRoom": "support-call-001",
    "agentA": "agent-alice",
    "agentB": "agent-bob",
    "transcript": "Customer needs billing support for account #12345"
  }'
```

**Response:**
```json
{
  "summary": "Customer requires billing assistance for account #12345. Issue involves disputed charge requiring specialist review.",
  "newRoom": "support-call-001-transfer-1726502400",
  "agentAToken": "eyJhbGciOiJIUzI1NiIs...",
  "agentBToken": "eyJhbGciOiJIUzI1NiIs...",
  "wsUrl": "wss://your-livekit-server.com"
}
```

## 🛠️ Development

### Project Structure

```
├── README.md
├── .gitignore
├── docker-compose.yml
├── backend/
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── app/
│       └── main.py                 # FastAPI application
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── pages/
│   │   ├── index.js               # Main connection page
│   │   ├── room/[roomId].jsx      # Agent room interface
│   │   └── api/
│   │       ├── token.js           # Token proxy
│   │       ├── transfer.js        # Transfer proxy
│   │       └── move-caller.js     # Caller move API
│   ├── components/
│   │   └── LiveRoom.jsx           # LiveKit room component
│   └── styles/
│       └── globals.css
```

### Docker Development

```bash
# Copy environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Start all services
docker-compose up

# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

### Available Scripts

#### Backend
```bash
# Development server
uvicorn app.main:app --reload --port 8000

# Production server
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Install dependencies
pip install -r requirements.txt
```

#### Frontend
```bash
# Development server
npm run dev

# Production build
npm run build
npm start

# Install dependencies
npm install
```

## 🔧 Configuration

### LiveKit Server Setup

1. **LiveKit Cloud**: Sign up at [livekit.io](https://livekit.io)
2. **Self-hosted**: Follow [LiveKit deployment guide](https://docs.livekit.io/deploy/)
3. **Local development**: Use LiveKit local server for testing

### OpenAI API

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Generate API key
3. Add to environment variables

### Twilio Integration (Optional)

1. Create Twilio account
2. Get Account SID and Auth Token
3. Purchase phone number
4. Configure webhooks (future enhancement)

## 🚨 Troubleshooting

### Common Issues

**Backend won't start:**
- Check Python version (3.11+ required)
- Verify all environment variables are set
- Ensure no other service is using port 8000

**Frontend build fails:**
- Check Node.js version (18+ required)
- Clear node_modules: `rm -rf node_modules && npm install`
- Verify Tailwind CSS configuration

**LiveKit connection fails:**
- Verify LIVEKIT_URL is correct (wss:// protocol)
- Check API key and secret are valid
- Ensure LiveKit server is accessible

**TTS not working:**
- Check browser compatibility (Chrome recommended)
- Verify audio permissions
- Test in different browser

### Debug Mode

Enable debug logging:

**Backend:**
```bash
export LOG_LEVEL=DEBUG
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
export NODE_ENV=development
npm run dev
```

## 📈 Production Considerations

### Performance
- Use production LiveKit deployment
- Implement connection pooling
- Add caching for frequently accessed data
- Optimize bundle size

### Security
- Implement proper authentication
- Use HTTPS/WSS in production
- Rotate API keys regularly
- Validate all inputs

### Scalability
- Use load balancers for multiple backend instances
- Implement horizontal scaling
- Consider CDN for frontend assets
- Monitor resource usage

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📞 Support

For questions and support:
- Create GitHub issue
- Check LiveKit documentation
- Review API documentation at `/docs`