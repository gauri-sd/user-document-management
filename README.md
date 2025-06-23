# User & Document Management API

A comprehensive RESTful API service for managing users, documents, and document processing workflows, built with NestJS, TypeORM, and PostgreSQL.

## Features

- **Authentication & Authorization**
  - JWT-based authentication with role-based access control
  - User registration, login, and logout functionality
  - Role-based guards (Admin, Editor, Viewer)
  - Token blacklisting for secure logout

- **User Management**
  - Create and manage user accounts with multiple roles
  - Admin-only user role management
  - User-document relationship tracking
  - Paginated user listing with search capabilities

- **Document Management**
  - Upload, download, and manage documents
  - File metadata storage and retrieval
  - Role-based document access control
  - Document versioning and update tracking
  - Search and filtering capabilities

- **Document Processing & Ingestion**
  - Multiple processing types: OCR, Text Extraction, Document Classification, Data Extraction
  - Asynchronous job processing with status tracking
  - Retry mechanism with exponential backoff
  - Webhook integration for external processing services
  - Real-time progress monitoring

- **Advanced Features**
  - PostgreSQL database with TypeORM
  - Swagger API documentation
  - Comprehensive error handling
  - Input validation with class-validator
  - Unit testing with Jest

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Docker and Docker Compose (for containerized deployment)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/gauri-sd/user-document-management.git
   cd user-document-management
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Configure the following variables in `.env`:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_password
   DB_DATABASE=postgres
   
   # JWT
    JWT_SECRET=supersecret
   ```

## Running the Application

### Using Docker

1. Build and start the containers:
   ```bash
   docker-compose up --build
   ```

The API will be available at `http://localhost:3000`

### Without Docker

1. Start the PostgreSQL database
2. Run the application:
   ```bash
   # Development mode
   npm run start:dev
   
   # Production mode
   npm run start:prod
   ```

## API Documentation

The API documentation is available via Swagger UI at `http://localhost:3000/api` when the application is running.

### Authentication Endpoints

#### Register User

```bash
curl --location 'http://localhost:3000/auth/register' \
--header 'Content-Type: application/json' \
--data '{
  "email": "user@example.com",
  "password": "password123",
  "roles": ["editor"]
}'
```

#### Login

```bash
curl --location 'http://localhost:3000/auth/login' \
--header 'Content-Type: application/json' \
--data '{
  "email": "user@example.com",
  "password": "password123"
}'
```

#### Logout

```bash
curl --location 'http://localhost:3000/auth/logout' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### User Management Endpoints

#### Get All Users (Admin Only)

```bash
curl --location 'http://localhost:3000/users?page=1&limit=10' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Update User Role (Admin Only)

```bash
curl --location --request PATCH 'http://localhost:3000/users/1/role' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "roles": ["admin", "editor"]
}'
```

#### Get User Documents

```bash
curl --location 'http://localhost:3000/users/1/documents' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Document Management Endpoints

#### Upload Document

```bash
curl --location 'http://localhost:3000/documents/upload' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN' \
--form 'file=@"/path/to/your/document.pdf"' \
--form 'title="Sample Document"' \
--form 'description="This is a sample document"'
```

#### Get All Documents

```bash
curl --location 'http://localhost:3000/documents?page=1&limit=10' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Get Document by ID

```bash
curl --location 'http://localhost:3000/documents/1' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Update Document

```bash
curl --location --request PATCH 'http://localhost:3000/documents/1' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "title": "Updated Document Title",
  "description": "Updated description"
}'
```

#### Delete Document

```bash
curl --location --request DELETE 'http://localhost:3000/documents/1' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Download Document

```bash
curl --location 'http://localhost:3000/documents/1/download' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN' \
--output 'downloaded_document.pdf'
```

### Ingestion & Processing Endpoints

#### Trigger Document Processing

```bash
curl --location 'http://localhost:3000/ingestion/trigger' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "name": "OCR Processing Job",
  "description": "Process uploaded documents using OCR",
  "type": "ocr",
  "documentIds": [1, 2, 3],
  "parameters": {
    "language": "en",
    "confidence": 0.8,
    "extractTables": true
  },
  "maxRetries": 3
}'
```

#### Get All Ingestion Jobs

```bash
curl --location 'http://localhost:3000/ingestion?page=1&limit=10' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Get Ingestion Job by ID

```bash
curl --location 'http://localhost:3000/ingestion/1' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Retry Failed Job

```bash
curl --location --request POST 'http://localhost:3000/ingestion/1/retry' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Update Job Status (Webhook)

```bash
curl --location 'http://localhost:3000/ingestion/webhook/status-update' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "externalJobId": "ext_job_123",
  "status": "completed",
  "progress": 100,
  "output": {
    "extractedText": "Sample extracted text",
    "confidence": 0.95
  }
}'
```

## Processing Types

The system supports the following document processing types:

- **OCR (Optical Character Recognition)**: Extract text from images and scanned documents
- **Text Extraction**: Extract text content from various document formats
- **Document Classification**: Automatically categorize documents by type
- **Data Extraction**: Extract structured data from documents (invoices, forms, etc.)

## Role-Based Access Control

The system implements role-based access control with the following roles:

- **Admin**: Full access to all features, can manage users and their roles
- **Editor**: Can upload, update, and delete documents, trigger processing jobs
- **Viewer**: Can view and download documents, view processing results

## Testing

Run the test suite:

```bash
# Unit tests
npm test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── controllers/
│   ├── services/
│   ├── guards/
│   └── decorators/
├── users/               # User management module
│   ├── controllers/
│   ├── services/
│   └── entities/
├── documents/           # Document management module
│   ├── controllers/
│   ├── services/
│   └── entities/
├── ingestion/           # Document processing module
│   ├── controllers/
│   ├── services/
│   ├── entities/
│   └── dto/
├── processing/          # Processing service
│   └── processing.service.ts
└── common/              # Shared utilities and constants
    ├── constants/
    └── decorators/
```

## Database Schema

The system uses PostgreSQL with the following main tables:

- `users` - User accounts and roles
- `documents` - Document metadata and file information
- `ingestion_jobs` - Processing job tracking and status