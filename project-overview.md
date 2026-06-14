# PrepMind AI - Project Overview & Architecture

## CURRENT STATE: First Basic Prototype

### What It Is Now
PrepMind AI is a **full-stack React + Express web application** featuring a multi-role learning platform with mock/demo data. It's currently a **working prototype with UI components and mock backend APIs** but lacks persistent data integration.

---

## 🏗️ CURRENT ARCHITECTURE (Prototype Phase)

### Frontend (React + TypeScript + Vite)
**Location:** `/src`

#### Entry Points
- **Landing Page** (`/`) - Marketing landing with features, testimonials, stats
- **Login Page** (`/login`) - Role-based login with demo accounts (Student, Parent, Faculty, Admin)
- **Routing** (`App.tsx`) - Role-based route protection and navigation

#### User Portals (4 Main Roles)

##### 1. **Student Portal** (`/student/*`)
- **Dashboard**: Performance score, rank, accuracy, weekly trends, mastery heatmap
- **Practice Module**: Topic/subject/chapter-wise practice with filters
- **Exam Interface**: Timed tests with question palette, flagging, bookmarking
- **Test Analysis**: Score breakdown, topic/difficulty analysis
- **AI Adaptive Insights**: Learning speed, consistency, retention, knowledge gap heatmap
- **Leaderboard**: Student rankings with competition metrics
- **Components**: 
  - CircularProgress, PodiumCard, RankTable
  - WeeklyBarChart, DonutChart, HeatmapGrid
  - QuestionPalette, ProgressBar, AIInsightBanner

##### 2. **Parent Portal** (`/parent/*`)
- **Child Overview**: Rank, attendance, practice frequency, improvement metrics
- **Progress Tracking**: Weekly/monthly growth charts, concept mastery status
- **Embedded Student View**: Can peek into child's dashboard

##### 3. **Faculty Portal** (`/faculty/*`)
- **Dashboard**: Student/test statistics, question bank size, average performance
- **Question Bank Management**: Add/edit questions (MCQ, numerical, etc.)
- **Student Analytics**: Individual & batch-level dashboards with intervention alerts
- **Curriculum Gap Identification**: Highlights struggling topics

##### 4. **Admin Portal** (`/admin/*`)
- **Global Dashboard**: Revenue, activity, institution/user totals
- **User Management**: CRUD for users (create, edit, delete)
- **Institute Management**: Manage coaching centers, branches, batches
- **Platform Configuration**: (Placeholder for AI parameter tuning, RBAC, branding)

#### Styling & Design
- **Tailwind CSS** for utility-first styling
- **Material Design Icons** for consistent iconography
- **Responsive Layout**: Desktop-first with mobile support
- **Color System**: Custom theme with semantic colors (on-surface, on-secondary, etc.)

#### Mock Data System (`/src/mocks/*`)
- **student.ts**: Mock student dashboards, practice modules, analysis, insights
- **portal.ts**: Mock faculty/parent/admin data
- **index.ts**: Mock question banks, exam sessions

#### Key Libraries
- `react-router-dom` - Client-side routing with protected routes
- `chart.js` & `react-chartjs-2` - Data visualization
- `vite` - Fast build tool and dev server

---

### Backend (Express + TypeScript)
**Location:** `/server`

#### Core Features (Currently Mock-Based)
1. **Authentication Store** (`auth-store.ts`)
   - User sessions, OTP challenges, password resets
   - Audit logs and notifications
   - Demo accounts with hardcoded credentials

2. **Exam System** (`exam-store.ts`)
   - Exam session management (start, resume, submit)
   - Answer tracking and attempt snapshots
   - Session cache for active exams

3. **Analytics Stores** (`analytics-store.ts`, `portal-analytics-store.ts`)
   - Student dashboard data aggregation
   - Faculty dashboard and question bank stats
   - Parent dashboard and progress tracking
   - Report generation and weekly notifications

4. **Admin Functions** (`admin-store.ts`)
   - User/institute management
   - Global dashboard metrics
   - Reference roles and permissions

5. **Security** (`security.ts`)
   - Token creation and JWT handling
   - Password hashing (bcrypt)
   - CORS and request validation

#### API Endpoints (RESTful)
```
/api/auth/*
  POST /login
  POST /logout
  POST /otp/request
  POST /otp/verify
  POST /forgot-password
  POST /reset-password

/api/student/*
  GET /dashboard
  GET /practice
  POST /exam/start
  POST /exam/submit
  GET /analysis
  GET /insights
  GET /leaderboard

/api/faculty/*
  GET /dashboard
  GET /questions
  POST /questions (add/edit)
  GET /students

/api/parent/*
  GET /dashboard

/api/admin/*
  GET /dashboard
  GET /users
  POST /users
  GET /institutes
  POST /institutes
```

---

### Database (PostgreSQL)
**Location:** `/db`

#### Schema (Currently Skeletal)
- **Bootstrap** (`bootstrap.ts`) - Initializes schema
- **Schema** (`schema.sql`) - Table definitions:
  - Users (id, email, role, password_hash, created_at)
  - Institutes, Batches, Branches
  - Questions (question_text, options, answer, topic)
  - Exams, ExamAttempts, Answers
  - Analytics snapshots, Audit logs, Notifications
- **Seed** (`seed.ts`) - Populates demo data for testing
- **Migrations** (`migrate.ts`) - Schema versioning
- **Reset** (`reset.ts`) - Clear database for testing

#### Data Models (Defined but Minimal)
- User roles: student, parent, faculty, admin
- Question types: MCQ, numerical, descriptive
- Exam types: mock, subject, full-length
- Performance metrics: score, accuracy, retention

---

### Tech Stack Summary
| Layer | Technology |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| **Backend** | Express, TypeScript, Node.js |
| **Database** | PostgreSQL (pg driver) |
| **Dev Tools** | concurrently (run dev + api), tsx (TS execution) |
| **Build** | TypeScript compiler + Vite bundler |

---

## 📊 Current Limitations

### What's Missing or Mock-Only
1. **Real Database Integration**: All data is mock/hardcoded; no actual persistence
2. **AI/Adaptive Logic**: Placeholder analytics; no ML models for recommendations
3. **Question Bank**: No real questions; mock data only
4. **Student Performance Tracking**: No historical data accumulation
5. **Parent/Faculty/Admin Features**: Mostly UI skeletons with mock data
6. **File Upload System**: No support for bulk question imports, documents
7. **Real-time Notifications**: No WebSocket or push notifications
8. **Payment/Subscription**: No billing or subscription management
9. **Batch Management**: Minimal institute/batch functionality
10. **Reporting System**: Basic structure; no advanced analytics export

---

## 🎯 FULLY WORKING VERSION: What It Will Become

### Phase 1: Core Data Layer Integration
- ✅ Connect all API endpoints to PostgreSQL
- ✅ Implement real user authentication (JWT + sessions)
- ✅ Real question bank with CRUD operations
- ✅ Persistent student performance tracking
- ✅ Real exam attempt storage and analysis

### Phase 2: Advanced Analytics & AI
- **Performance Intelligence**:
  - Historical trend analysis (study velocity, retention decay)
  - Knowledge gap identification per student
  - Topic difficulty calibration based on cohort data
  - Predictive analytics: predict performance on unseen topics

- **Adaptive Learning**:
  - Question difficulty adjustment based on student accuracy
  - Smart question recommendations (targeted weak areas)
  - Spaced repetition scheduling
  - Personalized study plans

- **AI Insights Generation**:
  - Automated strengths/weaknesses summary
  - Learning style detection
  - Intervention alerts (early warning system)
  - Peer benchmarking

### Phase 3: Faculty & Admin Empowerment
- **Faculty Features**:
  - Bulk question import (Excel/CSV)
  - Question analytics (discrimination index, difficulty index)
  - Student intervention dashboard with actionable alerts
  - Batch performance comparisons
  - Custom report generation

- **Admin Features**:
  - Multi-tenant institute management
  - User activity audit trails
  - Platform-level analytics dashboard
  - Configuration of AI parameters
  - Role-based access control (RBAC) enforcement
  - Billing & subscription management

### Phase 4: Parent Portal Enhancement
- **Child Monitoring**:
  - Real-time progress notifications
  - Weekly performance digests
  - Comparative metrics (vs class, vs previous period)
  - Learning recommendations from AI
  - Study streak tracking

### Phase 5: Student Portal Excellence
- **Personalized Experience**:
  - Smart question selection based on learning gaps
  - Spaced repetition reminders
  - AI-powered study recommendations
  - Performance projections
  - Learning path customization

- **Exam Features**:
  - Mock exams with realistic timing and formats
  - Detailed post-exam analysis with explanations
  - Topic-wise performance breakdown
  - Difficulty scaling (adaptive difficulty)

- **Social/Gamification** (Optional):
  - Leaderboards with filters (class, school, national)
  - Achievement badges and streaks
  - Study group collaboration
  - Peer comparison (with privacy controls)

### Phase 6: DevOps & Scalability
- **Backend**:
  - Load balancing for exam sessions
  - Caching layer (Redis) for frequently accessed data
  - Async job queue (Bull/BullMQ) for report generation
  - Real-time WebSocket support for live notifications
  - Comprehensive logging and monitoring

- **Frontend**:
  - Code splitting and lazy loading
  - Service worker for offline capability
  - Progressive Web App (PWA) features
  - Performance optimization (Lighthouse 90+)

- **Infrastructure**:
  - Docker containerization
  - CI/CD pipeline (GitHub Actions)
  - Database backups and disaster recovery
  - CDN for static assets
  - Horizontal scaling

### Phase 7: Security & Compliance
- **Authentication**:
  - OAuth2/SSO integration (Google, Microsoft)
  - Two-factor authentication (2FA)
  - Session management and token refresh

- **Data Protection**:
  - Encryption at rest and in transit (TLS)
  - GDPR compliance (data export, deletion)
  - Regular security audits and penetration testing

- **Access Control**:
  - Granular RBAC (role-based access control)
  - Audit logging for all user actions
  - IP whitelisting for admin access

---

## 📈 Success Metrics (Target State)
1. **Performance**: Page load < 2s, API response < 200ms
2. **Reliability**: 99.9% uptime, automatic failure recovery
3. **Scalability**: Support 100K+ concurrent users
4. **User Engagement**: 70%+ daily active users, 80%+ retention
5. **Learning Outcomes**: 30% improvement in test scores for active users
6. **Analytics**: Real-time dashboards, 1000+ data points per student

---

## 🚀 Development Status
| Component | Status | Completeness |
|-----------|--------|--------------|
| **UI/UX Design** | ✅ Complete | 95% |
| **Authentication UI** | ✅ Complete | 90% |
| **Data Visualization** | ✅ Complete | 85% |
| **Database Schema** | ✅ Designed | 70% |
| **API Structure** | ✅ Defined | 60% |
| **Real Data Integration** | ⏳ In Progress | 10% |
| **Analytics Engine** | 📋 Planned | 0% |
| **AI/ML Integration** | 📋 Planned | 0% |
| **Admin Features** | ⏳ Partial | 30% |
| **Security & Auth** | ⏳ Partial | 40% |

---

## 📁 Project Structure
```
PrepMind/
├── src/                      # Frontend (React)
│   ├── pages/               # Route pages (Student, Parent, Faculty, Admin)
│   │   ├── Student/         # Student portal pages + components
│   │   ├── Parent/          # Parent portal pages
│   │   ├── Faculty/         # Faculty portal pages
│   │   ├── Admin/           # Admin portal pages
│   │   ├── Landing.tsx      # Public landing page
│   │   └── Login.tsx        # Auth page
│   ├── components/          # Shared UI components
│   ├── lib/                 # Utilities (auth, api, pages routing)
│   ├── mocks/               # Mock data (student, portal)
│   ├── App.tsx              # Root routing
│   └── main.tsx             # Entry point
├── server/                  # Backend (Express)
│   ├── index.ts             # Main Express app
│   ├── auth-store.ts        # Auth logic
│   ├── exam-store.ts        # Exam logic
│   ├── analytics-store.ts   # Analytics logic
│   ├── admin-store.ts       # Admin logic
│   ├── security.ts          # JWT, hashing
│   ├── seed.ts              # Demo data
│   └── *.ts                 # Other stores
├── db/                      # Database
│   ├── schema.sql           # Table definitions
│   ├── bootstrap.ts         # Schema initialization
│   ├── seed.ts              # Seed data
│   ├── migrate.ts           # Migrations
│   └── client.ts            # PostgreSQL connection
├── package.json             # Dependencies
├── vite.config.ts           # Vite config
├── tsconfig.json            # TypeScript config
└── render.yaml              # Render deployment config
```

---

## 🎓 Learning Goals for Full Version
By making this fully functional, you'll have:
- A **scalable multi-tenant SaaS platform**
- **Real-time analytics engine** processing student performance
- **Adaptive AI system** personalizing learning paths
- **Enterprise-grade dashboard** for institutional analytics
- **Production-ready architecture** deployable to scale

This prototype is the **foundation**; the full version transforms it into a **market-ready edtech platform**.
