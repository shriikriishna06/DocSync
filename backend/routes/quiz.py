import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

from services.instances import vdb, llm
from services.deps import get_current_user

logger = logging.getLogger(__name__)
load_dotenv()

router = APIRouter()

class QuizRequest(BaseModel):
    doc_id: str
    topics: List[str]

#quiz generation endpoint
@router.post("/generate")
def generate_quiz(req: QuizRequest,user_id: str = Depends(get_current_user)):
    try:
        retrieval_query = (
            "important concepts about "
            + ", ".join(req.topics)
        )

        chunks = vdb.query_with_rerank(
            user_id=user_id,
            doc_id=req.doc_id,
            query_text=retrieval_query,
            top_k=20,
            final_k=10
        )
        if not chunks:
            raise HTTPException(
                status_code=404,
                detail="No relevant content found"
            )
        #generation using llm
        quiz = llm.generate_quiz(chunks)
        return {
            "quiz": quiz
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quiz generation error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unable to generate quiz. Please try again."
        )