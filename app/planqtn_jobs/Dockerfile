FROM python:3.12-slim

WORKDIR /app

RUN pip install --upgrade pip

COPY requirements.txt /app/requirements.txt
COPY app/planqtn_jobs/requirements.txt /app/planqtn_jobs/requirements.txt

RUN pip install -r requirements.txt -r planqtn_jobs/requirements.txt --root-user-action=ignore

COPY ./qlego /app/qlego
COPY ./app/planqtn_types /app/planqtn_types
COPY ./app/planqtn_jobs /app/planqtn_jobs


WORKDIR /app

ENV TERM=xterm
ENV PYTHONPATH=/app

ENTRYPOINT ["python"]

