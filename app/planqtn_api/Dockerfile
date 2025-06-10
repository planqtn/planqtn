FROM python:3.12-slim

WORKDIR /app

RUN pip install --upgrade pip

COPY requirements.txt /app/requirements.txt
COPY app/planqtn_api/requirements.txt /app/planqtn_api/requirements.txt   

RUN pip install -r requirements.txt -r /app/planqtn_api/requirements.txt --root-user-action=ignore

COPY ./qlego /app/qlego
COPY ./app/planqtn_api /app/planqtn_api
COPY ./app/planqtn_types /app/planqtn_types


WORKDIR /app

ENV TERM=xterm
ENV PYTHONPATH=/app

ENTRYPOINT ["python", "/app/planqtn_api/planqtn_server.py"]