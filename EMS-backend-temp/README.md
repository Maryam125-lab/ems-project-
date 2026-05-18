# EMS Backend

Node.js/Express backend for an Employee Management System (EMS), using PostgreSQL for persistence and a modular MVC-style structure: routes -> controllers -> services -> models -> database.

## Tech Stack

- Runtime: Node.js (ES modules)
- Framework: Express 5
- Database: PostgreSQL
- DB client: `pg`
- Auth: JWT (`jsonwebtoken`) + password hashing (`bcrypt`)
- Env/config: `dotenv`
- Dev tooling: `nodemon`

## Project Structure

- [server.js](/c:/Users/Zaid Esspl/Desktop/EMS/backend/server.js) - Express app bootstrap, CORS, JSON middleware, and route mounting.
- [src/config/db.js](/c:/Users/Zaid Esspl/Desktop/EMS/backend/src/config/db.js) - PostgreSQL pool configuration using environment variables.
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - **Core System Flow, DB mapping, and RBAC documentation.**
- [src/routes](/c:/Users/Zaid Esspl/Desktop/EMS/backend/src/routes) - Route definitions grouped by domain.
- [src/controllers](/c:/Users/Zaid Esspl/Desktop/EMS/backend/src/controllers) - Request/response handlers.
- [src/services](/c:/Users/Zaid Esspl/Desktop/EMS/backend/src/services) - Business logic layer.
- [src/models](/c:/Users/Zaid Esspl/Desktop/EMS/backend/src/models) - Direct database access using SQL with `pg`.
- [DDL/merged_db.sql](/c:/Users/Zaid Esspl/Desktop/EMS/backend/DDL/merged_db.sql) - Current PostgreSQL DDL reference for the backend schema.
- [ALL_MODELS_AND_SQL.md](/c:/Users/Zaid Esspl/Desktop/EMS/backend/ALL_MODELS_AND_SQL.md) - Historical documentation for models and related SQL.

## Main Routes

All routes are mounted under `/api` in `src/app.js`.

**System Architecture & Flow**: See [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) for the ground truth on how the system operates.

**Full API Documentation**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed endpoints, payloads, and response codes.

- **Authentication**: `/api/auth` (Login, Logout, Session, Password)
- **Employees**: `/api/employees` (Profile management, Personal/Job/Extra info)
- **Attendance**: `/api/attendance` (Tracking, Reports, Acknowledgment)
- **Leaves**: `/api/leave-requests` (Requests, Approvals, Balances)
- **Dashboard**: `/api/dashboard` (HR Metrics, Employee self-service summary)
- **Configuration**: `/api/config` (Global lookups like Departments, Designations)
- **Penalties**: `/api/penalties` (Rule management and issuance)
- **Directory**: `/api/directory` (Employee phonebook)

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- PostgreSQL instance

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create the database schema in PostgreSQL using the merged DDL:

```bash
\i DDL/merged_db.sql
```

3. Create a `.env` file in the project root with database and server configuration.

### Environment Variables

```env
PORT=3000
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ems_db
JWT_SECRET=your_jwt_secret
BCRYPT_SALT_ROUNDS=10
```

## Running the Server

```bash
npm start
```

By default the server listens on `http://localhost:3000`. CORS currently allows requests from `http://localhost:5173`.

## Available Scripts

| Command               | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `npm start`           | Start dev server with auto-restart (nodemon)            |
| `npm run db:create`   | Create a new migration file                             |
| `npm run db:migrate`  | Run all pending migrations                              |
| `npm run db:rollback` | Undo the last migration                                 |
| `npm run db:check`    | Preview what migrations would run (dry-run, no changes) |
| `npm run db:fake`     | Mark migrations as run without executing them           |
| `npm run db:seed`     | Insert dummy seed data into the database                |

## Code Organization

Each domain typically has:

- a model in `src/models`
- a service in `src/services`
- a controller in `src/controllers`
- a route file in `src/routes`

Shared middleware lives under `src/middleware`.

## Extending the API

1. Add or update the database schema in `DDL/merged_db.sql` or its source migrations.
2. Add a model file in `src/models`.
3. Add a service in `src/services`.
4. Add a controller in `src/controllers`.
5. Add a route file in `src/routes`.
6. Mount the route in `server.js`.

## Notes

- Error handling is centralized via the Express error middleware in `server.js`.
- Authentication and authorization behavior depends on the implementations in `src/middleware` and the auth/user modules.
- Tests are not set up yet.
