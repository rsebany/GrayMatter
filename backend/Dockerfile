FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

WORKDIR /app

# Avoid apt By-Hash failures behind some Docker Desktop / proxy setups
RUN rm -rf /var/lib/apt/lists/* \
    && printf 'Acquire::By-Hash "no";\nAcquire::http::Pipeline-Depth "0";\n' \
       > /etc/apt/apt.conf.d/99docker-apt \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements first for layer caching
COPY backend/requirements-api.txt /tmp/backend-requirements.txt
COPY ai/requirements.txt /tmp/ai-requirements.txt
RUN pip install --no-cache-dir -r /tmp/backend-requirements.txt \
    && grep -v '^torch' /tmp/ai-requirements.txt > /tmp/ai-requirements-no-torch.txt \
    && pip install --no-cache-dir -r /tmp/ai-requirements-no-torch.txt

# Copy only backend application code (ai module mounted as volume in compose)
COPY backend/ /app/

ENV GRAYMATTER_AI_ROOT=/app/ai
ENV GRAYMATTER_CHECKPOINT=/app/ai/checkpoints/model.pt
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
