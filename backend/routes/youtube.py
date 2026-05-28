import logging

from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel
from typing import List

from db import SessionLocal
from models.models import Document
from services.deps import get_current_user
from services.instances import youtube

logger = logging.getLogger(__name__)
router = APIRouter()

class VideoRequest(BaseModel):
    doc_id: str
    topics: List[str]

#yt fetch endpoint
@router.post("/videos")
def get_videos(req: VideoRequest,user_id: str = Depends(get_current_user)):

    db = SessionLocal()

    try:
        topics = [
            topic.strip()
            for topic in req.topics
            if topic.strip()
        ]

        if not topics:
            raise HTTPException(
                status_code=400,
                detail="At least one topic is required"
            )

        if len(topics) > 10:
            raise HTTPException(
                status_code=400,
                detail="Maximum 10 topics are allowed"
            )

        document = (
            db.query(Document).filter(
                Document.doc_id == req.doc_id,
                Document.user_id == user_id
            ).first())
        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )

        videos = youtube.search(topics)

        return {
            "videos": videos
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"YouTube video lookup error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unable to fetch YouTube videos. Please try again."
        )
    finally:
        db.close()
