FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MODEL_DIR=/opt/models/minilm \
    CHROMA_PATH=/data/chroma \
    # Keep ONNX Runtime and BLAS from spawning one thread per host core.
    OMP_NUM_THREADS=2 \
    EMBEDDING_THREADS=2 \
    ANONYMIZED_TELEMETRY=False

WORKDIR /app

# All dependencies ship prebuilt wheels: no compiler, no curl, no apt layer.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Bake the int8 ONNX model (~240 MB) into the image so containers start offline and fast.
COPY download_model.py .
RUN HF_HOME=/tmp/hf python download_model.py && rm -rf /tmp/hf

RUN useradd --system --uid 10001 --home-dir /app app \
    && mkdir -p /data/chroma \
    && chown -R app:app /data

COPY --chown=app:app *.py ./

USER app
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)" || exit 1

# A single worker: the embedding model and Chroma's persistent directory are per-process.
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
