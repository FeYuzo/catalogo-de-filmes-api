# ==============================================================================
# Dockerfile para Catálogo de Filmes Tom Hanks
# Compatível com Portainer e Docker Compose
# ==============================================================================

FROM node:20-alpine

# Define diretório de trabalho
WORKDIR /app

# Copia manifestos de dependências do backend
COPY backend/package*.json ./backend/

# Instala apenas dependências de produção
RUN npm --prefix backend install --omit=dev

# Copia o código fonte do backend e frontend
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Define variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Porta do container (pode ser sobrescrita via variável de ambiente PORT)
EXPOSE 3000

# Diretório de execução
WORKDIR /app/backend

# Inicia a aplicação
CMD ["node", "src/index.js"]
