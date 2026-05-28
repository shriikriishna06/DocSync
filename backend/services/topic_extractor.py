import re
from difflib import SequenceMatcher

#topic extractor based on chunked data 
def stage1_structural(raw_topics: list[str]) -> list[str]:
    FUNCTION_WORDS = {
        "is", "are", "was", "were", "be", "been",
        "used", "for", "and", "in", "the", "of",
        "to", "a", "an", "that", "this", "with",
        "by", "as", "at", "from", "on", "it",
        "its", "not", "but", "or"
    }

    def extract_core(text: str) -> str:
        separators = [
            " > ",
            " → ",
            " / ",
            " | ",
            " :: "
        ]

        for sep in separators:
            if sep in text:
                return text.split(sep)[-1]
        return text

    def strip_artifacts(text: str) -> str:
        text = text.strip()
        text = re.sub(r"^[\(\[\{\"\'•·\-–—*►▶▸]+\s*","",text)
        text = re.sub(r"[\)\]\}\"\']+$","",text)
        text = re.sub(r"^[\(\[]?(\d+|[ivxlIVXL]+|[a-zA-Z])[\.:\)\]]\s+","",text)
        text = re.sub(r"[:\;,\.]+$","",text)
        text = re.sub(r"\s+"," ",text).strip()
        return text

    def normalize_case(text: str) -> str:
        if text.islower():
            return text.title()
        return text

    def is_structural_noise(text: str) -> bool:
        if len(text) < 3:
            return True
        words = text.split()

        if len(words) > 10 or len(text) > 100:
            return True

        if re.search(r'\s\d+$', text):
            return True
        
        digit_ratio = (
            sum(c.isdigit() for c in text)
            / len(text)
        )

        if digit_ratio > 0.5:
            return True

        lower_words = [w.lower() for w in words]

        func_count = sum(1 for w in lower_words if w in FUNCTION_WORDS)
        if (len(words) > 0 and func_count / len(words) > 0.5):
            return True
        
        if (re.match(r'^\d+\s*[a-zA-Z]{1,5}\b',text) and len(words) > 4):
            return True
        return False

    seen = set()
    result = []

    for raw in raw_topics:
        t = extract_core(raw.strip())
        t = strip_artifacts(t)
        t = normalize_case(t)
        if is_structural_noise(t):
            continue
        key = t.lower()
        if key not in seen:
            seen.add(key)
            result.append(t)
    return result

DEFAULT_META_KEYWORDS = [
    "question bank",
    "index",
    "table of contents",
    "references",
    "bibliography",
    "appendix",
    "preface",
    "foreword",
    "acknowledgement",
    "acknowledgment",
    "syllabus",
    "curriculum",
    "course outline",
    "module",
]

LEADING_CONJUNCTIONS = {
    "and", "or", "but", "nor",
    "so", "yet", "for",
    "because", "although",
    "since", "unless",
    "until", "however",
    "therefore", "moreover",
    "furthermore",
}

def stage2_semantic(topics: list[str],extra_meta_keywords=None,similarity_threshold=0.88,numbered_variant_min_count=2,subset_min_parents=3):
    meta_kws = list(DEFAULT_META_KEYWORDS)

    if extra_meta_keywords:
        meta_kws.extend(
            kw.lower()
            for kw in extra_meta_keywords
        )

    def fix_ocr_spacing(text: str) -> str:
        tokens = text.split()
        if not tokens:
            return text
        single_ratio = (sum(1 for t in tokens if len(t) == 1)/ len(tokens))

        if single_ratio <= 0.5:
            return text

        groups = []

        for token in tokens:
            if len(token) > 1 or not groups:
                groups.append([token])
            else:
                groups[-1].append(token)

        words = ["".join(g).lower().capitalize() for g in groups]
        return " ".join(words)

    def strip_trailing_artifacts(text: str) -> str:
        text = re.sub(r'\s*[-–—]+\s*$','',text)
        text = re.sub(r'\s*\([^)]*$','',text)
        text = re.sub(r'\s*\[[^\]]*$','',text)
        return text.strip()

    def is_broken_fragment(text: str) -> bool:
        words = text.split()
        return (
            len(words) == 1
            and len(text) <= 4
        )

    def is_meta(text: str) -> bool:
        lower = text.lower()
        return any(
            kw in lower
            for kw in meta_kws
        )

    def starts_with_conjunction(text: str) -> bool:
        first = (
            text.split()[0].lower()
            if text.split()
            else ""
        )
        return first in LEADING_CONJUNCTIONS

    def is_numbered_variant(text: str) -> bool:
        return bool(re.search(r'\s+\d+$', text))

    def get_base(text: str) -> str:
        return re.sub(r'\s+\d+$','',text).strip()

    def similarity(a: str, b: str) -> float:
        return SequenceMatcher(
            None,
            a.lower(),
            b.lower()
        ).ratio()

    def is_subset_topic(topic: str,pool: list[str]) -> bool:
        if len(topic.split()) != 1:
            return False
        matches = sum(
            1 for t in pool
            if (
                t.lower() != topic.lower()
                and topic.lower() in t.lower()
            )
        )
        return matches >= subset_min_parents

    processed = []

    for t in topics:
        t = fix_ocr_spacing(t.strip())
        t = strip_trailing_artifacts(t)
        if t:
            processed.append(t)

    base_counts = {}
    for t in processed:
        if is_numbered_variant(t):
            base = get_base(t)
            base_counts[base] = (base_counts.get(base, 0)+ 1)

    collapse_bases = {b for b, c in base_counts.items() if c >= numbered_variant_min_count}

    filtered = []
    added_bases = set()

    for t in processed:
        if is_meta(t):
            continue
        if starts_with_conjunction(t):
            continue
        if is_broken_fragment(t):
            continue
        if is_numbered_variant(t):
            base = get_base(t)
            if base in collapse_bases:
                if base not in added_bases and not is_meta(base):
                    added_bases.add(base)
                    filtered.append(base)
                continue
        filtered.append(t)

    non_subset = [
        t for t in filtered
        if not is_subset_topic(t, filtered)
    ]

    deduped = []

    for candidate in non_subset:
        merged = False
        for i, existing in enumerate(deduped):
            if (similarity(candidate, existing) >= similarity_threshold):
                if len(candidate) > len(existing):
                    deduped[i] = candidate
                merged = True
                break
        if not merged:
            deduped.append(candidate)
    return sorted(set(deduped))

def clean_topics(raw_topics: list[str],extra_meta_keywords=None,similarity_threshold=0.88,):
    after_stage1 = stage1_structural(raw_topics)
    after_stage2 = stage2_semantic(
        after_stage1,
        extra_meta_keywords=extra_meta_keywords,
        similarity_threshold=similarity_threshold,
    )
    return after_stage2

def extract_topics(chunks):
    raw_topics = []
    for chunk in chunks:
        context = (chunk["metadata"].get("context"))
        if context:
            raw_topics.append(context)
    return clean_topics(raw_topics)
