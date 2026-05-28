import logging
import os
import shutil
import uuid
import hashlib
from db import SessionLocal
from models.models import Document
from fastapi import APIRouter, UploadFile, File, HTTPException,Depends
from services.instances import vdb,memory
from rag_pipeline.preprocessing import DocumentPreprocessor
from rag_pipeline.chunker import Chunker
from services.topic_extractor import extract_topics
from services.deps import get_current_user

logger = logging.getLogger(__name__)
preprocessor = DocumentPreprocessor()
chunker = Chunker()

router = APIRouter()

UPLOAD_DIR = "data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
#hash generation for file
def generate_file_hash(file_path: str):
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()

#file upload endpoint
@router.post("/upload")
async def upload_file(file: UploadFile = File(...),user_id: str = Depends(get_current_user)):
    db = SessionLocal()
    file_path = None
    doc_id = None
    vector_stored = False

    memory.clear(user_id)
    try:
        #file validation
        if not file.filename.endswith((".pdf", ".docx", ".doc")):
            raise HTTPException(
                status_code=400,
                detail="Only PDF and DOCX files are supported"
            )
        #size check
        contents = await file.read()
        if len(contents) > 50 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="File is too large. Maximum size is 50MB."
            )
        await file.seek(0)
        #doc limit check <=50
        doc_count = (db.query(Document)
            .filter(Document.user_id == user_id)
            .count()
        )
        if doc_count >= 50:
            raise HTTPException(
                status_code=400,
                detail="Document limit reached (50). Delete a document to upload more."
            )

        file_id = str(uuid.uuid4())
        file_path = os.path.join(
            UPLOAD_DIR,
            f"{file_id}_{file.filename}"
        )

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_hash = generate_file_hash(file_path)
        #check file exist or not
        existing_doc = (
            db.query(Document)
            .filter(
                Document.user_id == user_id,
                Document.file_hash == file_hash
            ).first()
        )

        if existing_doc:
            return {
                "status": "success",
                "message": "File already uploaded",
                "doc_id": existing_doc.doc_id,
                "duplicate": True
            }
        #preprocess
        doc = preprocessor.process(file_path)
        #chunker
        chunks = chunker.create_chunks(doc)
        if not chunks:
            raise HTTPException(
                status_code=500,
                detail="No content extracted from file"
            )
        #topic extractor
        topics = extract_topics(chunks)

        doc_id = str(uuid.uuid4())
        #vector store
        vdb.add(
            user_id,
            doc_id,
            chunks
        )
        vector_stored = True
        #doc details
        new_doc = Document(
            doc_id=doc_id,
            user_id=user_id,
            file_name=file.filename,
            file_hash=file_hash,
            topics=topics
        )

        db.add(new_doc)
        db.commit()

        return {
            "status": "success",
            "file_name": file.filename,
            "chunks_added": len(chunks),
            "message": "Document processed and stored",
            "doc_id": doc_id,
            "topics": topics,
            "duplicate": False
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        if vector_stored:
            try:
                vdb.delete_document(user_id, doc_id)
            except Exception as cleanup_error:
                logger.warning(f"Vector cleanup failed after upload error: {cleanup_error}")

        logger.error(f"Upload error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process the document. Please try again."
        )
    finally:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        db.close()
