from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
from groq import Groq
from dotenv import load_dotenv
from database import SessionLocal, create_tables, Memory, ExtractedFact
import chromadb
from datetime import datetime

load_dotenv()
create_tables()

app = FastAPI()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
chroma_client = chromadb.PersistentClient(path="../data/chroma")
collection = chroma_client.get_or_create_collection(name="automind_memories_v2")

class ChatRequest(BaseModel):
    session_id: str
    message: str

class SessionRequest(BaseModel):
    session_id: str

# --- FACT EXTRACTION --- #
def extract_facts_from_message(user_message: str, ai_response: str) -> list:
    """Use Groq to extract key facts from user message only"""
    extraction_prompt = f"""You are a memory extraction system. Extract important facts about the USER only from this message.
    
User said: "{user_message}"

Extract facts in this exact JSON format. Only include facts explicitly stated by the user.
If no facts worth remembering, return empty list.

Return ONLY valid JSON, nothing else:
{{
  "facts": [
    {{
      "category": "personal|goals|skills|preferences",
      "fact": "concise fact statement",
      "confidence": "high|medium|low"
    }}
  ]
}}

Categories:
- personal: name, age, location, education, job
- goals: what they want to achieve, aspirations
- skills: technical or other abilities they mention
- preferences: likes, dislikes, habits"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": extraction_prompt}],
            temperature=0.1
        )
        raw = response.choices[0].message.content.strip()
        # Clean any markdown if model adds it
        raw = raw.replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)
        return data.get("facts", [])
    except:
        return []

def save_extracted_facts(facts: list, user_id: str = "default_user"):
    """Save extracted facts to SQLite and ChromaDB"""
    if not facts:
        return
    
    db = SessionLocal()
    for fact_data in facts:
        fact_text = fact_data.get("fact", "")
        category = fact_data.get("category", "personal")
        confidence = fact_data.get("confidence", "high")
        
        if not fact_text:
            continue

        # Check if similar fact exists — update instead of duplicate
        existing = db.query(ExtractedFact).filter(
            ExtractedFact.user_id == user_id,
            ExtractedFact.category == category
        ).all()
        
        duplicate = False
        for e in existing:
            if fact_text.lower()[:30] in e.fact.lower():
                e.fact = fact_text
                e.updated_at = datetime.utcnow()
                duplicate = True
                break
        
        if not duplicate:
            new_fact = ExtractedFact(
                user_id=user_id,
                category=category,
                fact=fact_text,
                confidence=confidence
            )
            db.add(new_fact)
            
            # Add to ChromaDB for semantic search
            fact_id = f"fact_{user_id}_{datetime.now().timestamp()}"
            collection.add(
                documents=[fact_text],
                ids=[fact_id],
                metadatas=[{
                    "user_id": user_id,
                    "category": category,
                    "type": "extracted_fact"
                }]
            )
    
    db.commit()
    db.close()

def retrieve_relevant_facts(query: str, user_id: str = "default_user") -> dict:
    """Retrieve relevant facts from ChromaDB semantically"""
    try:
        total = collection.count()
        if total == 0:
            return {"facts": [], "count": 0}
        
        results = collection.query(
            query_texts=[query],
            n_results=min(5, total),
            where={"user_id": user_id}
        )
        
        facts = []
        if results and results["documents"] and results["documents"][0]:
            for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
                facts.append({
                    "fact": doc,
                    "category": meta.get("category", "general")
                })
        
        return {"facts": facts, "count": len(facts)}
    except:
        return {"facts": [], "count": 0}

# --- ROUTES --- #

@app.get("/")
def root():
    return {"message": "AutoMind is running!"}

@app.post("/chat")
async def chat(request: ChatRequest):
    session_id = request.session_id
    user_message = request.message
    user_id = "default_user"

    # Retrieve relevant facts semantically
    memory_data = retrieve_relevant_facts(user_message, user_id)
    relevant_facts = memory_data["facts"]
    
    # Format facts by category for prompt
    facts_by_category = {}
    for f in relevant_facts:
        cat = f["category"]
        if cat not in facts_by_category:
            facts_by_category[cat] = []
        facts_by_category[cat].append(f["fact"])
    
    memory_context = ""
    for category, facts in facts_by_category.items():
        memory_context += f"\n{category.upper()}:\n"
        for fact in facts:
            memory_context += f"  - {fact}\n"

    # Get recent conversation from SQLite
    db = SessionLocal()
    recent = db.query(Memory).filter(
        Memory.session_id == session_id
    ).order_by(Memory.timestamp.desc()).limit(10).all()
    db.close()

    recent_context = ""
    for m in reversed(recent):
        recent_context += f"{m.role.upper()}: {m.content}\n"

    system_prompt = f"""You are AutoMind, a highly intelligent AI assistant with persistent memory.
You remember everything important the user has ever told you across all conversations.

WHAT YOU KNOW ABOUT THIS USER:
{memory_context if memory_context else "Still learning about this user."}

RECENT CONVERSATION:
{recent_context if recent_context else "This is the start of the conversation."}

Instructions:
- Use what you know to give personalised responses
- If user tells you something new and important, acknowledge it naturally
- Never say you cannot remember past conversations
- Speak naturally, not robotically"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )

    ai_response = response.choices[0].message.content

    # Save to conversation history
    db = SessionLocal()
    db.add(Memory(session_id=session_id, role="user", content=user_message))
    db.add(Memory(session_id=session_id, role="assistant", content=ai_response))
    db.commit()
    db.close()

    # Extract and save facts from user message only
    facts = extract_facts_from_message(user_message, ai_response)
    save_extracted_facts(facts, user_id)

    return {
        "response": ai_response,
        "memories_used": memory_data["count"],
        "new_facts_extracted": len(facts)
    }

@app.get("/memories/{session_id}")
def get_memories(session_id: str):
    db = SessionLocal()
    memories = db.query(Memory).filter(
        Memory.session_id == session_id
    ).order_by(Memory.timestamp.asc()).all()
    db.close()
    return [{"role": m.role, "content": m.content, "timestamp": m.timestamp} for m in memories]

@app.get("/facts")
def get_all_facts(user_id: str = "default_user"):
    """Get all extracted facts categorized"""
    db = SessionLocal()
    facts = db.query(ExtractedFact).filter(
        ExtractedFact.user_id == user_id
    ).order_by(ExtractedFact.category, ExtractedFact.timestamp.desc()).all()
    db.close()
    
    categorized = {}
    for f in facts:
        if f.category not in categorized:
            categorized[f.category] = []
        categorized[f.category].append({
            "id": f.id,
            "fact": f.fact,
            "confidence": f.confidence,
            "timestamp": f.timestamp,
            "updated_at": f.updated_at
        })
    
    return categorized

@app.delete("/memories/{session_id}")
def clear_memories(session_id: str):
    db = SessionLocal()
    db.query(Memory).filter(Memory.session_id == session_id).delete()
    db.commit()
    db.close()
    return {"message": "Conversation cleared"}

@app.delete("/facts")
def clear_all_facts(user_id: str = "default_user"):
    """Clear all extracted facts"""
    db = SessionLocal()
    db.query(ExtractedFact).filter(ExtractedFact.user_id == user_id).delete()
    db.commit()
    db.close()
    
    # Clear ChromaDB too
    try:
        all_ids = collection.get(where={"user_id": user_id})["ids"]
        if all_ids:
            collection.delete(ids=all_ids)
    except:
        pass
    
    return {"message": "All facts cleared"}