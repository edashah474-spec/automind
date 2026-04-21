from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
from groq import Groq
from dotenv import load_dotenv
from database import SessionLocal, create_tables, Memory
import chromadb
from datetime import datetime

load_dotenv()
create_tables()

app = FastAPI()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

chroma_client = chromadb.PersistentClient(path="../data/chroma")
collection = chroma_client.get_or_create_collection(name="automind_memories")

class ChatRequest(BaseModel):
    session_id: str
    message: str

class SessionRequest(BaseModel):
    session_id: str

@app.get("/")
def root():
    return {"message": "AutoMind is running!"}

@app.post("/chat")
async def chat(request: ChatRequest):
    session_id = request.session_id
    user_message = request.message

    results = collection.query(
        query_texts=[user_message],
        n_results=5,
        where={"session_id": session_id} if collection.count() > 0 else None
    )

    relevant_memories = ""
    if results and results["documents"] and results["documents"][0]:
        relevant_memories = "\n".join(results["documents"][0])

    db = SessionLocal()
    recent = db.query(Memory).filter(
        Memory.session_id == session_id
    ).order_by(Memory.timestamp.desc()).limit(10).all()
    db.close()

    recent_context = ""
    for m in reversed(recent):
        recent_context += f"{m.role.upper()}: {m.content}\n"

    system_prompt = f"""You are AutoMind, a highly intelligent AI assistant with persistent memory.
You remember everything the user has ever told you across all conversations.

RELEVANT MEMORIES FROM YOUR KNOWLEDGE BASE:
{relevant_memories if relevant_memories else "No specific memories found for this query yet."}

RECENT CONVERSATION HISTORY:
{recent_context if recent_context else "This is the start of the conversation."}

Use these memories to give personalised, context-aware responses.
Always refer back to what you know about the user when relevant.
If you learn something new about the user, acknowledge it and remember it."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )

    ai_response = response.choices[0].message.content

    db = SessionLocal()
    db.add(Memory(session_id=session_id, role="user", content=user_message))
    db.add(Memory(session_id=session_id, role="assistant", content=ai_response))
    db.commit()
    db.close()

    memory_id_user = f"{session_id}_{datetime.now().timestamp()}_user"
    memory_id_ai = f"{session_id}_{datetime.now().timestamp()}_ai"

    collection.add(
        documents=[user_message, ai_response],
        ids=[memory_id_user, memory_id_ai],
        metadatas=[
            {"session_id": session_id, "role": "user"},
            {"session_id": session_id, "role": "assistant"}
        ]
    )

    return {"response": ai_response, "memories_used": len(results["documents"][0]) if results and results["documents"] and results["documents"][0] else 0}

@app.get("/memories/{session_id}")
def get_memories(session_id: str):
    db = SessionLocal()
    memories = db.query(Memory).filter(
        Memory.session_id == session_id
    ).order_by(Memory.timestamp.asc()).all()
    db.close()
    return [{"role": m.role, "content": m.content, "timestamp": m.timestamp} for m in memories]

@app.delete("/memories/{session_id}")
def clear_memories(session_id: str):
    db = SessionLocal()
    db.query(Memory).filter(Memory.session_id == session_id).delete()
    db.commit()
    db.close()
    return {"message": "Memory cleared"}