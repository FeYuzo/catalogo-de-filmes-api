# 🎬 Catálogo de Filmes — Tom Hanks

> Atividade Prática da disciplina **ISW055 - Introdução à Computação em Nuvem**  
> Professor: **Allan Siriani** ([@siriani](https://github.com/siriani))

---

## 📌 Sobre o Projeto

Aplicação web completa para exibição da filmografia do ator **Tom Hanks**, com consumo de dados em tempo real da API externa da **TMDB (The Movie Database)** e persistência de dados no **MariaDB** com **isolamento total entre usuários** (multi-tenancy a nível de aplicação).

Cada usuário cadastrado possui seu próprio espaço isolado no banco de dados para salvar seus filmes favoritos e registrar comentários/anotações pessoais, sem que um usuário tenha acesso aos dados do outro.

---

## 🏛️ Arquitetura do Sistema

A aplicação foi estruturada com separação clara de responsabilidades entre **Frontend** e **Backend**:

```
.
├── backend/                  # API REST em Node.js / Express
│   ├── src/
│   │   ├── config/          # Conexão com MariaDB e inicialização de tabelas
│   │   ├── controllers/     # Controladores (Auth, Filmes, Favoritos, Comentários)
│   │   ├── middleware/      # Autenticação JWT e proteção de rotas
│   │   ├── routes/          # Definição de rotas da API REST
│   │   ├── services/        # Integração com a API da TMDB
│   │   └── index.js         # Ponto de entrada do servidor Express
│   └── package.json
│
├── frontend/                 # Interface Web Responsiva (SPA)
│   ├── index.html           # Tela de autenticação e catálogo de filmes
│   ├── css/
│   │   └── styles.css       # Estilização moderna (tema cinema dark)
│   └── js/
│       ├── api.js           # Cliente HTTP com gerenciamento de sessão
│       ├── auth.js          # Controle de telas de Login e Cadastro
│       └── app.js           # Lógica do catálogo, favoritos e comentários
│
├── Dockerfile                # Build do container para Portainer / Docker
├── docker-compose.yml        # Orquestração local (App + MariaDB)
├── .env.example              # Modelo de variáveis de ambiente
└── README.md
```

### 🔒 Segurança e Segregação de Dados
1. **Credenciais no Servidor**: A chave de API da TMDB e as credenciais do MariaDB residem **exclusivamente** nas variáveis de ambiente do backend. Nenhuma chave é enviada para o navegador ou versionada no repositório.
2. **Isolamento de Usuários**: Todas as operações de leitura, inserção e exclusão de favoritos e comentários são filtradas obrigatoriamente por `usuario_id = ?` obtido via token JWT autenticado:
   ```sql
   SELECT * FROM favoritos WHERE usuario_id = ?;
   SELECT * FROM comentarios WHERE usuario_id = ? AND tmdb_movie_id = ?;
   ```
3. **Criptografia de Senhas**: As senhas dos usuários são protegidas usando algoritmo de hash **bcrypt**.

---

## 🗄️ Modelo do Banco de Dados (MariaDB)

As tabelas são criadas automaticamente na inicialização da aplicação:

```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favoritos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tmdb_movie_id INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  poster_path VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_usuario_filme (usuario_id, tmdb_movie_id)
);

CREATE TABLE IF NOT EXISTS comentarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tmdb_movie_id INT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
```

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta onde o container escuta | `3000` |
| `TMDB_API_KEY` | Chave de desenvolvedor da TMDB | `sua_chave_tmdb` |
| `DB_HOST` | Host do banco MariaDB | `mariadb` ou `localhost` |
| `DB_PORT` | Porta do banco MariaDB | `3306` |
| `DB_USER` | Usuário do banco MariaDB | `aluno` |
| `DB_PASSWORD` | Senha do banco MariaDB | `senha_aluno` |
| `DB_NAME` | Nome da base de dados | `catalogo_filmes` |
| `JWT_SECRET` | Chave secreta para assinar JWTs | `chave_secreta_jwt` |

---

## 🚀 Como Executar

### Opção 1: Usando Docker Compose (Recomendado para Testes Locais)

1. Preencha sua chave da TMDB no arquivo `.env`:
   ```bash
   cp .env.example .env
   # Edite o .env e adicione sua TMDB_API_KEY
   ```

2. Suba a aplicação e o banco MariaDB:
   ```bash
   docker compose up --build
   ```

3. Acesse no navegador: `http://localhost:3000`

---

### Opção 2: Executando Diretamente com Node.js

1. Instale as dependências do backend:
   ```bash
   cd backend
   npm install
   ```

2. Configure o arquivo `.env` no diretório raiz ou dentro de `backend/`.

3. Inicie o servidor:
   ```bash
   npm start
   ```

4. Acesse no navegador: `http://localhost:3000`

---

## 🚢 Deploy no Portainer (Instruções da Atividade)

1. No **Portainer**, crie uma nova Stack apontando para o repositório público do GitHub.
2. Em **Environment variables**, configure:
   - `PORT`: Porta reservada do aluno
   - `TMDB_API_KEY`: Sua chave de desenvolvedor TMDB
   - `DB_HOST`: Host do MariaDB da infraestrutura da disciplina
   - `DB_PORT`: `3306`
   - `DB_USER`: Seu usuário do MariaDB
   - `DB_PASSWORD`: Sua senha do MariaDB
   - `DB_NAME`: Sua base de dados do MariaDB
   - `JWT_SECRET`: Uma string secreta aleatória
3. Publique a porta do container mapeando a **porta reservada do aluno**.
4. Faça o deploy da Stack e acesse pelo seu subdomínio individual.

---

## 🧪 Roteiro de Teste de Ponta a Ponta

1. **Tela Inicial**: Ao abrir a aplicação, é exibida a tela de Login/Cadastro (sem acesso direto ao catálogo).
2. **Cadastro e Login**: Crie a primeira conta (ex: `usuario1@teste.com`) e faça login.
3. **Catálogo TMDB**: Visualize a lista completa de filmes de Tom Hanks com pôsteres em alta definição, notas e sinopses.
4. **Favoritos e Comentários**: Favorite um filme (ex: *Forrest Gump*) e adicione uma anotação pessoal.
5. **Recarregamento**: Recarregue a página (F5) — os favoritos e comentários continuam salvos.
6. **Teste de Isolamento**: Faça logout e crie uma segunda conta (ex: `usuario2@teste.com`).
   - A segunda conta iniciará com lista de favoritos vazia e nenhum comentário visível da primeira conta.
