FROM python:3.12-slim

WORKDIR /app

RUN pip install --upgrade pip uv

COPY pyproject.toml /app/pyproject.toml
COPY app/planqtn_api/requirements.txt /app/planqtn_api/requirements.txt   

RUN uv pip install -r pyproject.toml -r /app/planqtn_api/requirements.txt --system

COPY ./qlego /app/qlego
COPY ./app/planqtn_api /app/planqtn_api
COPY ./app/planqtn_types /app/planqtn_types


WORKDIR /app

ENV TERM=xterm
ENV PYTHONPATH=/app

ENTRYPOINT ["python", "/app/planqtn_api/planqtn_server.py"]