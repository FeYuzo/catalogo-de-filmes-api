# 🎬 Catálogo de Filmes & Microsserviço de Autenticação — Tom Hanks

> Atividade Prática da disciplina **ISW055 - Introdução à Computação em Nuvem**  
> Professor: **Allan Siriani** ([@siriani](https://github.com/siriani))

---

## 📌 Sobre o Projeto

Aplicação web estruturada em **Arquitetura de Microsserviços** para exibição e gerenciamento da filmografia do ator **Tom Hanks**, integrando consumo de dados em tempo real da **TMDB (The Movie Database)**, persistência no **MariaDB** com segregação por usuário, e um **serviço isolado de autenticação** com gerenciamento de papéis (*roles*), recuperação de senhas por e-mail com expiração real e comunicação estrita via rede interna do Docker.

---

## 🏛️ Arquitetura de Microsserviços

O sistema é dividido em dois containers de aplicação orquestrados via **Docker Compose**:

```
                                  [ Navegador / Usuário ]
                                             │
                                   (HTTPS / Porta Pública)
                                             │
                                             ▼
                                  ┌─────────────────────┐
                                  │   CATÁLOGO (App)    │
                                  │  Porta Pública:3000 │
                                  └──────────┬──────────┘
                                             │
                                   (Rede Interna Docker)
                                   (http://auth-service:4000)
                                             │
                                             ▼
┌───────────────────────┐         ┌─────────────────────┐         ┌───────────────────────┐
│       MariaDB         │◄───────┤    AUTH-SERVICE     ├────────►│     SMTP Externo      │
│ (usuarios, reset_tokens│         │  (Sem porta host)   │         │ (Mailtrap / Brevo)    │
│ favoritos, comentarios)│         │ Login, Role, Reset  │         │ E-mail de Recuperação │
└───────────────────────┘         └─────────────────────┘         └───────────────────────┘
```

### 1. Catálogo de Filmes (`catalog`)
- **Único ponto de entrada público**: expõe a porta `3000` (ou porta do aluno).
- Serve os arquivos estáticos do frontend (HTML/CSS/JS).
- Comunica-se com a API externa da **TMDB** para buscar a filmografia e detalhes dos filmes.
- Persiste e isola favoritos e comentários por usuário (`usuario_id`).
- Repassa qualquer operação de autenticação internamente para o `auth-service`.

### 2. Microsserviço de Autenticação (`auth-service`)
- **Sem porta pública no host**: totalmente invisível para a internet externa, acessível apenas via rede interna do Docker (`http://auth-service:4000`).
- Responsabilidade única de:
  - Cadastro de usuários e login com hash **bcrypt**.
  - Emissão e validação de tokens **JWT**.
  - Gestão de papéis de acesso (**Roles**: `usuario` e `admin`).
  - Geração de tokens de recuperação de senha com **expiração real de 30 minutos** e controle de uso único.
  - Envio real de e-mails transacionais via SMTP (**Mailtrap** em dev / **Brevo** em prod).

---

## 🗄️ Modelo do Banco de Dados (MariaDB)

As tabelas são gerenciadas e criadas automaticamente pelos serviços:

```sql
-- Gerenciadas pelo Auth-Service:
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'usuario',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  usuario_id INT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expira_em DATETIME NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gerenciadas pelo Catálogo:
CREATE TABLE IF NOT EXISTS favoritos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tmdb_movie_id INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  poster_path VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_usuario_filme (usuario_id, tmdb_movie_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comentarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tmdb_movie_id INT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 🔑 Fluxo de Recuperação de Senha ("Esqueci Minha Senha")

1. **Solicitação**: O usuário informa seu e-mail no catálogo (`POST /api/auth/forgot-password`).
2. **Geração Segura**: O `auth-service` gera um token criptograficamente seguro de 32 bytes (`crypto.randomBytes(32).toString('hex')`).
3. **Expiração Real**: O token é salvo na tabela `reset_tokens` com `expira_em = NOW() + 30 MINUTOS` e `usado = FALSE`.
4. **Envio Transacional**: O `auth-service` envia um e-mail formatado via SMTP (Mailtrap/Brevo) com o link:
   `${APP_URL}/?reset_token=${token}`
5. **Validação em 3 Etapas**: Quando o usuário clica no link e submete a nova senha:
   - **O token existe?**
   - **O token ainda não expirou?** (`NOW() <= expira_em`)
   - **O token ainda não foi usado?** (`usado == FALSE`)
6. **Atualização**: Se todas as 3 validações passarem, a senha é re-hasheada e gravada, e o token é marcado como `usado = TRUE` (bloqueando qualquer tentativa de reuso).

---

## ⚙️ Variáveis de Ambiente

Crie seu arquivo `.env` baseado no `.env.example`:

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta pública do container Catálogo | `3000` |
| `AUTH_SERVICE_URL` | URL interna do container Auth na rede Docker | `http://auth-service:4000` |
| `APP_URL` | URL pública da aplicação para montar links de e-mail | `http://localhost:3000` |
| `TMDB_API_KEY` | Chave de API da TMDB | `sua_chave_tmdb` |
| `DB_HOST` | Host do MariaDB | `mariadb` ou IP do servidor |
| `DB_PORT` | Porta do MariaDB | `3306` |
| `DB_USER` | Usuário do MariaDB | `IAC_2026_02_aluno` |
| `DB_PASSWORD` | Senha do MariaDB | `senha_aluno` |
| `DB_NAME` | Nome do banco MariaDB | `IAC_2026_02_aluno` |
| `JWT_SECRET` | Segredo para assinatura de tokens JWT | `chave_secreta_jwt` |
| `SMTP_HOST` | Host SMTP (**Mailtrap** em dev / **Brevo** em prod) | `sandbox.smtp.mailtrap.io` |
| `SMTP_PORT` | Porta do servidor SMTP | `2525` ou `587` |
| `SMTP_USER` | Usuário SMTP do Mailtrap/Brevo | `seu_user_smtp` |
| `SMTP_PASS` | Senha SMTP do Mailtrap/Brevo | `sua_senha_smtp` |
| `SMTP_FROM` | Remetente dos e-mails | `Catálogo <nao-responda@catalogofilmes.com>` |

---

## 🚀 Como Executar Localmente com Docker Compose

1. Clone o repositório e configure as variáveis de ambiente:
   ```bash
   cp .env.example .env
   # Preencha suas credenciais no .env (TMDB_API_KEY, DB_*, SMTP_*, etc.)
   ```

2. Suba os microsserviços via Docker Compose:
   ```bash
   docker compose up --build
   ```

3. Acesse o catálogo no navegador:
   ```
   http://localhost:3000
   ```

---

## 🚢 Deploy no Portainer

1. No **Portainer**, crie uma nova Stack apontando para o repositório do GitHub.
2. Em **Environment variables**, preencha todas as variáveis do `.env`.
3. O Docker Compose iniciará o `catalog` (publicando apenas a porta do catálogo) e o `auth-service` (isolado na rede interna).
4. Faça o deploy da Stack e acesse pelo subdomínio individual.

---

## 🧪 Roteiro de Teste de Ponta a Ponta

1. **Cadastro com Papel (Role)**:
   - Crie uma conta com o papel `Usuário` e outra com o papel `Administrador`.
   - O papel do usuário é exibido em destaque no topo da interface (`[Admin]` ou `[Usuário]`).
2. **Esqueci Minha Senha (Expiração de 30 min)**:
   - Na tela de login, clique em **"Esqueceu a senha?"**.
   - Informe seu e-mail cadastrado e clique em **"Enviar Link de Recuperação"**.
   - No **Mailtrap** (ou na sua caixa de entrada se configurado Brevo), abra o e-mail recebido e clique em **"Redefinir Minha Senha"**.
   - Digite sua nova senha e confirme.
3. **Teste de Segurança (Reuso e Expiração)**:
   - Tente utilizar o mesmo link de recuperação uma segunda vez: a alteração será recusada com o aviso de token já utilizado.
   - Links com mais de 30 minutos de geração são recusados automaticamente pelo microsserviço de autenticação.
4. **Isolamento de Dados no Catálogo**:
   - Faça login com a nova senha, favorite filmes e adicione comentários pessoais.
   - Os dados permanecem estritamente isolados por `usuario_id` no MariaDB.

---

## 🛡️ Controle de Acesso Baseado em Papéis (RBAC — Role-Based Access Control)

O sistema implementa **Autorização Real no Servidor** através do modelo RBAC, garantindo que o acesso a qualquer recurso sensível seja validado no backend antes de ser executado, independentemente de como a requisição foi originada (se pela interface do navegador ou diretamente via cURL/Postman).

### 1. Documentação de Permissões por Papel

Os quatro conceitos fundamentais do RBAC aplicados ao sistema:
* **Usuário:** Identidade autenticada (`usuario_id`).
* **Papel (*Role*):** Categoria de acesso do usuário (`usuario` ou `admin`).
* **Permissão:** Ação atômica concedida sobre um recurso no formato `<recurso>:<ação>`.
* **Atribuição:** Vínculo usuário ↔ papel gravado na coluna `role` da tabela `usuarios`.

#### Matriz de Permissões

| Recurso | Ação | Identificador da Permissão | `usuario` | `admin` | Descrição da Regra |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Filmes** | Listar filmes e detalhes | `filmes:listar` | ✅ | ✅ | Consulta ao catálogo TMDB disponível para qualquer autenticado. |
| **Favoritos** | Gerenciar próprios favoritos | `favoritos:gerenciar_proprio` | ✅ | ✅ | Cada usuário só acessa, adiciona ou remove seus próprios favoritos. |
| **Comentários** | Criar comentário | `comentarios:criar` | ✅ | ✅ | Publicar anotações/comentários em filmes. |
| **Comentários** | Listar comentários | `comentarios:listar` | ✅ | ✅ | Usuário visualiza suas notas; Admin visualiza todos com nome do autor. |
| **Comentários** | Apagar **próprio** comentário | `comentarios:excluir_proprio` | ✅ | ✅ | Excluir apenas os comentários cujo autor seja o próprio usuário logado. |
| **Comentários** | Apagar comentário de **qualquer** usuário | `comentarios:excluir_qualquer` | ❌ | ✅ | **Ação Exclusiva de Admin (Moderação)**: exclusão forçada de conteúdo de terceiros. |

---

### 2. Ação Exclusiva de Administrador (Moderação de Comentários)

A ação exclusiva implementada é a **Moderação de Comentários** (`DELETE /api/comments/:id`):
1. Quando uma requisição de exclusão chega ao backend, o servidor busca o comentário no banco.
2. Se `comentario.usuario_id === req.user.id`, trata-se do autor apagando seu próprio comentário (`comentarios:excluir_proprio`), ação permitida para qualquer usuário.
3. Se `comentario.usuario_id !== req.user.id`, trata-se de tentativa de exclusão de conteúdo de terceiros:
   - O backend efetua uma checagem de autorização centralizada (Padrão A) consultando o `auth-service`.
   - Se o usuário **não** possuir a permissão `comentarios:excluir_qualquer` (papel `usuario`), o servidor recusa a requisição respondendo **`403 Forbidden`**.
   - Se possuir a permissão (papel `admin`), a exclusão é efetuada com sucesso (**`200 OK`**).

---

### 3. Roteiro de Demonstração (cURL Passo a Passo)

Para evidenciar o enforcement no servidor e capturar os prints solicitados, execute a sequência abaixo em seu terminal:

#### Passo 1: Fazer login com o Usuário 1 (Autor do Comentário)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "autor@exemplo.com", "senha": "senha123"}'
```
> Copie o `token` retornado e guarde como `TOKEN_AUTOR`.

#### Passo 2: Publicar um comentário com o Usuário 1
```bash
curl -X POST http://localhost:3000/api/movies/13/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_AUTOR" \
  -d '{"texto": "Comentário de teste criado pelo Usuário 1."}'
```
> Anote o `id` do comentário gerado no retorno (ex: `"id": 42`).

#### Passo 3: Fazer login com outro Usuário Comum (Não-Admin)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "comum@exemplo.com", "senha": "senha123"}'
```
> Copie o `token` retornado e guarde como `TOKEN_COMUM`.

#### Passo 4: Fazer login com o Administrador
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@exemplo.com", "senha": "senha123"}'
```
> Copie o `token` retornado e guarde como `TOKEN_ADMIN`.

#### Passo 5: [PRINT 1] Usuário Comum tentando apagar comentário de outro usuário ➔ 403 Forbidden
```bash
curl -i -X DELETE http://localhost:3000/api/comments/42 \
  -H "Authorization: Bearer TOKEN_COMUM"
```
**Resposta esperada (HTTP 403 Forbidden):**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Acesso proibido. Você não tem permissão para excluir comentários de outros usuários."
}
```

#### Passo 6: [PRINT 2] Administrador executando a mesma exclusão (Moderação) ➔ 200 OK
```bash
curl -i -X DELETE http://localhost:3000/api/comments/42 \
  -H "Authorization: Bearer TOKEN_ADMIN"
```
**Resposta esperada (HTTP 200 OK):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Comentário removido com sucesso (ação de moderação administrativa)."
}
```

---

### 4. Justificativa Arquitetural: Padrão A vs. Padrão B

* **Padrão A (Enforcement Centralizado — Utilizado Atualmente):**
  * **Como funciona:** O token de autenticação apenas comprova a identidade do usuário (`id`, `email`). A cada operação sensível ou restrita, o serviço de negócio (Catálogo) consulta a autoridade central (`auth-service` / tabela `usuarios` no banco) perguntando: *"esse usuário possui a permissão X?"*.
  * **Vantagens:** Consistência e revogação imediatas. Se um administrador for rebaixado para usuário comum no banco de dados, o efeito é instantâneo na próxima requisição, sem brechas de segurança.
  * **Desvantagens:** Overhead de rede e maior latência, já que exige uma chamada inter-serviços ou consulta ao banco a cada ação sensível.

* **Padrão B (Claims no JWT — Alternativa Descentralizada):**
  * **O que mudaria no código:** As permissões ou o papel (`role: "admin"`) seriam injetados diretamente no payload do JWT no momento do login (`jwt.sign({ id, role, permissions }, SECRET)`). O middleware de cada microsserviço validaria apenas a assinatura criptográfica do token e leria as claims locais em memória (`decoded.permissions`), sem fazer nenhuma requisição externa ao `auth-service`.
  * **O Trade-off Fundamental (Velocidade vs. Atraso de Revogação):**
    * *Velocidade:* Altíssimo desempenho e zero dependência de rede para autorização (verificação local stateless).
    * *Atraso de Revogação:* Janela de vulnerabilidade. Se um usuário for banido ou rebaixado no banco de dados, seu token JWT continuará válido e autorizado para executar ações administrativas até que expire (por exemplo, durante os 7 dias de validade do token), a menos que se implemente uma lista negra (*blocklist*) complexa de tokens, o que anularia a vantagem do token ser *stateless*.
