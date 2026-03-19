
<p align="center">
  <img src="https://img.shields.io/badge/Status-Em%20Desenvolvimento-blueviolet?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Versão-2.1.0-blue?style=for-the-badge" alt="Versão">
  <img src="https://img.shields.io/badge/Licença-MIT-green?style=for-the-badge" alt="Licença">
  <img src="https://img.shields.io/badge/Pagar.me-Integrado-00C29A?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCcgZmlsbD0nd2hpdGUnPjxwYXRoIGQ9J00xMiAyMnM4LTQgOC0xMFY1bC04LTMtOCAzdjdjMCA2IDggMTAgOCAxMHonLz48L3N2Zz4=" alt="Pagar.me">
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase">
</p>

<h1 align="center">⚡ ChargeGuard</h1>

<p align="center">
  <strong>Sistema de Automação de Chargebacks integrado com Pagar.me e Supabase</strong>
  <br>
  Sincronização em tempo real • Pipeline visual • Defesa automatizada • Relatórios analíticos
</p>

---

## 📖 Sobre o Projeto

O **ChargeGuard** é uma solução robusta para automação e gestão de chargebacks. O sistema evoluiu de uma aplicação estática para uma arquitetura **Backend-Frontend** completa, utilizando **FastAPI** e **Supabase (PostgreSQL)** para persistência de dados real e segura.

### Principais Funcionalidades:
- 🏗️ **Console de Operações**: Pipeline visual integrado para acompanhamento de casos.
- 🔄 **Sincronização Supabase**: Integração direta com banco de dados remoto para dados persistentes.
- 📄 **Defesa Inteligente**: Geração automática de cartas de defesa baseadas no motivo do chargeback.
- 📋 **Checklist Dinâmico**: Provas obrigatórias e recomendadas adaptadas a cada situação.
- 📊 **Dashboard Analítico**: Métricas em tempo real, taxas de sucesso e KPIs financeiros.
- ⚙️ **Configurações Centralizadas**: Gestão de chaves API Pagar.me e dados da empresa.

---

## 🛠️ Arquitetura e Tecnologias

O projeto está dividido em duas partes principais:

### Frontend
- **HTML5/CSS3**: Design System premium com tema escuro e Glassmorphism.
- **JavaScript (Vanilla)**: Lógica de interface, gráficos em Canvas e integração com a API.
- **Google Fonts (Inter)**: Tipografia moderna e legível.

### Backend
- **Python / FastAPI**: API REST de alta performance para processamento e integração.
- **Psycopg2**: Driver para comunicação com o banco de dados.
- **Supabase (PostgreSQL)**: Banco de dados relacional hospedado na nuvem.

---

## 🗂️ Estrutura do Repositório

```text
automacao-chargeback/
├── frontend/               # Interface do usuário (HTML, CSS, JS)
│   ├── index.html          # Ponto de entrada
│   ├── styles.css          # Estilização completa
│   ├── app.js              # Lógica principal e Sync API
│   └── pagarme.js          # Módulo de integração Pagar.me
├── chargeback_backend/     # API e lógica de servidor (Python)
│   └── app/backend/
│       ├── api.py          # Entry point da API FastAPI
│       ├── config/         # Configurações (Supabase, .env)
│       ├── services/       # Lógica de negócio
│       ├── repositories/   # Acesso ao banco de dados
│       └── models/         # Definições de classes
├── docs/                   # Documentação e capturas de tela
├── .env                    # Variáveis de ambiente (Host, User, Pass)
└── README.md               # Este arquivo
```

---

## 🚀 Como Executar o Projeto

### 1. Configuração do Ambiente (.env)
Crie um arquivo `.env` na raiz do projeto seguindo este modelo:
```env
DB_HOST=seu-host-supabase.supabase.co
DB_USER=postgres
DB_PASS=sua-senha-do-banco
DB_NAME=postgres
DB_PORT=5432
```

### 2. Rodando o Backend (API)
```bash
# Entre na pasta do backend
cd chargeback_backend/app/backend

# (Opcional) Crie e ative um ambiente virtual
python -m venv .venv
source .venv/bin/activate # No Windows: .venv\Scripts\activate

# Instale as dependências
pip install fastapi uvicorn psycopg2-binary python-dotenv

# Inicie o servidor
python api.py
```
A API estará disponível em `http://localhost:8000`.

### 3. Rodando o Frontend
```bash
# Na raiz do projeto, use qualquer servidor estático
npx -y http-server ./frontend -p 8080 --cors
```
Acesse o sistema em `http://localhost:8080`.

---

## 🛠️ Scripts de Manutenção

O repositório inclui scripts utilitários na pasta `scripts/` para auxiliar na gestão do banco de dados:
- `check_tables.py`: Verifica as tabelas existentes no Supabase.
- `check_columns.py`: Analisa a estrutura de colunas e tipos de dados.
- `fix_foreign_key.py`: Auxilia na correção de restrições de chaves estrangeiras.

---

## 📸 Screenshots

### Console de Operações
![Dashboard](docs/screenshots/dashboard.png)
> Visão holística da saúde financeira e volume de chargebacks.

### Gestão de Casos e Sincronização
![Gestão de Casos](docs/screenshots/gestao-casos.png)
> Utilize o botão **"Sincronizar AGORA"** para puxar os dados reais do Supabase via API.

---

## 📄 Carta de Defesa Automática

O sistema gera automaticamente uma carta de defesa formal. A argumentação é adaptada conforme o motivo:

| Motivo | Argumentação Automática |
|--------|------------------------|
| Fraude | Logs de IP, device fingerprint, prova de entrega. |
| Produto não recebido | Rastreamento (AR/Tracking), confirmação de entrega. |
| Cobrança duplicada | IDs de transação distintos, notas fiscais múltiplas. |
| Cancelamento | Termos de uso, logs de acesso ao serviço. |

---

## 🤝 Contribuindo

1. Faça um Fork do projeto.
2. Crie uma branch para sua modificação (`git checkout -b feature/nova-feature`).
3. Commit suas mudanças (`git commit -m 'feat: nova funcionalidade'`).
4. Push para a branch (`git push origin feature/nova-feature`).
5. Abra um Pull Request.

---

## 📝 Licença
Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<p align="center">
  Desenvolvido por <strong>Vinicius</strong> (@toshimizuguchi) <br>
  Feito com ❤️ para facilitar a vida de quem lida com e-commerce e pagamentos.
</p>
