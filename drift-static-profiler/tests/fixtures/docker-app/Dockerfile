FROM python:3.12-slim

WORKDIR /srv

COPY app ./app
COPY worker.py .

# JSON-array (exec) form — preferred. argv[1] resolves to app/main.py.
ENTRYPOINT ["python", "-m", "app.main"]
CMD ["--prod"]
