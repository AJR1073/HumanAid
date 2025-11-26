# 🤝 HumanAid Platform

> **Making it effortless for anyone, anywhere to find help or give help.**

**🌐 Live Site:** [https://humanaidapp.org](https://humanaidapp.org)

HumanAid is a comprehensive humanitarian assistance platform that connects people in need with local resources while empowering communities to donate, volunteer, and sponsor aid programs.

## 🌟 Features

- **7,596+ Verified Resources**: Across 141 cities in Illinois & Missouri
- **66+ Resource Categories**: Food, shelter, healthcare, legal aid, and more
- **Interactive Map**: Find resources near you with geospatial search
- **One-Tap Directions**: Get turn-by-turn navigation to any resource
- **Distance-Based Search**: Automatically sorted by proximity
- **Smart Search**: Full-text search with PostgreSQL + PostGIS
- **AI-Validated Data**: Cleaned and categorized using AI validation
- **Mobile-Optimized**: Responsive design with collapsible stats
- **Secure & Fast**: HTTPS via Let's Encrypt, CDN via Cloudflare
- **Future**: LLM chatbot, volunteer management, sponsorships

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18+)
- **PostgreSQL** (v14+) with PostGIS extension
- **Mapbox Account** (free tier works)

### 1. Clone & Install

```bash
git clone <repository-url>
cd HumanAid

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

```bash
cd database

# Make init script executable
chmod +x init-db.sh

# Run database initialization
./init-db.sh

# OR manually:
psql -U postgres -c "CREATE DATABASE humanaid;"
psql -U postgres -d humanaid -f schema.sql
psql -U postgres -d humanaid -f seeds/01_categories.sql
psql -U postgres -d humanaid -f seeds/02_sample_resources.sql
```

### 3. Environment Configuration

**Backend** (`backend/.env`):
```bash
cp backend/.env.example backend/.env

# Edit backend/.env with your settings:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=humanaid
DB_USER=postgres
DB_PASSWORD=your_password
PORT=4000
```

**Frontend** (`frontend/.env`):
```bash
cp frontend/.env.example frontend/.env

# Edit frontend/.env with your settings:
VITE_API_URL=http://localhost:4000/api
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

> 📝 **Get a Mapbox token**: Visit [mapbox.com](https://www.mapbox.com/) and sign up for a free account

### 4. Run the Application

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

The application will open at: **http://localhost:3000**

## 📁 Project Structure

```
HumanAid/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks
│   │   ├── services/         # API services
│   │   ├── utils/            # Helper functions
│   │   ├── App.jsx           # Main application
│   │   └── main.jsx          # Entry point
│   ├── public/               # Static assets
│   └── package.json
├── backend/                  # Node.js/Express API
│   ├── src/
│   │   ├── routes/           # API routes
│   │   ├── controllers/      # Route handlers
│   │   ├── models/           # Database models
│   │   └── server.js         # Server entry
│   └── package.json
├── database/                 # Database files
│   ├── schema.sql            # Database schema
│   ├── seeds/                # Seed data
│   └── init-db.sh            # Setup script
├── scripts/                  # Automation scripts
├── PRD.md                    # Product requirements
├── CATEGORIES.md             # Category definitions
└── CHANGELOG.md              # Development log
```

## 🗺️ Tech Stack

### Frontend
- **React 18** with Vite
- **Mapbox GL JS** for interactive maps
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Axios** for API calls

### Backend
- **Node.js** with Express
- **PostgreSQL** with PostGIS
- **Firebase** (planned for auth)
- **OpenAI** (planned for chatbot)

## 📊 Database Schema

Core tables:
- `categories` - 66+ assistance categories
- `resources` - Humanitarian aid locations
- `users` - User accounts (optional for browsing)
- `sponsorships` - Business/individual sponsors
- `donations` - Donation tracking
- `volunteer_opportunities` - Volunteer postings
- `volunteer_signups` - Volunteer applications

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📈 Development Roadmap

### ✅ Phase 1 - MVP (Complete)
- Database schema with PostGIS
- 66 category system
- React frontend with map interface
- Express API with geospatial search
- Sample data for IL/MO

### 🚧 Phase 2 - Core Features (In Progress)
- [ ] User authentication (Firebase)
- [ ] Resource submission workflow
- [ ] Admin approval dashboard
- [ ] Favorites system

### 📋 Phase 3 - Enhanced Features (Planned)
- [ ] LLM chatbot assistant
- [ ] Multi-language support
- [ ] Volunteer management
- [ ] Sponsorship system
- [ ] Analytics dashboard

### 🌍 Phase 4 - Expansion (Future)
- [ ] National expansion (all 50 states)
- [ ] Mobile apps (iOS/Android)
- [ ] SMS interface
- [ ] VAPI voice assistant
- [ ] API for partners

## 🤝 Contributing

1. Review [PRD.md](./PRD.md) for product vision
2. Check [CHANGELOG.md](./CHANGELOG.md) for current status
3. Create feature branch
4. Submit pull request

## 📝 License

[License details to be added]

## 📧 Contact

[Contact information to be added]

---

**Built with ❤️ to help those who need it most.**
