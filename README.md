# Sceudl - AI-Powered Study Scheduler & Calendar

An intelligent study scheduling application that combines calendar management with AI-powered study planning using Google's Gemini API.

Features

- 📅 Interactive Calendar - Week, day, and month views with drag-and-drop event management
- 🤖 AI Study Planner - Generate personalized study schedules based on class times and goals
- 📄 PDF Management - Upload and download calendar data
- 🎨 Modern UI - Beautiful glassmorphic design with smooth animations
- 🌓 Theme Support - Built-in theme provider for customization

Project Structure

```
sceudl/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── loading.tsx        # Loading component
│   └── page.tsx           # Main calendar page
├── components/            # React components
│   ├── scheduler/         # Study scheduler components
│   │   └── ai-study-scheduler.tsx
│   ├── ui/               # shadcn/ui components
│   └── theme-provider.tsx
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── mcp-server/           # Backend API server
│   ├── server.js         # Express + MCP server
│   ├── client.js         # MCP client
│   └── ws-server.js      # WebSocket server
├── public/               # Static assets
└── styles/              # Additional styles
```

Tech Stack

Frontend
- Next.js 14 - React framework with App Router
- TypeScript - Type-safe development
- Tailwind CSS - Utility-first styling
- shadcn/ui - High-quality UI components
- Lucide React - Beautiful icons

Backend
- Express.js - Web server
- Google Gemini API - AI-powered schedule generation
- MCP SDK - Model Context Protocol support
- CORS - Cross-origin resource sharing

Getting Started

Prerequisites
- Node.js 18+
- npm or yarn
- Google Gemini API key ([Get one here](https://ai.google.dev/gemini-api/docs/api-key))

Installation

1. Clone the repository
   ```bash
   git clone <your-repo-url>
   cd sceudl
   ```

2. Install dependencies
   ```bash
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   cd mcp-server
   npm install
   cd ..
   ```

3. Set up environment variables

   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

Running the Application

1. Start the backend server (in one terminal)
   ```bash
   cd mcp-server
   npm start
   ```
   Server will run on `http://localhost:3000`

2. Start the frontend (in another terminal)
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:3001` (or next available port)

3. Open your browser
   Navigate to `http://localhost:3001` (or the port shown in terminal)

Usage

Calendar Features
- View Switching: Toggle between Day, Week, and Month views
- Event Management: Click on events to view details
- Drag & Drop: Rearrange events by dragging them to new time slots
- Mini Calendar: Quick date navigation in the sidebar

AI Study Scheduler

1. Click the "AI Study Planner" button in the sidebar
2. Enter your class times (one per line, e.g., "Mon 10:30 - 11:30")
3. Enter your study goals (comma-separated)
4. Click "Generate Schedule"
5. Review the AI-generated schedule
6. Click "Add to Calendar" to populate your calendar with study tasks
7. Optionally download the schedule as HTML

Example Input

Class Times:
```
Mon 10:30 - 11:30
Wed 14:00 - 15:00
Fri 09:00 - 10:00
```

Study Goals:
```
Finish math homework, Read history chapter, Practice coding, Study biology notes
```

API Endpoints

Backend Server (`http://localhost:3000`)

- POST /schedule - Generate AI study schedule
  ```json
  {
    "classTimes": ["Mon 10:30 - 11:30"],
    "studyGoals": "Finish homework, Study for exam"
  }
  ```

- POST /mcp - MCP protocol endpoint for tool interactions

Development

Key Files

- [app/page.tsx](app/page.tsx) - Main calendar component with state management
- [components/scheduler/ai-study-scheduler.tsx](components/scheduler/ai-study-scheduler.tsx) - Study scheduler modal
- [mcp-server/server.js](mcp-server/server.js) - Backend API and Gemini integration

Adding New Features

1. New UI Components: Use shadcn/ui CLI
   ```bash
   npx shadcn-ui@latest add [component-name]
   ```

2. New API Endpoints: Add to `mcp-server/server.js`

3. Styling: Use Tailwind classes or update `app/globals.css`

Configuration

Tailwind Config
See [tailwind.config.js](tailwind.config.js) for theme customization

TypeScript Config
See [tsconfig.json](tsconfig.json) for TypeScript settings

Next.js Config
See [next.config.mjs](next.config.mjs) for build settings

Troubleshooting

Backend Issues
- Ensure your Gemini API key is valid and set in `.env`
- Check that port 3000 is not in use
- Verify CORS settings in `mcp-server/server.js`

Frontend Issues
- Clear `.next` cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check that port 3001 is available

Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

License

This project is open source and available under the MIT License.

Acknowledgments

- [Next.js](https://nextjs.org/)
- [Google Gemini API](https://ai.google.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
