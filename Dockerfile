FROM python:3.12-slim
WORKDIR /app

RUN pip install --upgrade pip


RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    apt-get install -y redis-server && \
    apt-get install -y procps && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
COPY server/requirements.txt /app/server/requirements.txt   

RUN pip install -r requirements.txt -r server/requirements.txt --root-user-action=ignore

COPY . /app


WORKDIR /app/ui

RUN npm --version

RUN npm install 

WORKDIR /app

ENV TERM=xterm

CMD ["./container_entry_point.sh"]