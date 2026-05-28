#preprocessing of .pdf/.doc/.docx files with quality checking and noise cleaning.
import re
import json
import hashlib
import logging
import time
import fitz #PyMuPDF
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Tuple
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from collections import Counter

logger = logging.getLogger(__name__)

@dataclass
class DocumentSection:
    """A tagged section of extracted content."""
    content: str
    section_type: str  
    level: int = 0
    page_number: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DocumentMetadata:
    """Metadata about the source document and processing."""
    filename: str
    file_type: str
    file_size_bytes: int
    page_count: int = 0
    extraction_method: str = ""
    quality_score: float = 0.0
    processing_time_ms: float = 0.0
    processed_at: str = ""
    file_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class StructuredDocument:
    """The final preprocessed document output."""
    metadata: DocumentMetadata
    sections: List[DocumentSection] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metadata": self.metadata.to_dict(),
            "sections": [s.to_dict() for s in self.sections],
        }

    def to_markdown(self) -> str:
        lines = []
        for s in self.sections:
            if s.section_type == "heading":
                prefix = "#" * max(1, min(6, s.level))
                lines.append(f"\n{prefix} {s.content}\n")
            elif s.section_type == "table":
                lines.append(f"\n{s.content}\n")
            elif s.section_type == "list":
                lines.append(s.content)
            elif s.section_type == "code":
                lines.append(f"\n```\n{s.content}\n```\n")
            else:
                lines.append(f"\n{s.content}\n")
        return "\n".join(lines).strip()

    def full_text(self) -> str:
        return "\n\n".join(
            s.content.strip() for s in self.sections if s.content.strip()
        )

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)


# Quality Checker

class TextQualityEvaluator:
    """Lightweight text quality scorer (0.0-1.0) for extraction fallback decisions."""

    COMMON_WORDS = frozenset({
        "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
        "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
        "this", "but", "his", "by", "from", "they", "we", "say", "her",
        "she", "or", "an", "will", "my", "one", "all", "would", "there",
        "their", "what", "so", "up", "out", "if", "about", "who", "get",
        "which", "go", "me", "when", "make", "can", "like", "time", "no",
        "just", "him", "know", "take", "people", "into", "year", "your",
        "good", "some", "could", "them", "see", "other", "than", "then",
        "now", "look", "only", "come", "its", "over", "think", "also",
        "back", "after", "use", "two", "how", "our", "work", "first",
        "well", "way", "even", "new", "want", "because", "any", "these",
        "give", "day", "most", "us", "is", "are", "was", "were", "been",
        "has", "had", "did", "does", "may", "might", "must", "should",
        "need", "very", "still", "between", "each", "much", "before",
        "too", "same", "more", "through", "while", "where", "here",
        "why", "both", "long", "made", "many", "part", "find", "down",
        "such", "study", "chapter", "section", "example", "figure",
        "table", "result", "method", "based", "different", "following",
        "important", "process", "form", "order", "case", "given",
        "however", "using", "including", "since", "within", "thus",
        "note", "page", "class", "function", "type", "value", "total",
        "student", "learning", "question", "answer", "problem", "unit",
        "test", "definition", "theory", "concept", "equation", "solution",
    })

    @classmethod
    def evaluate(cls, text: str) -> float:
        if not text or len(text.strip()) < 20:
            return 0.0
        scores = []
        alnum = sum(1 for c in text if c.isalnum() or c.isspace())
        scores.append(min((alnum / max(len(text), 1)) / 0.85, 1.0) * 0.3)
        words = text.split()
        if words:
            avg = sum(len(w) for w in words) / len(words)
            wscore = 1.0 if 3 <= avg <= 12 else (0.1 if avg < 2 or avg > 20 else 0.5)
            scores.append(wscore * 0.2)
        else:
            scores.append(0.0)
        if words:
            clean = [w.lower().strip(".,;:!?\"'()[]{}") for w in words]
            clean = [w for w in clean if len(w) > 1]
            if clean:
                hits = sum(1 for w in clean if w in cls.COMMON_WORDS)
                scores.append(min((hits / len(clean)) / 0.20, 1.0) * 0.3)
            else:
                scores.append(0.0)
        else:
            scores.append(0.0)
        lines = text.split("\n")
        if lines:
            ok = sum(1 for l in lines if 5 < len(l.strip()) < 500)
            scores.append((ok / len(lines)) * 0.2)
        else:
            scores.append(0.0)
        return round(sum(scores), 3)


# Noise Cleaner

class NoiseCleaner:
    """Remove headers, footers, watermarks, page numbers, encoding artifacts."""

    ENCODING_FIXES = {
        "\u00e2\u0080\u0099": "\u2019", "\u00e2\u0080\u0098": "\u2018",
        "\u00e2\u0080\u009c": "\u201c", "\u00e2\u0080\u009d": "\u201d",
        "\u00e2\u0080\u0093": "\u2013", "\u00e2\u0080\u0094": "\u2014",
        "\u00e2\u0080\u00a6": "\u2026", "\u00e2\u0080\u00a2": "\u2022",
        "\x00": "", "\ufffd": "",
    }

    BOILERPLATE_RE = [
        re.compile(r"^\s*confidential\s*$", re.I),
        re.compile(r"^\s*draft\s*$", re.I),
        re.compile(r"^\s*do\s+not\s+distribute\s*$", re.I),
        re.compile(r"^\s*internal\s+use\s+only\s*$", re.I),
    ]

    PAGE_NUM_RE = [
        re.compile(r"^\s*\d{1,4}\s*$"),
        re.compile(r"^\s*page\s+\d+\s*(of\s+\d+)?\s*$", re.I),
        re.compile(r"^\s*-\s*\d+\s*-\s*$"),
    ]

    @classmethod
    def clean_pages(cls, page_texts: List[str]) -> List[str]:
        if not page_texts:
            return []
        headers, footers = cls._detect_repeated(page_texts)
        cleaned = []
        for pt in page_texts:
            t = cls._fix_encoding(pt)
            t = cls._remove_matched_lines(t, headers | footers)
            t = cls._remove_page_numbers(t)
            t = cls._remove_boilerplate(t)
            t = cls._normalize_whitespace(t)
            cleaned.append(t.strip())
        return cleaned

    @classmethod
    def clean(cls, text: str) -> str:
        t = cls._fix_encoding(text)
        t = cls._remove_page_numbers(t)
        t = cls._remove_boilerplate(t)
        t = cls._normalize_whitespace(t)
        return t.strip()

    @classmethod
    def _fix_encoding(cls, text: str) -> str:
        for bad, good in cls.ENCODING_FIXES.items():
            text = text.replace(bad, good)
        return text

    @classmethod
    def _remove_page_numbers(cls, text: str) -> str:
        lines = text.split("\n")
        return "\n".join(
            l for l in lines if not any(p.match(l) for p in cls.PAGE_NUM_RE)
        )

    @classmethod
    def _remove_boilerplate(cls, text: str) -> str:
        lines = text.split("\n")
        return "\n".join(
            l for l in lines if not any(p.match(l) for p in cls.BOILERPLATE_RE)
        )

    @classmethod
    def _normalize_whitespace(cls, text: str) -> str:
        text = re.sub(r"[\u00a0\u2000-\u200b\u202f\u205f\u3000]", " ", text)
        text = re.sub(r"[^\S\n]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text

    @classmethod
    def _detect_repeated(cls, page_texts: List[str], threshold: float = 0.5):
        if len(page_texts) < 3:
            return set(), set()
        min_occ = max(2, int(len(page_texts) * threshold))
        top_c, bot_c = Counter(), Counter()
        for pt in page_texts:
            lines = [l.strip() for l in pt.split("\n") if l.strip()]
            if not lines:
                continue
            for l in lines[:3]:
                n = re.sub(r"\d+", "N", l.lower())
                if len(n) > 3:
                    top_c[n] += 1
            for l in lines[-3:]:
                n = re.sub(r"\d+", "N", l.lower())
                if len(n) > 3:
                    bot_c[n] += 1
        headers = {p for p, c in top_c.items() if c >= min_occ}
        footers = {p for p, c in bot_c.items() if c >= min_occ}
        return headers, footers

    @classmethod
    def _remove_matched_lines(cls, text: str, patterns: set) -> str:
        if not patterns:
            return text
        lines = text.split("\n")
        return "\n".join(
            l for l in lines
            if re.sub(r"\d+", "N", l.lower().strip()) not in patterns
        )

class StructureTagger:
    """Detect and tag document structure: headings, tables, lists, code."""

    MD_HEADING = re.compile(r"^(#{1,6})\s+(.+)$")
    NUM_SECTION = re.compile(r"^(\d+(?:\.\d+)*)\s+([A-Z].*)")
    BULLET = re.compile(r"^\s*[-\u2022*\u25aa\u25b8\u25ba]\s+(.+)")
    NUMLIST = re.compile(r"^\s*\d+[.)]\s+(.+)")

    @classmethod
    def tag(cls, text: str) -> List[DocumentSection]:
        if not text or not text.strip():
            return []
        sections, lines, i = [], text.split("\n"), 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            if not stripped:
                i += 1
                continue
            m = cls.MD_HEADING.match(stripped)
            if m:
                sections.append(DocumentSection(
                    m.group(2).strip(), "heading", level=len(m.group(1))
                ))
                i += 1
                continue
            m = cls.NUM_SECTION.match(stripped)
            if m:
                depth = m.group(1).count(".") + 1
                sections.append(DocumentSection(
                    stripped, "heading", level=min(depth, 6),
                    metadata={"section_number": m.group(1)}
                ))
                i += 1
                continue
            if (stripped.isupper() and 3 <= len(stripped) <= 100
                    and not stripped.startswith(("-", "*"))):
                sections.append(DocumentSection(
                    stripped.title(), "heading", level=2
                ))
                i += 1
                continue
            if "|" in stripped and stripped.count("|") >= 2:
                tbl = []
                while i < len(lines) and "|" in lines[i]:
                    tbl.append(lines[i])
                    i += 1
                sections.append(DocumentSection("\n".join(tbl), "table"))
                continue
            if cls.BULLET.match(stripped) or cls.NUMLIST.match(stripped):
                lst = []
                while i < len(lines):
                    ls = lines[i].strip()
                    if not ls:
                        break
                    if (cls.BULLET.match(ls) or cls.NUMLIST.match(ls)
                            or ls.startswith("  ")):
                        lst.append(lines[i])
                        i += 1
                    else:
                        break
                sections.append(DocumentSection("\n".join(lst), "list"))
                continue
            if stripped.startswith("```"):
                code = [stripped]
                i += 1
                while i < len(lines):
                    code.append(lines[i])
                    if lines[i].strip().startswith("```") and len(code) > 1:
                        i += 1
                        break
                    i += 1
                sections.append(DocumentSection("\n".join(code), "code"))
                continue
            para = []
            while i < len(lines):
                ls = lines[i].strip()
                if not ls:
                    i += 1
                    break
                if (cls.MD_HEADING.match(ls) or cls.NUM_SECTION.match(ls)
                        or (ls.isupper() and 3 <= len(ls) <= 100)
                        or ls.startswith("```")
                        or ("|" in ls and ls.count("|") >= 2)
                        or cls.BULLET.match(ls) or cls.NUMLIST.match(ls)):
                    break
                para.append(ls)
                i += 1
            if para:
                sections.append(DocumentSection(" ".join(para), "paragraph"))
        return sections


# Format and text extraction

class PDFExtractor:
    """High-accuracy PDF extractor. PyMuPDF primary, optional fallbacks."""

    QUALITY_THRESHOLD = 0.4

    @classmethod
    def extract(cls, file_path: str, enable_ocr: bool = False,
                max_workers: int = 4) -> Tuple[List[str], str, float]:
        """Returns (page_texts, method_name, quality_score)."""
        page_texts, quality = cls._pymupdf(file_path, max_workers)
        if quality >= cls.QUALITY_THRESHOLD:
            logger.info(f"PyMuPDF OK (quality={quality:.3f})")
            return page_texts, "pymupdf", quality

        logger.warning(f"PyMuPDF low quality ({quality:.3f}), trying fallback...")

        # Fallback: Unstructured
        try:
            pt_u, q_u = cls._unstructured(file_path)
            if q_u >= cls.QUALITY_THRESHOLD:
                logger.info(f"Unstructured OK (quality={q_u:.3f})")
                return pt_u, "unstructured", q_u
        except ImportError:
            logger.info("unstructured not installed, skipping")
        except Exception as e:
            logger.warning(f"Unstructured failed: {e}")

        # Fallback: OCR
        if enable_ocr:
            try:
                pt_o, q_o = cls._ocr(file_path, max_workers)
                logger.info(f"OCR done (quality={q_o:.3f})")
                return pt_o, "ocr", q_o
            except ImportError:
                logger.warning("pytesseract not installed, skipping OCR")
            except Exception as e:
                logger.warning(f"OCR failed: {e}")

        return page_texts, "pymupdf_lowquality", quality

    @classmethod
    def _pymupdf(cls, path: str, max_workers: int = 4) -> Tuple[List[str], float]:
        """Column-aware extraction using text block coordinates."""
        
        doc = fitz.open(path)
        n = len(doc)

        if n <= 10:
            page_texts = [cls._extract_page_columnaware(page) for page in doc]
        else:
            page_texts = [""] * n
            def _ep(pn):
                d = fitz.open(path)
                t = cls._extract_page_columnaware(d[pn])
                d.close()
                return pn, t
            with ThreadPoolExecutor(max_workers=max_workers) as ex:
                for pn, t in ex.map(lambda i: _ep(i), range(n)):
                    page_texts[pn] = t

        doc.close()
        quality = TextQualityEvaluator.evaluate("\n".join(page_texts))
        return page_texts, quality

    @classmethod
    def _extract_page_columnaware(cls, page) -> str:
        """
        Extract text from a single page handling multi-column layouts.
        """
        blocks = page.get_text("dict", sort=True)["blocks"]
        page_width = page.rect.width
        spans = []
        for block in blocks:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"]
                    if not text.strip():
                        continue
                    bbox = span["bbox"] 
                    spans.append({
                        "text": text,
                        "x0": bbox[0], "y0": bbox[1],
                        "x1": bbox[2], "y1": bbox[3],
                    })

        if not spans:
            return ""
        spans.sort(key=lambda s: (s["y0"], s["x0"]))
        lines = []
        current_line = [spans[0]]
        for s in spans[1:]:
            prev_y = current_line[-1]["y0"]
            if abs(s["y0"] - prev_y) < 5: 
                current_line.append(s)
            else:
                lines.append(current_line)
                current_line = [s]
        lines.append(current_line)
        mid_x = page_width / 2
        is_multicolumn = cls._detect_multicolumn(lines, page_width, mid_x)

        if not is_multicolumn:
            result = []
            for line_spans in lines:
                line_spans.sort(key=lambda s: s["x0"])
                text = cls._merge_spans(line_spans)
                if text.strip():
                    result.append(text.strip())
            return "\n".join(result)
        
        left_lines = []
        right_lines = []

        for line_spans in lines:
            line_spans.sort(key=lambda s: s["x0"])
            left_spans = [s for s in line_spans if s["x1"] <= mid_x + 20]
            right_spans = [s for s in line_spans if s["x0"] >= mid_x - 20]

            if not left_spans and not right_spans:
                left_spans = line_spans

            left_text = cls._merge_spans(left_spans).strip()
            right_text = cls._merge_spans(right_spans).strip()

            y_pos = line_spans[0]["y0"]
            if left_text:
                left_lines.append((y_pos, left_text))
            if right_text:
                right_lines.append((y_pos, right_text))

        left_lines.sort(key=lambda x: x[0])
        right_lines.sort(key=lambda x: x[0])

        all_text = [text for _, text in left_lines]
        all_text.append("")  
        all_text.extend(text for _, text in right_lines)

        return "\n".join(all_text)

    @classmethod
    def _merge_spans(cls, spans: List[Dict]) -> str:
        """
        Merge a list of sorted spans into text, using horizontal gap to decide
        whether to insert a space. Small gap = same word, large gap = separate words.
        Also handles duplicate characters at column-split boundaries.
        """
        if not spans:
            return ""
        spans_sorted = sorted(spans, key=lambda s: s["x0"])
        parts = [spans_sorted[0]["text"]]
        for i in range(1, len(spans_sorted)):
            gap = spans_sorted[i]["x0"] - spans_sorted[i - 1]["x1"]
            prev_text = parts[-1] 
            curr_text = spans_sorted[i]["text"]
            if not curr_text:
                continue

            if gap < 3 and prev_text and curr_text:
                if prev_text[-1].isalpha() and curr_text[0].isalpha():
                    curr_text = cls._dedup_boundary(prev_text, curr_text)
                    parts.append(curr_text)
                elif prev_text.endswith(" ") or curr_text.startswith(" "):
                    parts.append(curr_text)
                else:
                    parts.append(curr_text)
            else:
                if prev_text.endswith(" ") or curr_text.startswith(" "):
                    parts.append(curr_text)
                else:
                    parts.append(" " + curr_text)
        return "".join(parts)

    @classmethod
    def _dedup_boundary(cls, prev: str, curr: str) -> str:
        """
        Remove overlapping characters at the boundary of two merged fragments.
        """
        max_overlap = min(3, len(prev), len(curr))
        for overlap_len in range(max_overlap, 0, -1):
            if prev[-overlap_len:].lower() == curr[:overlap_len].lower():
                return curr[overlap_len:]
        return curr

    @classmethod
    def _detect_multicolumn(cls, lines: list, page_width: float,mid_x: float) -> bool:
        """
        Detect if page has multi-column layout by checking if most lines
        have a gap near the page center.
        """
        if not lines or len(lines) < 5:
            return False

        gap_count = 0
        for line_spans in lines:
            if len(line_spans) < 2:
                continue
            line_spans_sorted = sorted(line_spans, key=lambda s: s["x0"])
            for i in range(len(line_spans_sorted) - 1):
                gap_start = line_spans_sorted[i]["x1"]
                gap_end = line_spans_sorted[i + 1]["x0"]
                gap_size = gap_end - gap_start
                gap_center = (gap_start + gap_end) / 2
                if gap_size > 10 and abs(gap_center - mid_x) < page_width * 0.15:
                    gap_count += 1
                    break

        return gap_count > len(lines) * 0.3

    @classmethod
    def _unstructured(cls, path: str) -> Tuple[List[str], float]:
        from unstructured.partition.pdf import partition_pdf
        elements = partition_pdf(filename=path, strategy="fast")
        page_map: Dict[int, List[str]] = {}
        for el in elements:
            if el.category in ("Header", "Footer"):
                continue
            pn = getattr(el.metadata, "page_number", 1) or 1
            page_map.setdefault(pn, []).append(str(el))
        if not page_map:
            return [], 0.0
        mx = max(page_map.keys())
        pts = ["\n".join(page_map.get(i, [])) for i in range(1, mx + 1)]
        return pts, TextQualityEvaluator.evaluate("\n".join(pts))

    @classmethod
    def _ocr(cls, path: str, max_workers: int = 4) -> Tuple[List[str], float]:
        import fitz
        import pytesseract
        from PIL import Image
        import io
        doc = fitz.open(path)
        page_texts = []
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text = pytesseract.image_to_string(img)
            page_texts.append(text)
        doc.close()
        return page_texts, TextQualityEvaluator.evaluate("\n".join(page_texts))


class DOCXExtractor:
    """High-accuracy DOCX extractor preserving headings, tables, lists."""

    @classmethod
    def extract(cls, file_path: str) -> List[DocumentSection]:
        from docx import Document
        doc = Document(file_path)
        sections = []

        for element in doc.element.body:
            tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag

            if tag == "p":
                para = None
                for p in doc.paragraphs:
                    if p._element is element:
                        para = p
                        break
                if para is None or not para.text.strip():
                    continue

                style = (para.style.name or "").lower()
                text = para.text.strip()

                if "heading" in style:
                    try:
                        level = int(style.replace("heading", "").strip())
                    except ValueError:
                        level = 1
                    sections.append(DocumentSection(text, "heading", level=level))
                elif "list" in style or "bullet" in style:
                    sections.append(DocumentSection(text, "list"))
                elif "title" in style:
                    sections.append(DocumentSection(text, "heading", level=1))
                elif "subtitle" in style:
                    sections.append(DocumentSection(text, "heading", level=2))
                else:
                    runs = para.runs
                    if (runs and all(r.bold for r in runs if r.text.strip())
                            and len(text) < 100):
                        sections.append(DocumentSection(text, "heading", level=3))
                    else:
                        sections.append(DocumentSection(text, "paragraph"))

            elif tag == "tbl":
                for tbl in doc.tables:
                    if tbl._element is element:
                        md_table = cls._table_to_markdown(tbl)
                        if md_table:
                            sections.append(DocumentSection(md_table, "table"))
                        break

        return sections

    @classmethod
    def _table_to_markdown(cls, table) -> str:
        rows = []
        for row in table.rows:
            cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
            rows.append("| " + " | ".join(cells) + " |")
        if len(rows) >= 1:
            sep = "| " + " | ".join("---" for _ in table.rows[0].cells) + " |"
            rows.insert(1, sep)
        return "\n".join(rows) if rows else ""


#Entry Point

EXTENSION_MAP = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".doc": "docx",
}


class DocumentPreprocessor:
    """
    Main entry point for preprocessing PDF and DOCX documents.
    """

    def __init__(self, enable_ocr: bool = False, max_workers: int = 4):
        self.enable_ocr = enable_ocr
        self.max_workers = max_workers

    def process(self, file_path: str) -> StructuredDocument:
        """
        Process a PDF or DOCX file and return a StructuredDocument.
        """
        start = time.perf_counter()
        path = Path(file_path).resolve()

        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        ext = path.suffix.lower()
        handler = EXTENSION_MAP.get(ext)
        if not handler:
            raise ValueError(
                f"Unsupported file type: '{ext}'. "
                f"Supported: {', '.join(sorted(EXTENSION_MAP.keys()))}"
            )

        file_size = path.stat().st_size
        file_hash = self._hash_file(str(path)) #file hash check for no duplication

        metadata = DocumentMetadata(
            filename=path.name,
            file_type=ext,
            file_size_bytes=file_size,
            processed_at=datetime.now(timezone.utc).isoformat(),
            file_hash=file_hash,
        )

        logger.info(f"Processing {path.name} ({handler}, {file_size} bytes)")

        if handler == "pdf":
            sections = self._process_pdf(str(path), metadata)
        elif handler == "docx":
            sections = self._process_docx(str(path), metadata)
        else:
            raise ValueError(f"No handler for: {handler}")

        elapsed_ms = (time.perf_counter() - start) * 1000
        metadata.processing_time_ms = round(elapsed_ms, 2)

        doc = StructuredDocument(metadata=metadata, sections=sections)
        logger.info(
            f"Done: {len(sections)} sections, {elapsed_ms:.0f}ms, "
            f"quality={metadata.quality_score:.3f}"
        )
        return doc

    def _process_pdf(self, path: str, meta: DocumentMetadata) -> List[DocumentSection]:
        page_texts, method, quality = PDFExtractor.extract(
            path, enable_ocr=self.enable_ocr, max_workers=self.max_workers
        )
        meta.extraction_method = method
        meta.quality_score = quality
        meta.page_count = len(page_texts)
        cleaned = NoiseCleaner.clean_pages(page_texts)
        combined = "\n\n".join(cleaned)
        return StructureTagger.tag(combined)

    def _process_docx(self, path: str, meta: DocumentMetadata) -> List[DocumentSection]:
        meta.extraction_method = "python-docx"
        sections = DOCXExtractor.extract(path)
        meta.quality_score = TextQualityEvaluator.evaluate(
            " ".join(s.content for s in sections)
        )
        for s in sections:
            s.content = NoiseCleaner.clean(s.content)
        return [s for s in sections if s.content.strip()]

    @staticmethod
    def _hash_file(path: str, chunk_size: int = 8192) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()
