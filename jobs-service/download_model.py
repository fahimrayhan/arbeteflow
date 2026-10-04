"""Download the embedding model files into MODEL_DIR (run at image build time).

Usage: python download_model.py            # uses MODEL_DIR or ./models/minilm
"""

import os
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download

# int8-quantized ONNX export of sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
ONNX_REPO = "qdrant/paraphrase-multilingual-MiniLM-L12-v2-onnx-Q"
ONNX_FILE = "model_optimized.onnx"
# Original repo — provides the 5 MB SentencePiece vocabulary.
TOKENIZER_REPO = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
TOKENIZER_FILE = "sentencepiece.bpe.model"


def main() -> None:
    target = Path(os.getenv("MODEL_DIR", "./models/minilm"))
    target.mkdir(parents=True, exist_ok=True)

    for repo, filename, destination in [
        (ONNX_REPO, ONNX_FILE, "model.onnx"),
        (TOKENIZER_REPO, TOKENIZER_FILE, TOKENIZER_FILE),
    ]:
        cached = hf_hub_download(repo_id=repo, filename=filename)
        shutil.copyfile(cached, target / destination)
        print(f"{repo}/{filename} -> {target / destination}")


if __name__ == "__main__":
    main()
