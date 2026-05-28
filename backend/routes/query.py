import logging
from fastapi import APIRouter, HTTPException,Depends
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from services.instances import vdb, llm,memory
from services.deps import get_current_user

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter()

AMBIGUOUS = {
    "it", "its", "they", "them",
    "this", "that", "these", "those"
}

class QueryRequest(BaseModel):
    query: str
    doc_id:str
    top_k: int = Field(default=5, ge=1, le=10)

#LLM query endpoint
@router.post("/query")
def query_endpoint(req: QueryRequest,user_id: str = Depends(get_current_user)):
    try:
        if not req.query.strip():
            raise HTTPException(
                status_code=400,
                detail="Empty query"
            )
        
        chat_history = memory.get(user_id) #redis
        retrieval_query = req.query
        words = set(req.query.lower().split())
        needs_context = any(
            w in words for w in AMBIGUOUS
        )

        if needs_context and chat_history:
            last_user_query = None
            for msg in reversed(chat_history):
                if (
                    msg["role"] == "user"
                    and msg["content"].strip().lower()
                    != req.query.strip().lower()
                ):
                    last_user_query = msg["content"]
                    break
            if last_user_query:
                retrieval_query = (
                    f"{last_user_query}. {req.query}"
                )
        #retrive related chunks of the query
        chunks = vdb.query_with_rerank(
            user_id=user_id,
            doc_id=req.doc_id,
            query_text=retrieval_query,
            top_k=max(req.top_k * 3, 15),
            final_k=req.top_k
        )
        #llm response
        answer = llm.generate(
            req.query,
            chunks,
            chat_history
        )
        #redis updation of recent msgs
        memory.add(user_id, "user", req.query)
        memory.add(user_id, "assistant", answer)

        return {
            "answer": answer,
            "sources": chunks
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unable to generate a response. Please try again."
        )
