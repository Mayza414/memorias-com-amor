# ![Memórias com Amor](assets/img/favicon-32x32.png) 

Uma aplicação web para guardar e organizar memórias especiais com fotos e álbuns personalizados.

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
Acesse
Frontend: http://localhost:3000

API: http://localhost:8000

Documentação da API: http://localhost:8000/api/docs

Produção
Frontend: https://memorias-com-amor-frontend.vercel.app

Backend: https://memorias-com-amor.onrender.com

Documentação da API: https://memorias-com-amor.onrender.com/api/docs

📡 Endpoints da API

Autenticação
Método	Endpoint	Descrição	Limite
POST	/api/auth/register	Registrar novo usuário	5/min
POST	/api/auth/login	Login	10/min
POST	/api/auth/refresh	Renovar token	-
GET	/api/auth/me	Dados do usuário	-
Álbuns
Método	Endpoint	Descrição
GET	/api/albums	Listar álbuns
POST	/api/albums	Criar álbum
GET	/api/albums/{id}	Buscar álbum
PATCH	/api/albums/{id}	Atualizar álbum
DELETE	/api/albums/{id}	Deletar álbum
Fotos
Método	Endpoint	Descrição
POST	/api/photos/upload	Upload de foto
GET	/api/photos/album/{id}	Listar fotos do álbum
GET	/api/photos/all	Listar todas as fotos
PATCH	/api/photos/{id}	Atualizar foto
DELETE	/api/photos/{id}	Deletar foto
POST	/api/photos/{id}/fav	Favoritar/desfavoritar
Perfil
Método	Endpoint	Descrição
GET	/api/profile/me	Obter perfil
PATCH	/api/profile/me	Atualizar perfil
POST	/api/profile/upload-pic	Upload de foto de perfil

🔒 Segurança

Rate Limiting - Limite de requisições por IP (registro: 5/min, login: 10/min)

Headers de Segurança - X-Content-Type-Options, X-Frame-Options, CSP

Validação de Senha - Mínimo 8 caracteres, maiúscula, minúscula, número e especial

JWT - Tokens com expiração (60 minutos) e refresh tokens (30 dias)

CORS - Configuração restrita de origens permitidas

📁 Estrutura do Projeto

memorias-com-amor/
├── backend/
│   ├── app/
│   │   ├── core/          # Configurações, segurança, rate limiting
│   │   ├── models/        # Modelos SQLAlchemy
│   │   ├── routers/       # Rotas da API
│   │   ├── schemas/       # Schemas Pydantic
│   │   └── main.py        # Entry point
│   ├── alembic/           # Migrações
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── css/               # Estilos
│   ├── js/                # JavaScript
│   ├── img/               # Imagens e favicons
│   ├── docs.html          # Documentação do site
│   └── index.html         # Página principal
├── docker-compose.yml
└── README.md

🌐 URLs do Projeto

Serviço	URL
Frontend	https://memorias-com-amor-frontend.vercel.app
Backend	https://memorias-com-amor.onrender.com
Swagger UI	https://memorias-com-amor.onrender.com/api/docs
ReDoc	https://memorias-com-amor.onrender.com/api/redoc
GitHub	https://github.com/Mayza414/memorias-com-amor

🤝 Contribuição

Faça um fork do projeto

Crie uma branch para sua feature (git checkout -b feature/nova-feature)

Commit suas mudanças (git commit -m 'feat: adiciona nova feature')

Push para a branch (git push origin feature/nova-feature)

Abra um Pull Request

📄 Licença
Este projeto está sob a licença MIT.

👩‍💻 Autora

Mayza Silva

GitHub: @Mayza414

Projeto: Memórias com Amor