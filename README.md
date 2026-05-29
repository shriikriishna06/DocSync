# DOCSYNC - AI POWERED RAG-BASED ACADEMIC WORKSPACE
DocSync is a RAG-based study assistant that lets students upload PDF/DOCX documents, ask questions against them using AI, generate MCQ quizzes, and discover related YouTube videos — all from a single workspace.<br>
Live on : https://docsync.vercel.app<br>

# ⚡KEY FEATURES
- Upload PDF/DOCX documents with automatic text extraction.
- Column-aware PDF parsing (handles multi-column academic papers).
- OCR fallback for scanned PDFs (Tesseract).
- Unstructured fallback for complex layouts.
- Quality scoring on extracted text with automatic fallback selection.
- Semantic chunking with heading-aware context preservation.
- Vector embeddings using Sentence Transformers (all-MiniLM-L6-v2).
- Cloud vector storage via ChromaDB.
- RAG-powered Q&A using Gemini 2.5 Flash.
- Conversational memory with Redis (rolling 6-message window).
- AI-generated MCQ quizzes from document topics.
- YouTube video recommendations based on extracted topics.
- JWT authentication with signup/login/delete account.
- Per-user document isolation (up to 50 documents).
- Topic extraction pipeline:
    - Stage 1: Structural cleaning (numbering, artifacts, noise).
    - Stage 2: Semantic deduplication (fuzzy matching, subset removal, OCR repair).

# 💡HOW IT WORKS
1. User uploads a PDF or DOCX file.
2. Backend preprocesses the document:<br>
    - PDF → PyMuPDF (column-aware) → quality check → fallback to Unstructured/OCR if needed.<br>
    - DOCX → python-docx with heading/table/list preservation.<br>
3. Noise cleaning removes headers, footers, watermarks, page numbers.
4. Document is chunked with heading context (400 words, 80 overlap).
5. Chunks are embedded and stored in ChromaDB (cloud).
6. Topics are extracted from chunk headings and cleaned in 2 stages.
7. On query, relevant chunks are retrieved, re-ranked, and sent to Gemini:<br>
    {<br>
    &ensp;query : " ... ",<br>
    &ensp;context : " ... (top chunks) ",<br>
    &ensp;memory : " ... (last 6 messages) "<br>
    }<br>
8. Gemini returns a structured answer grounded in the document.
9. Quiz generation sends chunks to Gemini with strict MCQ format rules.
10. YouTube search uses extracted topics to find relevant educational videos.

# 🗂️PROJECT STRUCTURE
```
DocSync
│
├── backend/
│   ├── main.py                           # FastAPI entry point
│   ├── db.py                             # PostgreSQL (SQLAlchemy) config
│   ├── Dockerfile                        # Optimized multi-stage Docker build
│   │
│   ├── models/
│   │   ├── models.py                     # User + Document DB models
│   │
│   ├── routes/
│   │   ├── auth.py                       # Signup / Login / Delete account
│   │   ├── upload.py                     # Document upload + processing
│   │   ├── query.py                      # RAG Q&A endpoint
│   │   ├── quiz.py                       # Quiz generation endpoint
│   │   ├── document.py                   # Document list / delete
│   │   ├── youtube.py                    # YouTube video search
│   │
│   ├── services/
│   │   ├── gemini.py                     # Gemini API (Q&A + quiz generation)
│   │   ├── memory.py                     # Redis chat memory (rolling window)
│   │   ├── auth.py                       # JWT token creation + password hashing
│   │   ├── deps.py                       # Auth dependency injection
│   │   ├── instances.py                  # Singleton service instances
│   │   ├── topic_extractor.py            # 2-stage topic extraction pipeline
│   │   ├── youtube.py                    # YouTube Data API v3 client
│   │
│   ├── rag_pipeline/
│   │   ├── preprocessing.py              # PDF/DOCX extraction + quality check
│   │   ├── chunker.py                    # Heading-aware semantic chunking
│   │   ├── embeddings.py                 # Sentence Transformers embedder
│   │   ├── v_db.py                       # ChromaDB cloud vector store
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                       # Root component + routing
│   │   ├── main.tsx                      # React entry point
│   │   ├── index.css                     # Global styles + design tokens
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                    # API client (fetch wrapper + types)
│   │   │   ├── useAuth.ts               # Auth state hook (JWT + validation)
│   │   │   ├── useAppState.ts           # Document state management
│   │   │   ├── utils.ts                 # Tailwind merge utility
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.tsx              # Navigation + upload sidebar
│   │   │
│   │   ├── pages/
│   │   │   ├── Auth.tsx                 # Login / Signup page
│   │   │   ├── Library.tsx              # Document library grid
│   │   │   ├── StudyChat.tsx            # RAG chat interface
│   │   │   ├── QuizLab.tsx             # Quiz + YouTube videos
```

# 🛠️TECH STACK

### Backend
- **Framework:** FastAPI + Uvicorn
- **LLM:** Google Gemini 2.5 Flash
- **Embeddings:** Sentence Transformers (all-MiniLM-L6-v2)
- **Vector DB:** ChromaDB Cloud
- **Database:** PostgreSQL + SQLAlchemy(ORM)
- **Cache:** Redis (chat memory)
- **PDF:** PyMuPDF (column-aware extraction)
- **OCR:** Tesseract (fallback)
- **Auth:** JWT for serverless auth
- **Containerization:** Docker
- **Hosted On:** Google Cloud Run (backend) + Vercel (frontend)

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4
- **Animations:** Motion (Framer Motion)
- **Icons:** Lucide React + React Icons

# 🔧SETUP

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL
- Redis
- Docker (optional)

### Environment Variables
Create a `.env` file in the project root

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker (Backend)
Remote image pull:
```bash
docker pull shrikrishnarprabhu/docsync:latest
docker run -d --env-file ../.env -p 8000:8000 shrikrishnarprabhu/docsync:latest
```
