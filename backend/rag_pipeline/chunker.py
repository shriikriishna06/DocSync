from typing import List, TypedDict
from rag_pipeline.preprocessing import DocumentSection, StructuredDocument

class ChunkMetadata(TypedDict):
    type: str
    level: int
    page: int
    context: str

class Chunk(TypedDict):
    content: str
    metadata: ChunkMetadata

#create chunks of the doc fed
class Chunker:
    def __init__(self, max_words: int = 400, overlap: int = 80):
        if overlap >= max_words:
            raise ValueError("overlap must be smaller than max_words")

        self.max_words = max_words
        self.overlap = overlap

    def create_chunks(self, structured_doc: StructuredDocument) -> List[Chunk]:
        chunks: List[Chunk] = []
        heading_stack: List[str] = []

        for sec in structured_doc.sections:
            text = sec.content.strip()
            if not text:
                continue

            if sec.section_type == "heading":
                level = max(1, sec.level)
                heading_stack = heading_stack[:level - 1]
                heading_stack.append(text)
                continue

            context = " > ".join(heading_stack)
            words = text.split()

            if len(words) <= self.max_words:
                chunks.append(self._build_chunk(text, sec, context))
            else:
                chunks.extend(self._split(words, sec, context))

        return chunks

    def _split(
        self,
        words: List[str],
        sec: DocumentSection,
        context: str
    ) -> List[Chunk]:
        chunks: List[Chunk] = []
        start = 0
        step = self.max_words - self.overlap

        while start < len(words):
            end = start + self.max_words
            chunk_text = " ".join(words[start:end])

            chunks.append(self._build_chunk(chunk_text, sec, context))
            start += step

        return chunks

    def _build_chunk(
        self,
        text: str,
        sec: DocumentSection,
        context: str
    ) -> Chunk:
        full_text = f"{context}\n{text}" if context else text

        return {
            "content": full_text,
            "metadata": {
                "type": sec.section_type,
                "level": sec.level,
                "page": sec.page_number,
                "context": context,
            },
        }
