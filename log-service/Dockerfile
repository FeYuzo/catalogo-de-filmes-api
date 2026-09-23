# ==============================================================================
# Dockerfile para o Microsserviço de Logs e Auditoria
# ==============================================================================

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=5000

# Porta interna do container (sem mapeamento de porta pública no host)
EXPOSE 5000

CMD ["node", "src/index.js"]
