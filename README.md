# Matrix 2.0

This is rendition of Hebbia’s hero product called Matrix.

##  🔐 Environment Variables

Before running the backend, make sure you create a `.env` file inside the `backend/` directory with your API keys:

### Required `.env` Format

```env
# .env (place in /backend)

OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

##  ⚙️ Setup

To run the app locally, follow these steps:

### 1. Client

```bash
cd frontend/
npm run dev
```

### 2. Server

```bash
cd backend/
source venv/bin/activate
uvicorn main:app --reload
```

##  🚀 Launch

Now open http://localhost:3000 and start extracting your data!
