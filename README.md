# 🔬 LabTrackOS — Institutional Lab Equipment & Asset Issue-Return Tracking System

A full-stack, enterprise-grade laboratory equipment issue-return lifecycle management platform tailored for university labs, polytechnics, and academic institutions.

---

## 🌟 Overview & System Architecture

```
                         LAB ASSET SYSTEM
                                │
       ┌────────────────────────┼────────────────────────┐
       ↓                        ↓                        ↓
    ADMIN                 LAB IN-CHARGE              REQUESTER
(Full Control)         (Issue/Return Cycle)       (Student/Staff)
       │                        │                        │
• Assets CRUD            • Review Pending          • Browse Available
• System Analytics       • Approve / Reject          (Stock > 0)
• Damage/Loss Audit      • Issue Equipment         • Raise Issue Request
• Maintenance Logs         (Decrements Stock)      • Track "My Requests"
       │                 • Return & Inspection           │
       │                   (OK/Damaged/Lost)             │
       └────────────────────────┬────────────────────────┘
                                ↓
                      MONGODB ATLAS (Live)
                                │
       ┌────────────┬───────────┴───────────┬────────────┐
       ↓            ↓                       ↓            ↓
   Available      Issued                 Overdue      Returned /
    Assets      Equipment                Alerts     Damaged / Lost
```

---

## ✨ Features by Role

### 1. 🛡️ Administrator Portal
- **Complete Asset CRUD**: Create, read, update, and delete institutional assets with unique asset tag validation, lab locations, categories, total quantity, and live available quantity constraints.
- **System Analytics & KPI Dashboards**: Real-time counters for Total Unique Assets, Total Equipment Units, Available Stock, Issued Units, Overdue Returns, and Damaged/Lost audit incidents.
- **Audit Logs**: Filterable tables of all historical requests, damaged items, and lost assets.
- **Maintenance Logs**: Log equipment servicing, repairs, costs in INR (₹), technician details, and next scheduled service dates.
- **CSV Data Export**: 1-click export of asset inventory and audit tables to `.csv`.

### 2. 👨‍🏫 Lab In-Charge Portal
- **Pending Review Queue**: Review incoming loan requests with academic purpose and expected return date.
- **Approve / Reject Action**: Check real-time stock and approve or reject applications.
- **Equipment Issuance**: Issuing equipment automatically decrements live stock in MongoDB.
- **Return & Inspection Module**:
  - **OK (Operational)**: Restores available stock count and resets condition to `OK`.
  - **Damaged**: Retains decremented stock, updates condition to `Damaged`, and triggers an audit log.
  - **Lost**: Retains decremented stock, updates condition to `Lost`, and triggers an audit log.
- **Overdue Detection**: Live dynamic calculation of items past their expected return date with urgency tags.

### 3. 🎓 Student & Staff Requester Portal
- **Catalog Discovery**: Search and browse available laboratory apparatus with `availableQuantity > 0`.
- **Issue Request Submission**: Select item, specify quantity, state academic purpose, and choose an expected return date.
- **Live Status Tracking**: View personal request history with status badges (`Pending`, `Approved`, `Issued`, `Returned`, `Rejected`, `Overdue`).
- **One-Click Tag Copying**: Easily copy asset tags and identifiers with instant tooltip feedback.

---

## 🛠️ Technology Stack

- **Frontend**: EJS (Server-Side Templating), Vanilla CSS Design System, Responsive Glassmorphism, Google Fonts (`Outfit` & `Plus Jakarta Sans`)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas via Mongoose ODM
- **Authentication**: Session-based auth (`express-session`, `connect-mongo`, `bcryptjs`)
- **Security & Authorization**: Role-Based Access Control (RBAC) middleware

---

## 📁 Project Directory Structure

```
Lab tracking system/
│
├── models/
│   ├── User.js              # User schema (roles: requester, lab_incharge, admin)
│   ├── Asset.js             # Asset schema (tags, category, lab, condition, quantities)
│   ├── Request.js           # Issue/Return request schema with references
│   └── Maintenance.js       # Equipment servicing & maintenance log schema
│
├── routes/
│   ├── auth.js              # Register, Login, Logout routes
│   ├── assets.js            # Admin asset CRUD routes
│   ├── requestRoutes.js     # Requester catalog & issue request routes
│   ├── labInchargeRoutes.js # Lab in-charge approval, issuance, & return routes
│   ├── dashboardRoutes.js   # Multi-role analytics dashboards
│   ├── maintenanceRoutes.js # Equipment maintenance service tracking
│   └── index.js             # Public landing page
│
├── middleware/
│   └── auth.js              # RBAC guards (isLoggedIn, isAdmin, isLabIncharge, isRequester)
│
├── views/
│   ├── auth/                # Login & Register views with 1-click test fill
│   ├── assets/              # Asset inventory CRUD views
│   ├── requests/            # Available catalog, my requests, return inspection views
│   ├── dashboard/           # Admin, In-Charge, and Requester analytics dashboards
│   ├── maintenance/         # Maintenance service logging views
│   └── partials/            # Header, Footer, and Navigation partials
│
├── public/
│   ├── css/
│   │   └── style.css        # Responsive, custom CSS design system
│   └── js/
│       └── main.js          # Live search, CSV export, and micro-interactions
│
├── .env.example             # Template environment variables
├── .gitignore               # Ignored dependencies and secrets
├── app.js                   # Application server bootstrap
└── package.json             # NPM metadata and dependencies
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [MongoDB Atlas Account](https://www.mongodb.com/cloud/atlas) or a local MongoDB database instance

### 2. Installation
```bash
git clone https://github.com/anujsonkar1526-coder/Lab-Asset-system.git
cd Lab-Asset-system
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/lab_asset_tracker?retryWrites=true&w=majority
SESSION_SECRET=your_super_secret_session_key
```

### 4. Running the Application
- **Development Mode** (with Nodemon):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```
Visit `http://localhost:3000/` in your browser.

---

## 🔑 Demo & Test Credentials

| Role | Email | Password | Landing Portal |
| :--- | :--- | :--- | :--- |
| **🛡️ Administrator** | `admin.test@college.edu` | `password123` | `/dashboard/admin` |
| **👨‍🏫 Lab In-Charge** | `incharge.test@college.edu` | `password123` | `/dashboard/lab-incharge` |
| **🎓 Student / Requester** | `student.test@college.edu` | `password123` | `/dashboard/requester` |

*(The login page also provides 1-click demo buttons for instant credential auto-filling).*

---

## 📄 License
This project is licensed under the ISC License.
