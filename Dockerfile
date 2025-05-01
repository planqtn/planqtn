############################################# BUILD UI #############################################
FROM node:22-slim AS ui-build

COPY ./ui /ui

WORKDIR /ui

RUN npm install && npm run build

############################################# INSTALL BACKEND SERVICES #############################################
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

COPY ./qlego /app/qlego
COPY ./server /app/server
COPY ./multi-service-container-entrypoint.sh /app/multi-service-container-entrypoint.sh
COPY --from=ui-build /ui/dist /app/ui/dist
COPY --from=ui-build /ui/serve.js /app/ui/serve.js
COPY --from=ui-build /ui/node_modules /app/ui/node_modules
COPY --from=ui-build /ui/package-lock.json /app/ui/package-lock.json
COPY --from=ui-build /ui/package.json /app/ui/package.json

WORKDIR /app

ENV TERM=xterm

CMD ["./multi-service-container-entrypoint.sh"]