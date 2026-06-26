# MeuClose

Monorepo do sistema `MeuClose`, com frontend em React/Vite e backend em Node.js/Express.

## Visao geral

- `frontend/`: aplicacao web
- `backend/`: API REST, autenticacao, regras de negocio e acesso ao PostgreSQL

## Stack

### Frontend

- React 19
- TypeScript
- Vite
- MUI
- Tailwind CSS

### Backend

- Node.js
- Express 5
- Sequelize 6
- PostgreSQL
- JWT
- Winston

## Variaveis de ambiente

### Backend

Criar `backend/.env` de acordo com `backend/.env.example`:


## Instalacao

### 1. Instalar dependencias do backend

```bash
cd backend
npm install
```

### 2. Instalar dependencias do frontend

```bash
cd frontend
npm install
```

## Banco de dados

Para aplicar as migrations do backend:

```bash
cd backend
npm run db:migrate
```

O projeto também possui scripts de carga inicial para alguns cadastros base, por exemplo:

```bash
npm run db:setup:roles
npm run db:setup:status
npm run db:setup:payment-types
```

Se precisar, execute apenas os scripts realmente necessários para o ambiente.

## Executando o projeto

### Backend

```bash
cd backend
npm run dev
```

API padrao:

- `http://localhost:3000`

### Frontend

```bash
cd frontend
npm run dev
```

Aplicacao padrao:

- `http://localhost:5173`

## Scripts principais

### Frontend

```bash
npm run dev
npm run build
npm run lint
```

### Backend

```bash
npm run dev
npm run start
npm run db:migrate
```

## Logs

O backend usa logger central com Winston.

- logs de runtime ficam em `backend/logs/`
- arquivos `.log` e a pasta `logs/` estao no `.gitignore` do backend

