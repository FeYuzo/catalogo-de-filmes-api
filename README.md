# 🎬 Catálogo de Filmes, Microsserviço de Autenticação & Auditoria (Redis Streams) — Tom Hanks

> Atividade Prática da disciplina **ISW055 - Introdução à Computação em Nuvem**  
> Professor: **Allan Siriani** ([@siriani](https://github.com/siriani))

---

## 📌 Sobre o Projeto

Aplicação web estruturada em **Arquitetura de Microsserviços** para exibição e gerenciamento da filmografia do ator **Tom Hanks**, integrando consumo de dados em tempo real da **TMDB (The Movie Database)**, persistência no **MariaDB** com segregação por usuário, um **serviço isolado de autenticação** com gerenciamento de papéis (*roles*), recuperação de senhas por e-mail com expiração real, e um **serviço isolado de logs e auditoria (`log-service`)** com persistência em **Redis Streams** (`audit:events`) operando estritamente na rede interna do Docker.

---

## 🏛️ Arquitetura de Microsserviços

O sistema é dividido em containers de microsserviços orquestrados via **Docker Compose**, operando em rede isolada:

```
                                  [ Navegador / Usuário ]
                                             │
                                   (HTTPS / Porta Pública)
                                             │
                                             ▼
                                  ┌─────────────────────┐
                                  │   CATÁLOGO (App)    │ ◄─── Ponto de Entrada Público (:3000)
                                  └────┬───────────┬────┘
                                       │           │
                 ┌─────────────────────┘           └─────────────────────┐
                 │ (Rede Interna Docker)                                 │ (Rede Interna Docker)
                 │ (http://auth-service:4000)                            │ (http://log-service:5000)
                 ▼                                                       ▼
      ┌─────────────────────┐         ┌───────────────────────┐ ┌─────────────────────┐
      │    AUTH-SERVICE     ├────────►│     SMTP Externo      │ │     LOG-SERVICE     │
      │  (Sem porta host)   │         │ (Mailtrap / Brevo)    │ │  (Sem porta host)   │
      │ Login, Role, Reset  │         │ E-mail de Recuperação │ │ Auditoria de Eventos│
      └──────────┬──────────┘         └───────────────────────┘ └──────────┬──────────┘
                 │                                                         │
                 │ (Disparo de login/logout)                               │ (XADD / XRANGE)
                 └─────────────────────────┬───────────────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        │                                     │
                        ▼                                     ▼
             ┌─────────────────────┐               ┌─────────────────────┐
             │       MariaDB       │               │        REDIS        │
             │   (Dados Relacionais│               │   (Redis Streams)   │
             │ usuários, favoritos,│               │    audit:events     │
             │     comentários)    │               │  Histórico Temporal │
             └─────────────────────┘               └─────────────────────┘
```

### 1. Catálogo de Filmes (`catalog`)
- **Único ponto de entrada público**: expõe a porta `3000` (ou porta do aluno).
- Serve os arquivos estáticos do frontend (HTML/CSS/JS).
- Comunica-se com a API externa da **TMDB** para buscar a filmografia e detalhes dos filmes.
- Persiste e isola favoritos e comentários por usuário (`usuario_id`) no MariaDB.
- Repassa chamadas de autenticação ao `auth-service` e dispara eventos de auditoria ao `log-service`.
- Disponibiliza a rota de consulta de auditoria (`GET /api/logs`), protegida exclusivamente para administradores via RBAC.

### 2. Microsserviço de Autenticação (`auth-service`)
- **Sem porta pública no host**: totalmente invisível para a internet externa, acessível apenas via rede interna do Docker (`http://auth-service:4000`).
- Responsabilidade única de:
  - Cadastro de usuários e login com hash **bcrypt**.
  - Emissão e validação de tokens **JWT**.
  - Gestão de papéis de acesso (**Roles**: `usuario` e `admin`).
  - Geração de tokens de recuperação de senha com **expiração real de 30 minutos** e controle de uso único.
  - Envio real de e-mails transacionais via SMTP (**Mailtrap** em dev / **Brevo** em prod).
  - Disparo de eventos de auditoria (`login`, `logout`, tentativas de acesso negado) para o `log-service`.

### 3. Microsserviço de Logs e Auditoria (`log-service`)
- **Sem porta pública no host**: comunicação restrita à rede interna do Docker (`http://log-service:5000`).
- Grava eventos comportamentais em tempo real no **Redis Streams** (`audit:events`) usando `XADD`.
- Oferece rota de consulta protegida (`GET /api/logs`) com suporte a `XREVRANGE` e `XRANGE`.

### 4. Redis (`redis`)
- Persistência em memória com durabilidade AOF (`appendonly yes`).
- Armazena a stream `audit:events` com ordenação cronológica e IDs monotônicos nativos.

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

---

## 📜 Microsserviço de Auditoria e Logs (Redis Streams)

O sistema conta com um microsserviço dedicado e isolado (**`log-service`**) para registro e consulta de **Logs de Auditoria**, garantindo rastreabilidade completa das ações de negócio e segurança (*quem fez o quê, quando e a partir de onde*).

---

### 1. Diferença de Escopo: Auditoria vs. Logs de Aplicação

É fundamental não confundir logs de auditoria com logs de aplicação:

* **Logs de Aplicação (Runtime/Debug):** Erros de sintaxe, stack traces de exceções, falhas de conexão com banco de dados, logs informativos de HTTP (`morgan`). São direcionados aos desenvolvedores para diagnóstico de bugs e operam na saída padrão (`stdout`/`stderr`), capturados pelo Docker.
* **Logs de Auditoria (Governança e Segurança):** Registro cronológico imutável do comportamento e das intenções dos usuários no sistema. Respondem a perguntas de conformidade: *"Quem apagou esse comentário?", "Quem realizou login de um IP não reconhecido?", "Houve tentativas de invasão ou escalada de privilégios negadas por 403?"*.

---

### 2. Decisão Arquitetural de Persistência

#### Por que NÃO persistir no MariaDB?
1. **Padrão de Acesso Assímetrico (*Write-Heavy, Read-Rarely*):** Logs de auditoria geram um volume de escrita massivo (cada ação gera um registro) e um volume de leitura muito baixo (apenas consultas esporádicas de administradores). 
2. **Preservação do Banco Transacional de Negócio:** Colocar milhões de linhas de log no MariaDB causaria fragmentação de tabelas, inchaço dos índices relacionais e contenção de locks com as tabelas essenciais (`usuarios`, `favoritos`, `comentarios`).

#### Por que Redis Streams (`XADD` / `XRANGE` / `XREVRANGE`) e NÃO Listas (`LPUSH`)?
Optamos deliberadamente pelo **Redis Streams** em detrimento de uma lista simples (`LPUSH` / `LRANGE`) pelos seguintes motivos técnicos:

1. **Ordenação Temporal e Monotonicidade Nativas:**
   * No Redis Streams, o comando `XADD audit:events * ...` instrui o Redis a gerar automaticamente IDs baseados em tempo no formato `<timestamp_ms>-<sequencial>` (ex: `1727108923450-0`).
   * Isso garante ordenação cronológica estrita mesmo que o relógio dos servidores da aplicação oscile milissegundos, impedindo inversão de eventos. Em listas (`LPUSH`), o timestamp precisa ser injetado manualmente e a ordem da lista pode ser corrompida por concorrência de rede.
2. **Armazenamento Estruturado em Pares Chave-Valor:**
   * Streams armazenam campos estruturados nativamente (`usuario_id`, `acao`, `timestamp`, `ip`, `detalhes`) na memória do Redis.
   * Não há necessidade de serializar o objeto inteiro em um bloco JSON antes de salvar, permitindo consultas e inspeções eficientes diretamente pelo `redis-cli`.
3. **Consultas por Intervalo Temporal em Alta Performance (`XRANGE` e `XREVRANGE`):**
   * Os Streams utilizam internamente uma estrutura baseada em *Radix Trees*, possibilitando consultas por faixa de tempo (de `t1` a `t2`) ou recuperação dos últimos $N$ eventos (`XREVRANGE + - COUNT N`) em complexidade $O(\log N + M)$, sem a degradação de performance que listas lineares sofrem com offsets altos.
4. **Extensibilidade com Grupos de Consumidores (*Consumer Groups*):**
   * Streams suportam nativamente o comando `XREADGROUP`, permitindo que futuros serviços de detecção de intrusão (IDS/SIEM) consumam os mesmos eventos de forma assíncrona, distribuída e sem deletar os registros do histórico.

---

### 3. Estrutura de Cada Entrada de Log

Cada registro persistido no stream `audit:events` possui a estrutura:

| Campo | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `id` | String | ID monotônico nativo gerado pelo Redis | `1727108923450-0` |
| `usuario_id` | Int / String | ID do usuário autenticado ou `'anonimo'` | `1` |
| `acao` | String | Identificador padronizado da ação | `favoritar_filme`, `permissao_negada` |
| `timestamp` | String (ISO) | Carimbo de data/hora UTC no formato ISO 8601 | `2026-09-23T14:30:00.000Z` |
| `ip` | String | Endereço IP de origem da requisição | `172.18.0.1` |
| `detalhes` | JSON / Objeto | Metadados contextuais da operação | `{"comentario_id": 42, "tmdb_movie_id": 13}` |

---

### 4. Eventos Monitorados pelo Sistema

1. **`login`**: Disparado no `auth-service` ao autenticar com sucesso.
2. **`logout`**: Disparado no `auth-service` e `catalog` ao encerrar a sessão.
3. **`favoritar_filme`**: Disparado no `catalog` ao adicionar título aos favoritos.
4. **`desfavoritar_filme`**: Disparado no `catalog` ao remover título dos favoritos.
5. **`comentar`**: Disparado no `catalog` ao publicar comentário sobre filme.
6. **`apagar_comentario`**: Disparado quando o autor exclui seu próprio comentário.
7. **`apagar_comentario_moderacao`**: Disparado quando um administrador apaga comentário de terceiros.
8. **`permissao_negada` (403 Forbidden)**: **Crítico para segurança** — disparado automaticamente em qualquer tentativa de acesso barrada por falta de permissão ou papel incompatível.

---

### 5. Resiliência e Despacho Não-Bloqueante (*Fire-and-Forget*)

Tanto no Catálogo quanto no Auth-Service, as emissões de eventos utilizam a função `logAuditEvent()`:
* **Não-bloqueante**: A resposta HTTP ao usuário final **nunca é retida** esperando a conclusão da gravação do log.
* **Tolerância a Falhas**: Se o `log-service` ou o Redis estiverem temporariamente fora do ar, o erro é registrado no log local via `console.warn`, mas a requisição do usuário é concluída com sucesso (status 200/201), garantindo que a auditoria nunca derrube o sistema de negócio.

---

### 6. Rota Protegida de Consulta de Auditoria (`GET /api/logs`)

A visualização dos eventos de auditoria é uma **operação restrita a administradores**:
* O Catálogo expõe o endpoint `GET /api/logs` utilizando os middlewares `authenticate` e `requireRole('admin')`.
* Requisições autenticadas com papel `usuario` recebem **`403 Forbidden`** (e a própria tentativa indevida é logada no stream como `permissao_negada`).
* Requisições de administradores repassam internamente a busca para `http://log-service:5000/api/logs?limit=50&order=desc`, que consulta o Redis Stream via **`XREVRANGE`** (mais recentes primeiro) ou **`XRANGE`** (cronológico crescente).

---

### 7. 🧪 Roteiro de Demonstração Passo a Passo (cURL)

Execute os comandos a seguir no terminal para validar todo o fluxo de ponta a ponta:

#### Passo 1: Fazer login com Usuário Comum
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "comum@exemplo.com", "senha": "senha123"}'
```
> Guarde o `token` retornado como `TOKEN_COMUM`. *(Evento registrado: `login`)*

#### Passo 2: Favoritar um filme com o Usuário Comum
```bash
curl -X POST http://localhost:3000/api/favorites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_COMUM" \
  -d '{"tmdb_movie_id": 13, "titulo": "Forrest Gump"}'
```
> *(Evento registrado: `favoritar_filme`)*

#### Passo 3: Publicar um comentário com o Usuário Comum
```bash
curl -X POST http://localhost:3000/api/movies/13/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_COMUM" \
  -d '{"texto": "Filme incrível! Atuação impecável do Tom Hanks."}'
```
> Anote o `id` retornado (ex: `15`). *(Evento registrado: `comentar`)*

#### Passo 4: [SEGURANÇA] Usuário Comum tentando acessar a rota restrita de logs ➔ 403 Forbidden
```bash
curl -i -X GET http://localhost:3000/api/logs \
  -H "Authorization: Bearer TOKEN_COMUM"
```
**Resposta esperada (HTTP 403 Forbidden):**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Acesso proibido. Esta ação requer permissão: admin."
}
```
> *(Evento registrado: `permissao_negada` com detalhes da rota `/api/logs` e motivo `papel_insuficiente`)*

#### Passo 5: Fazer login com Administrador
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@exemplo.com", "senha": "senha123"}'
```
> Guarde o `token` retornado como `TOKEN_ADMIN`. *(Evento registrado: `login`)*

#### Passo 6: Administrador moderando (apagando) comentário de outro usuário ➔ 200 OK
```bash
curl -i -X DELETE http://localhost:3000/api/comments/15 \
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
> *(Evento registrado: `apagar_comentario_moderacao`)*

#### Passo 7: Administrador consultando os logs de auditoria ➔ 200 OK
```bash
curl -i -X GET "http://localhost:3000/api/logs?limit=10&order=desc" \
  -H "Authorization: Bearer TOKEN_ADMIN"
```
**Resposta esperada (HTTP 200 OK):**
```json
{
  "success": true,
  "total_in_stream": 6,
  "returned_count": 6,
  "order": "desc",
  "stream": "audit:events",
  "logs": [
    {
      "id": "1727109200000-0",
      "usuario_id": 2,
      "acao": "apagar_comentario_moderacao",
      "timestamp": "2026-09-23T14:40:00.000Z",
      "ip": "172.18.0.1",
      "detalhes": {
        "comentario_id": 15,
        "autor_comentario_id": 1,
        "tmdb_movie_id": 13,
        "tipo": "moderacao_admin"
      }
    },
    {
      "id": "1727109150000-0",
      "usuario_id": 2,
      "acao": "login",
      "timestamp": "2026-09-23T14:39:10.000Z",
      "ip": "172.18.0.1",
      "detalhes": {
        "email": "admin@exemplo.com",
        "role": "admin"
      }
    },
    {
      "id": "1727109100000-0",
      "usuario_id": 1,
      "acao": "permissao_negada",
      "timestamp": "2026-09-23T14:38:20.000Z",
      "ip": "172.18.0.1",
      "detalhes": {
        "motivo": "papel_insuficiente",
        "rota": "/api/logs",
        "metodo": "GET",
        "papel_usuario": "usuario",
        "papeis_permitidos": ["admin"]
      }
    },
    {
      "id": "1727109050000-0",
      "usuario_id": 1,
      "acao": "comentar",
      "timestamp": "2026-09-23T14:37:30.000Z",
      "ip": "172.18.0.1",
      "detalhes": {
        "comentario_id": 15,
        "tmdb_movie_id": 13
      }
    },
    {
      "id": "1727109000000-0",
      "usuario_id": 1,
      "acao": "favoritar_filme",
      "timestamp": "2026-09-23T14:36:40.000Z",
      "ip": "172.18.0.1",
      "detalhes": {
        "tmdb_movie_id": 13,
        "titulo": "Forrest Gump"
      }
    },
    {
      "id": "1727108950000-0",
      "usuario_id": 1,
      "acao": "login",
      "timestamp": "2026-09-23T14:35:50.000Z",
      "ip": "172.18.0.1",
      "detalhes": {
        "email": "comum@exemplo.com",
        "role": "usuario"
      }
    }
  ]
}
```

#### Passo 8: Inspeção direta no Redis via CLI (Demonstração do Redis Stream cru)
Para comprovar que a persistência está ocorrendo diretamente na estrutura de dados do Redis Streams:
```bash
docker compose exec redis redis-cli XRANGE audit:events - +
```
Você verá a árvore nativa de Streams do Redis com cada entrada contendo seus campos `usuario_id`, `acao`, `timestamp`, `ip` e `detalhes`.

