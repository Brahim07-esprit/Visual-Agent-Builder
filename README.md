# Visual Agent Builder 🚀

Hey! I built this tool because I was tired of writing the same LangGraph code over and over. Now you can just drag, drop, and connect nodes to build AI agents - no coding needed!
Not only that, but becasue with n8n, you can't export your agent as an executable Python script.

## What's this?

It's basically like draw.io but for AI agents. You visually create conversation flows and the app generates the Python code for you.

## Watch the Demo

https://github.com/user-attachments/assets/80bfae95-e77a-47fe-b8b5-a86770c0831e


## Getting Started

### What you'll need
- Node.js & npm (for the UI)
- Python 3.11+ (for the backend)
- An OpenAI API key

### Setting it up

1. **Backend first:**
```bash
cd agent-builder/backend
echo "OPENAI_API_KEY=your-key-here" > .env
pip install -r requirements.txt
python main.py
```

2. **Then the frontend:**
```bash
cd agent-builder/frontend
npm install
npm start
```

Or just run `./start.sh` from the agent-builder folder if you're feeling lazy like me 😄

## How to use it

1. **Drag nodes** from the sidebar - you've got Regular nodes (basic responses) and Router nodes (for branching logic)
2. **Connect them** - drag from bottom to top handles, always start from START and end at END
3. **Double-click to configure** - add your prompts and routing rules
4. **Test it** - hit "Run Agent" and chat with your creation
5. **Export** - get your agent as Python code or save the config as JSON

### Example: Support Bot

Here's what I usually do for a basic support bot:
- START → Router (checks if "technical" or "billing")
- Router → Technical Support node
- Router → Billing Support node  
- Both → END

The router just looks for keywords and routes accordingly. Simple!

## Cool Features

- **Live testing** - see your agent work before exporting
- **Python export** - generates clean LangGraph code
- **No BS** - just the features from the original aiagnet.py, nothing fancy

## Troubleshooting

- **"Can't connect nodes"** - You're probably dragging the wrong way. Bottom → Top!
- **"Router not working"** - Did you add routing rules? Double-click and configure
- **"No response"** - Check your API key in backend/.env

## Tech Stack

Frontend: React + ReactFlow
Backend: FastAPI + LangChain

## Want to contribute?

Feel free to fork and improve! The code's pretty straightforward:
- Frontend components in `frontend/src/components/`
- Backend magic in `backend/main.py`

---
