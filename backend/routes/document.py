import logging
from fastapi import APIRouter, HTTPException, Depends
from db import SessionLocal
from models.models import Document
from services.deps import get_current_user
from services.instances import vdb

logger = logging.getLogger(__name__)

router=APIRouter()

# get endpoint for restoring the documents in the frontend
@router.get("/documents")
def get_documents(
    user_id: str = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        documents = (
            db.query(Document)
            .filter(Document.user_id == user_id).all()
            )
        return [
            {
                "doc_id": doc.doc_id,
                "file_name": doc.file_name,
                "topics": doc.topics,
            }
            for doc in documents
        ]

    except Exception as e:
        logger.error(f"Fetch documents error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load documents. Please try again."
        )

    finally:
        db.close()

#delete file-data endpoint
@router.delete("/document/{doc_id}")
def delete_document_endpoint(
    doc_id: str,
    user_id: str = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        document = (
            db.query(Document)
            .filter(Document.doc_id == doc_id,Document.user_id == user_id).first()
        )
        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )
        
        vdb.delete_document(
            user_id,
            doc_id
        )

        db.delete(document)
        db.commit()
        return {
            "message":
            "Document deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete document error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete document. Please try again."
        )

    finally:
        db.close()