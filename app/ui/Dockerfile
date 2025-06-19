# Build Stage
FROM node:22 AS builder

WORKDIR /app
COPY ./app/ui/package*.json .
RUN npm install
COPY ./app/ui .
RUN npm run build

# Runtime Stage
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/serve.js ./serve.js
ENV PORT=8080
CMD ["serve.js"]