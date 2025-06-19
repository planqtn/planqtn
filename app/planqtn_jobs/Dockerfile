FROM python:3.12-slim

WORKDIR /app

RUN pip install --upgrade pip uv

COPY pyproject.toml /app/pyproject.toml
COPY app/planqtn_jobs/requirements.txt /app/planqtn_jobs/requirements.txt

RUN uv pip install -r pyproject.toml -r /app/planqtn_jobs/requirements.txt --system

COPY ./qlego /app/qlego
COPY ./app/planqtn_types /app/planqtn_types
COPY ./app/planqtn_jobs /app/planqtn_jobs


WORKDIR /app

ENV TERM=xterm
ENV PYTHONPATH=/app

ENTRYPOINT ["python"]

