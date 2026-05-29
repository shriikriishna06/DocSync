FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .

RUN pip install --no-cache-dir \
        torch torchvision torchaudio \
        --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

RUN find /usr/local/lib/python3.11/site-packages \
        \( -type d -name "tests" -o \
           -type d -name "test" -o \
           -type d -name "benchmarks" -o \
           -type d -name "__pycache__" -o \
           -name "*.pyc" -o \
           -name "*.pyo" \) \
        -exec rm -rf {} + 2>/dev/null || true

RUN rm -rf /usr/local/lib/python3.11/site-packages/torch/lib/libcudart* \
           /usr/local/lib/python3.11/site-packages/torch/lib/libnvrtc* \
           /usr/local/lib/python3.11/site-packages/torch/lib/libcublas* \
           /usr/local/lib/python3.11/site-packages/torch/lib/libcufft* \
           /usr/local/lib/python3.11/site-packages/torch/lib/libcusparse* \
           /usr/local/lib/python3.11/site-packages/torch/lib/libcudnn* \
           /usr/local/lib/python3.11/site-packages/torch/lib/libnccl* \
           /usr/local/lib/python3.11/site-packages/nvidia/ \
    2>/dev/null || true


FROM python:3.11-slim AS runtime

LABEL maintainer="DocSync" \
      description="DocSync RAG Study Assistant Backend" \
      version="1.0"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/huggingface \
    TOKENIZERS_PARALLELISM=false

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        tesseract-ocr \
        libglib2.0-0 \
        libgl1 \
        curl \
    && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

RUN mkdir -p /app/.cache/huggingface /app/data && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
