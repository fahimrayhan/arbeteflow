"""Download the embedding model files into MODEL_DIR (run at image build time).

Usage: python download_model.py            # uses MODEL_DIR or ./models/e5-small
"""

import os
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download

# int8-quantized ONNX export of intfloat/multilingual-e5-small (Swedish + English, 384 dims).
ONNX_REPO = "Xenova/multilingual-e5-small"
ONNX_FILE = "onnx/model_quantized.onnx"
# 5 MB SentencePiece vocabulary (the XLM-RoBERTa vocabulary shared by both models).
TOKENIZER_FILE = "sentencepiece.bpe.model"


def main() -> None:
    target = Path(os.getenv("MODEL_DIR", "./models/e5-small"))
    target.mkdir(parents=True, exist_ok=True)

    for filename, destination in [
        (ONNX_FILE, "model.onnx"),
        (TOKENIZER_FILE, TOKENIZER_FILE),
    ]:
        cached = hf_hub_download(repo_id=ONNX_REPO, filename=filename)
        shutil.copyfile(cached, target / destination)
        print(f"{ONNX_REPO}/{filename} -> {target / destination}")


if __name__ == "__main__":
    main()
