FROM node:22-alpine
WORKDIR /app
COPY server ./server
COPY dist ./dist
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
ENV PORT=3001
ENV DATA_DIR=/app/.data
EXPOSE 3001
CMD ["node","server/index.mjs"]
