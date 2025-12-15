from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from datasets import Dataset, DatasetDict
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, f1_score, precision_recall_fscore_support
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    set_seed,
)

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from app.services.preprocessing import batch_normalize


LOGGER = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune a Turkish BERT model for ISTE chatbot")
    parser.add_argument(
        "--data-path",
        type=Path,
        default=ROOT_DIR / "data" / "raw" / "train.csv",
        help="Path to the CSV dataset containing question/answer pairs.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT_DIR / "models" / datetime.now().strftime("%Y%m%d_%H%M%S"),
        help="Directory to save the fine-tuned model.",
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="dbmdz/bert-base-turkish-cased",
        help="Name of the pretrained model to fine-tune.",
    )
    parser.add_argument("--test-size", type=float, default=0.1, help="Test split size for evaluation.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs.")
    parser.add_argument("--batch-size", type=int, default=16, help="Training batch size.")
    parser.add_argument("--learning-rate", type=float, default=5e-5, help="Learning rate.")
    parser.add_argument(
        "--max-length",
        type=int,
        default=128,
        help="Maximum sequence length for tokenizer padding/truncation.",
    )
    return parser.parse_args()


def load_dataset(data_path: Path) -> pd.DataFrame:
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset not found at {data_path}")
    df = pd.read_csv(data_path)
    required_columns = {"question", "answer"}
    if missing := required_columns - set(df.columns):
        raise ValueError(f"Dataset missing required columns: {missing}")
    df = df.dropna(subset=["question", "answer"]).copy()
    df["question"] = df["question"].astype(str)
    df["answer"] = df["answer"].astype(str)
    for col in ("category", "subcategory", "tags"):
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str)
    return df


def build_label_mapping(df: pd.DataFrame) -> tuple[pd.DataFrame, List[Dict[str, Any]]]:
    unique_answers = df["answer"].astype(str).unique()
    answer_to_id = {answer: idx for idx, answer in enumerate(unique_answers)}
    df = df.assign(label_id=df["answer"].map(answer_to_id))

    metadata: List[Dict[str, Any]] = []
    for answer, group in df.groupby("answer"):
        first_row = group.iloc[0]
        metadata.append(
            {
                "id": int(first_row["label_id"]),
                "label": f"LABEL_{int(first_row['label_id'])}",
                "answer": str(answer),
                "question_examples": group["question"].head(10).tolist(),
                "suggested_links": [],
            }
        )
    metadata = sorted(metadata, key=lambda x: x["id"])
    return df, metadata


def prepare_datasets(
    df: pd.DataFrame,
    test_size: float,
    seed: int,
    tokenizer,
    max_length: int,
) -> tuple[DatasetDict, Dict[int, str], Dict[str, int]]:
    if len(df) < 2:
        train_df = df.copy()
        eval_df = df.iloc[0:0].copy()
    else:
        train_df, eval_df = train_test_split(df, test_size=test_size, random_state=seed, shuffle=True)

    label_counts = df["label_id"].value_counts()
    labels_in_train = set(train_df["label_id"])

    for label in label_counts.index:
        if label not in labels_in_train:
            candidate_idx = eval_df[eval_df["label_id"] == label].index
            if not candidate_idx.empty:
                idx = candidate_idx[0]
                train_df = pd.concat([train_df, eval_df.loc[[idx]]], ignore_index=True)
                eval_df = eval_df.drop(idx)
                labels_in_train.add(label)
                LOGGER.warning("Taşınan tekil etiket %s validation kümesinden train kümesine alındı.", label)
            else:
                LOGGER.warning("Etiket %s validation kümesinde bulunamadı, train kümesinde tekil kalabilir.", label)
                labels_in_train.add(label)

    if len(eval_df) == 0 and len(train_df) > 1:
        candidate_labels = label_counts[label_counts > 1].index
        fallback_row = train_df[train_df["label_id"].isin(candidate_labels)].head(1)
        if not fallback_row.empty:
            eval_df = fallback_row.copy()
            train_df = train_df.drop(fallback_row.index)
            LOGGER.warning("Validation kümesi boş kaldığı için train kümesinden %s etiketi örneklenerek eklendi.", fallback_row.iloc[0]["label_id"])
        else:
            LOGGER.warning("Validation kümesi boş kaldı; eğitim değerlendirmesiz devam edecek.")
            eval_df = train_df.iloc[0:0].copy()

    def tokenize_batch(batch: Dict[str, List[str]]) -> Dict[str, Any]:
        return tokenizer(
            batch["question_normalized"],
            padding="max_length",
            truncation=True,
            max_length=max_length,
        )

    train_dataset = Dataset.from_pandas(train_df[["question", "question_normalized", "label_id"]], preserve_index=False)
    eval_dataset = Dataset.from_pandas(eval_df[["question", "question_normalized", "label_id"]], preserve_index=False)

    train_dataset = train_dataset.map(tokenize_batch, batched=True)
    eval_dataset = eval_dataset.map(tokenize_batch, batched=True)

    train_dataset = train_dataset.remove_columns(["question", "question_normalized"])
    eval_dataset = eval_dataset.remove_columns(["question", "question_normalized"])

    if "label_id" in train_dataset.column_names:
        train_dataset = train_dataset.rename_column("label_id", "labels")
    if "label_id" in eval_dataset.column_names:
        eval_dataset = eval_dataset.rename_column("label_id", "labels")

    datasets = DatasetDict({"train": train_dataset, "validation": eval_dataset})

    id2label = {int(row["label_id"]): f"LABEL_{int(row['label_id'])}" for _, row in df.drop_duplicates("label_id").iterrows()}
    label2id = {label: idx for idx, label in id2label.items()}

    return datasets, id2label, label2id


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average="weighted", zero_division=0)
    acc = accuracy_score(labels, preds)
    return {"accuracy": acc, "f1": f1, "precision": precision, "recall": recall}


def build_vector_store(df: pd.DataFrame, output_dir: Path) -> None:
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=25000)
    matrix = vectorizer.fit_transform(df["question_normalized"])  # type: ignore[arg-type]
    metadata = []
    for _, row in df.iterrows():
        entry = {
            "question": row["question"],
            "answer": row["answer"],
            "suggested_links": [],
        }
        if "category" in row:
            entry["category"] = row["category"]
        if "subcategory" in row:
            entry["subcategory"] = row["subcategory"]
        metadata.append(entry)
    joblib.dump(
        {"vectorizer": vectorizer, "matrix": matrix, "metadata": metadata},
        output_dir / "vector_store.joblib",
    )


def main():
    args = parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    logger = logging.getLogger("train_classifier")

    set_seed(args.seed)

    logger.info("Loading dataset from %s", args.data_path)
    df = load_dataset(args.data_path)

    logger.info("Normalizing questions")
    df["question_normalized"] = batch_normalize(df["question"].tolist())

    logger.info("Building label mapping")
    df, label_metadata = build_label_mapping(df)

    logger.info("Preparing tokenizer")
    tokenizer = AutoTokenizer.from_pretrained(args.model_name)

    datasets, id2label, label2id = prepare_datasets(
        df=df,
        test_size=args.test_size,
        seed=args.seed,
        tokenizer=tokenizer,
        max_length=args.max_length,
    )

    has_eval = len(datasets["validation"]) > 0

    logger.info("Initializing model")
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model_name,
        num_labels=len(id2label),
        id2label=id2label,
        label2id=label2id,
    )

    training_args = TrainingArguments(
        output_dir=args.output_dir / "checkpoints",
        eval_strategy="epoch" if has_eval else "no",
        save_strategy="epoch" if has_eval else "no",
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        weight_decay=0.01,
        load_best_model_at_end=has_eval,
        metric_for_best_model="f1",
        logging_strategy="steps",
        logging_steps=50,
        fp16=False,
        save_total_limit=2,
    )

    logger.info("Starting training")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=datasets["train"],
        eval_dataset=datasets["validation"] if has_eval else None,
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
    )

    trainer.train()

    metrics: Dict[str, Any] = {}
    if has_eval:
        logger.info("Evaluating best model")
        metrics = trainer.evaluate()
        logger.info("Evaluation metrics: %s", metrics)
    else:
        logger.info("Doğrulama veri kümesi bulunmadığı için değerlendirme atlandı.")

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Saving model to %s", output_dir)
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)

    label_path = output_dir / "label_mapping.json"
    with label_path.open("w", encoding="utf-8") as fp:
        json.dump({"labels": label_metadata, "metrics": metrics}, fp, ensure_ascii=False, indent=2)

    logger.info("Building TF-IDF vector store")
    build_vector_store(df, output_dir)

    logger.info("Training completed successfully")


if __name__ == "__main__":
    main()
