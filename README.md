## ✨ Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| 🔐 **Autenticação** | Registro e login com JWT (tokens de acesso e refresh) |
| 📚 **Álbuns** | Crie, edite e delete álbuns com categorias (Amor, Viagem, Aniversário, etc.) |
| 📸 **Fotos** | Upload de imagens com otimização automática via Cloudinary |
| ❤️ **Favoritos** | Marque suas fotos preferidas |
| 📅 **Linha do Tempo** | Visualize todas as fotos organizadas por data |
| 👤 **Perfil** | Edite nome, bio e foto de perfil |
| 📱 **Responsivo** | Funciona em desktop, tablet e mobile |
| 🔒 **Segurança** | Rate limiting, headers de segurança e validação de senha |
| 🐳 **Docker** | Containerização para fácil deploy |

---

## 🛠️ Tecnologias

### Backend
- **FastAPI** - Framework web moderno e rápido
- **PostgreSQL** - Banco de dados relacional
- **SQLAlchemy** - ORM assíncrono
- **JWT** - Autenticação segura
- **Cloudinary** - Upload e otimização de imagens
- **Docker** - Containerização

### Frontend
- **HTML5** - Estrutura semântica
- **CSS3** - Estilização com variáveis e responsividade
- **JavaScript** - Interatividade e chamadas à API
- **Vercel** - Hospedagem e deploy contínuo

### DevOps
- **Render** - Hospedagem do backend
- **Vercel** - Hospedagem do frontend
- **GitHub** - Versionamento e CI/CD

---

## 🚀 Como executar

### Pré-requisitos
- Docker e Docker Compose
- Python 3.12+
- Node.js (para o frontend)

### Localmente

```bash
# Clone o repositório
git clone https://github.com/Mayza414/memorias-com-amor.git
cd memorias-com-amor

# Inicie o backend com Docker
docker-compose up -d

# Aguarde o banco iniciar e rode as migrações
docker exec -it mca_backend alembic upgrade head

# Inicie o frontend
cd frontend
python3 -m http.server 3000