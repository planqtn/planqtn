# Build Stage
FROM nikolaik/python-nodejs:python3.13-nodejs24-slim AS builder


RUN mkdir -p /planqtn/app/ui
RUN mkdir -p /planqtn/docs

# Install Python dependencies
COPY ./docs/requirements.txt /planqtn/docs/requirements.txt 
RUN pip install --upgrade uv
RUN uv pip install -r /planqtn/docs/requirements.txt  --system
ENV PYTHONPATH=/planqtn/

COPY ./app/ui/package*.json /planqtn/app/ui/

RUN cd /planqtn/app/ui && npm install
COPY ./app/ui /planqtn/app/ui

COPY ./mkdocs.yml /planqtn/mkdocs.yml
COPY ./docs /planqtn/docs
COPY ./planqtn /planqtn/planqtn
RUN cd /planqtn/app/ui && npm run build


# Runtime Stage
FROM gcr.io/distroless/nodejs24-debian12

WORKDIR /planqtn/app/ui
COPY --from=builder /planqtn/app/ui/dist /planqtn/app/ui/dist
COPY --from=builder /planqtn/app/ui/node_modules /planqtn/app/ui/node_modules
COPY --from=builder /planqtn/app/ui/serve.js /planqtn/app/ui/serve.js
ENV PORT=8080
CMD ["serve.js"]