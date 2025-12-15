from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
from sklearn.metrics.pairwise import linear_kernel

from .preprocessing import normalize_text


@dataclass
class SimilarQuestion:
    question: str
    answer: str
    category: str | None
    subcategory: str | None
    score: float
    tags: list[str]
    suggested_links: list[str]


class VectorStore:
    def __init__(self, vectorizer, matrix, metadata: List[Dict[str, Any]]):
        self.vectorizer = vectorizer
        self.matrix = matrix
        self.metadata = metadata

    @classmethod
    def load(cls, path: Path | str) -> Optional["VectorStore"]:
        file_path = Path(path)
        if not file_path.exists():
            return None
        payload = joblib.load(file_path)
        return cls(
            vectorizer=payload["vectorizer"],
            matrix=payload["matrix"],
            metadata=payload["metadata"],
        )

    def search(self, query: str, top_k: int = 5, score_threshold: float = 0.3) -> List[SimilarQuestion]:
        if not query.strip():
            return []
        normalized = normalize_text(query)
        query_vector = self.vectorizer.transform([normalized])
        scores = linear_kernel(query_vector, self.matrix).flatten()
        top_indices = np.argsort(scores)[::-1][:top_k]

        results: List[SimilarQuestion] = []
        for idx in top_indices:
            score = float(scores[idx])
            if score < score_threshold:
                continue
            item = self.metadata[idx]
            results.append(
                SimilarQuestion(
                    question=item.get("question", ""),
                    answer=item.get("answer", ""),
                    category=item.get("category"),
                    subcategory=item.get("subcategory"),
                    score=score,
                    tags=item.get("tags", []),
                    suggested_links=item.get("suggested_links", []),
                )
            )
        return results


def load_vector_store(path: Path | str | None) -> Optional[VectorStore]:
    if not path:
        return None
    return VectorStore.load(path)
























