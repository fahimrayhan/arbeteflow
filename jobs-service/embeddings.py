"""Sentence embeddings with ONNX Runtime — no PyTorch, no sentence-transformers.

Runs the int8-quantized ONNX export of paraphrase-multilingual-MiniLM-L12-v2
(Swedish + English) with mean pooling, exactly like sentence-transformers does,
and produces the same vectors.

Two choices keep the resident memory low (measured on this model):
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

MAX_TOKENS = 128  # sequence length the model was trained with

# XLM-RoBERTa vocabulary layout: special tokens occupy IDs 0-3 and every
# SentencePiece ID is shifted by one (SentencePiece's own <unk>=0 maps to 3).
BOS_ID, PAD_ID, EOS_ID, UNK_ID = 0, 1, 2, 3


class Embedder:
    def __init__(self, model_name: str, model_dir: str, threads: int, batch_size: int):
        path = Path(model_dir)
        model_file = path / "model.onnx"
        logger.info("Loading embedding model %s from %s (threads=%s)", model_name, path, threads)

        self.model_name = model_name
        self._batch_size = max(1, batch_size)
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
        pieces = self._sentencepiece.encode(text)[: MAX_TOKENS - 2]
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

        # Mean pooling over real (non-padding) tokens.
        mask = attention_mask[..., None].astype(np.float32)
        return (token_embeddings * mask).sum(axis=1) / np.clip(mask.sum(axis=1), 1e-9, None)

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        vectors: List[List[float]] = []
        for start in range(0, len(texts), self._batch_size):
            vectors.extend(self._embed_batch(texts[start : start + self._batch_size]).tolist())
        return vectors

    def embed_query(self, text: str) -> List[float]:
        return self._embed_batch([text])[0].tolist()
