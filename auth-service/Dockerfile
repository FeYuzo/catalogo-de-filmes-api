# ==============================================================================
# Dockerfile para o Microsserviço de Autenticação
# ==============================================================================

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=4000

# Porta interna do container (sem mapeamento externo no host)
EXPOSE 4000

CMD ["node", "src/index.js"]
