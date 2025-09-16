# LiveKit Warm Call Transfer

A real-time communication application enabling warm call transfers using LiveKit, built with FastAPI backend and Next.js frontend.

## Project Structure

```
├── README.md
├── .gitignore
├── docker-compose.yml
├── backend/
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── app/
│       └── main.py
└── frontend/
    ├── package.json
    └── README.md
```

## Features

- **Real-time Communication**: Video/audio calls using LiveKit
- **Warm Transfers**: Seamless call handoff between agents
- **Twilio Integration**: Phone system connectivity
- **OpenAI Integration**: AI-powered call analysis and transcription
- **Modern Stack**: FastAPI backend + Next.js frontend

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **LiveKit** - Real-time communication platform
- **Twilio** - Phone and messaging services
- **OpenAI** - AI-powered features

### Frontend
- **Next.js** - React framework
- **LiveKit Components** - Pre-built React components
- **Tailwind CSS** - Utility-first styling

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository
2. Copy environment variables:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Update the `.env` file with your API keys
4. Start the services:
   ```bash
   docker-compose up
   ```

### Manual Setup

#### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Update .env with your API keys
uvicorn app.main:app --reload
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

See `backend/.env.example` for required environment variables:
- LiveKit server credentials
- OpenAI API key
- Twilio account details

## Development

- Backend API: http://localhost:8000
- Frontend: http://localhost:3000
- API Documentation: http://localhost:8000/docs

## License

This project is licensed under the MIT License.