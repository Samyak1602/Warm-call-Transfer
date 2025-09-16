# LiveKit Warm Transfer Frontend

This is the frontend application for the LiveKit warm call transfer system, built with Next.js and React.

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Real-time video/audio calls using LiveKit
- Warm call transfer functionality
- React components for call management
- Tailwind CSS for styling

## Tech Stack

- **Next.js** - React framework
- **LiveKit Client** - Real-time communication
- **@livekit/components-react** - Pre-built LiveKit React components
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls

## Development

The application connects to the backend API running on `http://localhost:8000` by default.

## Build

To create a production build:

```bash
npm run build
npm start
```