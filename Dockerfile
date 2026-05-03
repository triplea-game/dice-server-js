FROM node:22-slim

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

COPY . .

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 7654

CMD ["node", "dice-server.js"]

