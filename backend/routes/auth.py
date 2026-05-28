from fastapi import APIRouter, HTTPException,Depends
from pydantic import BaseModel
import logging
from models.models import Document, User
from services.deps import get_current_user
from services.auth import create_user, authenticate_user, create_access_token
from services.instances import vdb,memory
from db import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter()

class AuthRequest(BaseModel):
    email: str
    password: str

#sign up endpoint
@router.post("/signup")
def signup(req: AuthRequest):
    user = create_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=400, detail="User already exists")
    token = create_access_token({"user_id": user.user_id})
    return {"access_token": token}

#login endpoint
@router.post("/login")
def login(req: AuthRequest):
    result = authenticate_user(req.email, req.password)
    if result["status"] == "user_not_found":
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    if result["status"] == "invalid_password":
        raise HTTPException(
            status_code=401,
            detail="Invalid Password"
        )
    user = result["user"]
    token = create_access_token({"user_id": user.user_id})
    return {
        "access_token": token
    }

#acc. deletion endpoint
@router.delete("/delete-account")
def delete_account(
    user_id: str = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        memory.clear(user_id)
        vdb.delete_user_collection(user_id)

        db.query(Document).filter(
            Document.user_id == user_id
        ).delete()

        db.query(User).filter(
            User.user_id == user_id
        ).delete()

        db.commit()

        return {
            "message":
            "Account deleted successfully"
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Delete account error: {e}")

        raise HTTPException(
            status_code=500,
            detail="Failed to delete account. Please try again."
        )
    finally:
        db.close()
