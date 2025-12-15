from __future__ import annotations

import re
import unicodedata
from typing import Iterable, List

import nltk

# Ensure the punkt tokenizer is available for sentence splitting if needed
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:  # pragma: no cover - defensive download
    nltk.download("punkt")

# Translation tables for Turkish specific lower-case behaviour
TURKISH_LOWER_MAP = str.maketrans({
    "I": "ı",
    "İ": "i",
})

# Characters we want to keep after normalization
ALLOWED_CHARS_PATTERN = re.compile(r"[^a-z0-9çğıöşü\s]")
MULTI_SPACE_PATTERN = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    """Lowercase, strip punctuation, and standardize whitespace for Turkish text."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", text.strip())
    normalized = normalized.translate(TURKISH_LOWER_MAP).lower()
    normalized = normalized.replace("i̇", "i")
    normalized = ALLOWED_CHARS_PATTERN.sub(" ", normalized)
    normalized = MULTI_SPACE_PATTERN.sub(" ", normalized)
    return normalized.strip()


WORD_PATTERN = re.compile(r"[a-z0-9çğıöşü]+")


def tokenize(text: str) -> List[str]:
    normalized = normalize_text(text)
    return WORD_PATTERN.findall(normalized)


def sentence_split(text: str) -> List[str]:
    """Split text into sentences using NLTK punkt."""
    if not text:
        return []
    from nltk.tokenize import sent_tokenize

    sentences = sent_tokenize(text, language="turkish")
    return [s.strip() for s in sentences if s.strip()]


def batch_normalize(texts: Iterable[str]) -> List[str]:
    return [normalize_text(t) for t in texts]
























