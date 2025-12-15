from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from ..config import get_settings
from ..schemas import GeneratedAnswer
from .preprocessing import normalize_text
from .vector_store import VectorStore, load_vector_store


@dataclass
class LabelMetadata:
    id: int
    label: str
    answer: str
    category: str | None
    subcategory: str | None
    tags: list[str]
    question_examples: list[str]
    suggested_links: list[str]

    @classmethod
    def from_dict(cls, payload: dict) -> "LabelMetadata":
        return cls(
            id=int(payload.get("id")),
            label=payload.get("label", f"LABEL_{payload.get('id')}") ,
            answer=payload.get("answer", ""),
            category=payload.get("category"),
            subcategory=payload.get("subcategory"),
            tags=list(payload.get("tags", [])),
            question_examples=list(payload.get("question_examples", [])),
            suggested_links=list(payload.get("suggested_links", [])),
        )


class NLPService:
    def __init__(self, model_dir: Path, vector_store: Optional[VectorStore] = None):
        if not model_dir.exists():
            raise FileNotFoundError(f"Model directory not found: {model_dir}")
        self.model_dir = model_dir
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        self.label_metadata = self._load_label_metadata(model_dir)
        self.id_to_metadata = {meta.id: meta for meta in self.label_metadata}
        self.vector_store = vector_store

    @staticmethod
    def _load_label_metadata(model_dir: Path) -> List[LabelMetadata]:
        metadata_path = model_dir / "label_mapping.json"
        if not metadata_path.exists():
            raise FileNotFoundError(
                "label_mapping.json not found in model directory. "
                "Run the training script to export label metadata."
            )
        with metadata_path.open("r", encoding="utf-8") as fp:
            payload = json.load(fp)
        labels = payload.get("labels", payload)
        return [LabelMetadata.from_dict(item) for item in labels]

    def predict(self, text: str, top_k: int = 3) -> GeneratedAnswer:
        normalized = normalize_text(text)
        encoded = self.tokenizer(
            normalized,
            padding=True,
            truncation=True,
            max_length=256,
            return_tensors="pt",
        )
        encoded = {key: value.to(self.device) for key, value in encoded.items()}
        with torch.no_grad():
            outputs = self.model(**encoded)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=-1)

        top_probabilities, top_indices = torch.topk(probabilities, k=min(top_k, probabilities.shape[-1]))
        best_index = int(top_indices[0][0].item())
        confidence = float(top_probabilities[0][0].item())
        metadata = self.id_to_metadata.get(best_index)
        if metadata is None:
            raise ValueError(f"Label metadata missing for id {best_index}")

        similar_questions: list[str] = []
        suggested_links: list[str] = list(metadata.suggested_links)

        if self.vector_store:
            neighbours = self.vector_store.search(text, top_k=top_k)
            similar_questions = [item.question for item in neighbours if item.question]
            for item in neighbours:
                for link in item.suggested_links:
                    if link not in suggested_links:
                        suggested_links.append(link)

        return GeneratedAnswer(
            text=metadata.answer,
            category=metadata.category,
            subcategory=metadata.subcategory,
            confidence=confidence,
            similar_questions=similar_questions,
            suggested_links=suggested_links,
        )


def get_nlp_service() -> NLPService:
    settings = get_settings()
    vector_store = load_vector_store(settings.vector_store_path)
    return NLPService(model_dir=settings.model_dir, vector_store=vector_store)
