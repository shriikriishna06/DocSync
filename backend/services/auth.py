import uuid
import os
from pathlib import Path
from datetime import datetime, UTC, timedelta
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

from db import SessionLocal
from models.models import User

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

SECRET_KEY = os.getenv("JWT_SECRET_KEY") #used to check whether or not the JWT is created through this session
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is not set. Add it to the project root .env file.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

#hash fns for password
def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain, hashed)

#user creation
def create_user(email: str, password: str):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return None
        user = User(
            user_id=str(uuid.uuid4()),
            email=email,
            password=hash_password(password)
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user
    finally:
        db.close()

#verify user
def authenticate_user(email: str, password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return {
                "status": "user_not_found",
                "user": None
            }
        if not verify_password(password, user.password):
            return {
                "status": "invalid_password",
                "user": None
            }
        return {
            "status": "success",
            "user": user
        }
    finally:
        db.close()

#JWT fns
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
