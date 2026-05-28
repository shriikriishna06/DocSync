import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from routes.upload import router as upload_router
from routes.query import router as query_router
from routes.auth import router as auth_router
from routes.quiz import router as quiz_router
from routes.document import router as document_router
from routes.youtube import router as youtube_router

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(asctime)s | %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG Study Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router, prefix="/api")
app.include_router(query_router, prefix="/api")
app.include_router(auth_router, prefix="/auth")
app.include_router(quiz_router,prefix="/quiz")
app.include_router(document_router, prefix="/api")
app.include_router(youtube_router,prefix="/api")

@app.get("/")
def root():
    return {"status": "running"}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Something went wrong. Please try again."
        }
    )