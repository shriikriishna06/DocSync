from sqlalchemy import Column, String, DateTime,ForeignKey,JSON
from db import Base
from datetime import datetime,UTC

#db schemas
class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

class Document(Base):
    __tablename__ = "documents"
    doc_id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"))
    file_name = Column(String)
    topics = Column(JSON)
    file_hash = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.now(UTC))
