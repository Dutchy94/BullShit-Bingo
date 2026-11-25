FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd -u 10001 --no-create-home bingo && mkdir /data && chown bingo /data
COPY main.py begriffe.md ./
COPY static ./static
USER bingo
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
