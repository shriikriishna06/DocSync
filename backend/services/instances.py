from rag_pipeline.v_db import VectorDB
from services.gemini import Gemini
from services.memory import ChatMemory
from services.youtube import YouTubeService
import os
import logging

logger = logging.getLogger(__name__)

#instances loader/initializer
youtube = YouTubeService()
vdb = VectorDB()

try:
    _ = vdb.embedder.model
    logger.info("Embedding model warmed up successfully")
except Exception as e:
    logger.warning(f"Embedding model warmup failed: {e}")

llm = Gemini(api_key=os.getenv("GEMINI_API_KEY"))
memory = ChatMemory()
