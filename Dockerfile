# Dockerfile para deploy no Render
FROM python:3.12-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

# Copiar requirements.txt e instalar
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo o código do backend
COPY backend/ .

# Criar diretório para uploads
RUN mkdir -p /app/uploads

# Expor a porta
EXPOSE 8000

# Comando para rodar migrações e iniciar a aplicação
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
