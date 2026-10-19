"""Sentence embeddings with ONNX Runtime — no PyTorch, no sentence-transformers.

Runs the int8-quantized ONNX export of intfloat/multilingual-e5-small (Swedish +
English) with mean pooling and L2 normalisation, as the model card prescribes.
E5 is asymmetric: texts to be searched are prefixed "passage: ", search texts "query: ".

Two choices keep the resident memory low:
- Tokenisation uses the 5 MB SentencePiece model (~60 MB RAM) instead of the
  Hugging Face `tokenizers` JSON for the same 250k vocabulary (~290 MB RAM).
  Token IDs are identical.
- The ONNX session runs without the CPU memory arena and with basic graph
  optimisation, which avoids ~150 MB of pre-allocated buffers.
"""

import logging
from pathlib import Path
from typing import List, Sequence

import numpy as np
import onnxruntime as ort
import sentencepiece as spm

logger = logging.getLogger("Embeddings")

# XLM-RoBERTa vocabulary layout: special tokens occupy IDs 0-3 and every
# SentencePiece ID is shifted by one (SentencePiece's own <unk>=0 maps to 3).
BOS_ID, PAD_ID, EOS_ID, UNK_ID = 0, 1, 2, 3

PASSAGE_PREFIX = "passage: "
QUERY_PREFIX = "query: "


class Embedder:
    def __init__(self, model_name: str, model_dir: str, threads: int, batch_size: int, max_tokens: int = 256):
        path = Path(model_dir)
        model_file = path / "model.onnx"
        logger.info("Loading embedding model %s from %s (threads=%s)", model_name, path, threads)

        self.model_name = model_name
        self._batch_size = max(1, batch_size)
        self._max_tokens = max(8, max_tokens)
        self._sentencepiece = spm.SentencePieceProcessor(model_file=str(path / "sentencepiece.bpe.model"))

        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        self._session = ort.InferenceSession(str(model_file), options, providers=["CPUExecutionProvider"])
        self._input_names = {item.name for item in self._session.get_inputs()}

    def _token_ids(self, text: str) -> List[int]:
        pieces = self._sentencepiece.encode(text)[: self._max_tokens - 2]
        return [BOS_ID] + [piece + 1 if piece != 0 else UNK_ID for piece in pieces] + [EOS_ID]

    def _embed_batch(self, texts: Sequence[str]) -> np.ndarray:
        sequences = [self._token_ids(text) for text in texts]
        width = max(len(sequence) for sequence in sequences)

        input_ids = np.full((len(sequences), width), PAD_ID, dtype=np.int64)
        attention_mask = np.zeros((len(sequences), width), dtype=np.int64)
        for row, sequence in enumerate(sequences):
            input_ids[row, : len(sequence)] = sequence
            attention_mask[row, : len(sequence)] = 1

        feed = {"input_ids": input_ids, "attention_mask": attention_mask}
        if "token_type_ids" in self._input_names:
            feed["token_type_ids"] = np.zeros_like(input_ids)

        token_embeddings = self._session.run(None, feed)[0]

        # Mean pooling over real (non-padding) tokens, then unit length.
        mask = attention_mask[..., None].astype(np.float32)
        pooled = (token_embeddings * mask).sum(axis=1) / np.clip(mask.sum(axis=1), 1e-9, None)
        return pooled / np.clip(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12, None)

    def _embed(self, texts: Sequence[str], prefix: str) -> List[List[float]]:
        vectors: List[List[float]] = []
        prefixed = [prefix + text for text in texts]
        for start in range(0, len(prefixed), self._batch_size):
            vectors.extend(self._embed_batch(prefixed[start : start + self._batch_size]).tolist())
        return vectors

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        """Vectors for texts that will be searched (job ads)."""
        return self._embed(texts, PASSAGE_PREFIX)

    def embed_queries(self, texts: Sequence[str]) -> List[List[float]]:
        """Vectors for search texts (a typed term, or chunks of a CV)."""
        return self._embed(texts, QUERY_PREFIX)
