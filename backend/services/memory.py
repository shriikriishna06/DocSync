import redis
import json
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

#chat memory using redis (in-memory)  max=6
class ChatMemory:
    def __init__(self, url=os.getenv("REDIS_URL"), max_messages=6):
        self.redis = redis.Redis.from_url(url, decode_responses=True)
        self.max_messages = max_messages

    def _key(self, user_id: str) -> str:
        return f"chat:{user_id}"

    def get(self, user_id: str) -> List[Dict]:
        data = self.redis.get(self._key(user_id))
        return json.loads(data) if data else []

    def add(self, user_id: str, role: str, content: str):
        history = self.get(user_id)

        history.append({
            "role": role,
            "content": content
        })

        history = history[-self.max_messages:]

        self.redis.set(self._key(user_id), json.dumps(history))

    def clear(self, user_id: str):
        self.redis.delete(self._key(user_id))
    




        
