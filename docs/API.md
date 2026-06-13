# API Reference

## Overview

RESTful API for LeadEngine Lead Discovery Intelligence Platform.

All endpoints return JSON responses with consistent format.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {...},
  "timestamp": "2026-06-10T10:00:00Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {...}
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

## Authentication

All endpoints (except `/health`, `/docs`) require JWT bearer token:

```
Authorization: Bearer <token>
```

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### Health Check

#### GET /health

Check API health status.

**Response:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-06-10T10:00:00Z"
}
```

### Leads

#### GET /leads

List all leads with pagination and filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `search` | string | Search in company name/contact |
| `status` | string | Filter by status |
| `score_min` | number | Minimum lead score |
| `score_max` | number | Maximum lead score |
| `sort` | string | Sort field (created_at, score, -created_at) |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "company_id": "uuid",
        "contact_id": "uuid",
        "status": "new",
        "score": 75,
        "created_at": "2026-06-10T10:00:00Z",
        "updated_at": "2026-06-10T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

#### POST /leads

Create a new lead.

**Request Body:**

```json
{
  "company_id": "uuid",
  "contact_id": "uuid",
  "source": "manual",
  "status": "new"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "company_id": "uuid",
    "contact_id": "uuid",
    "status": "new",
    "score": null,
    "created_at": "2026-06-10T10:00:00Z"
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

#### GET /leads/:id

Get lead details.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "company": {...},
    "contact": {...},
    "website": {...},
    "audit": {...},
    "score": 75,
    "status": "new",
    "created_at": "2026-06-10T10:00:00Z"
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

#### PUT /leads/:id

Update lead.

**Request Body:**

```json
{
  "status": "contacted",
  "notes": "Follow up needed"
}
```

#### DELETE /leads/:id

Delete lead.

### Companies

#### GET /companies

List all companies.

**Query Parameters:**

Same as leads (page, limit, search, sort)

#### POST /companies

Create company.

**Request Body:**

```json
{
  "name": "Company Name",
  "website": "https://example.com",
  "industry": "Technology",
  "size": "10-50",
  "founded_year": 2020
}
```

#### GET /companies/:id

Get company details.

#### PUT /companies/:id

Update company.

#### DELETE /companies/:id

Delete company.

### Contacts

#### GET /contacts

List all contacts.

#### POST /contacts

Create contact.

**Request Body:**

```json
{
  "company_id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "title": "CEO",
  "department": "Management"
}
```

#### GET /contacts/:id

Get contact details.

#### PUT /contacts/:id

Update contact.

#### DELETE /contacts/:id

Delete contact.

### Exports

#### POST /exports

Create export job.

**Request Body:**

```json
{
  "format": "xlsx",
  "filters": {
    "status": "new",
    "score_min": 50
  },
  "columns": ["company_name", "contact_email", "score", "status"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "processing",
    "progress": 0,
    "format": "xlsx",
    "created_at": "2026-06-10T10:00:00Z"
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

#### GET /exports/:id

Get export job status.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "completed",
    "progress": 100,
    "format": "xlsx",
    "download_url": "https://...",
    "created_at": "2026-06-10T10:00:00Z",
    "completed_at": "2026-06-10T10:05:00Z"
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

### Scoring

#### POST /leads/:id/score

Trigger lead scoring.

**Response:**

```json
{
  "success": true,
  "data": {
    "lead_id": "uuid",
    "score": 75,
    "factors": {
      "website_quality": 80,
      "contact_availability": 70,
      "business_size": 75,
      "digital_maturity": 75
    },
    "calculated_at": "2026-06-10T10:00:00Z"
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

### Audits

#### POST /companies/:id/audit

Trigger website audit.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "company_id": "uuid",
    "status": "processing",
    "created_at": "2026-06-10T10:00:00Z"
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

#### GET /audits/:id

Get audit results.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "company_id": "uuid",
    "url": "https://example.com",
    "mobile_friendly": true,
    "has_ssl": true,
    "seo_score": 75,
    "page_speed": 65,
    "has_contact_form": true,
    "has_whatsapp": false,
    "recommendations": [...],
    "completed_at": "2026-06-10T10:00:00Z"
  },
  "timestamp": "2026-06-10T10:00:00Z"
}
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

## Rate Limiting

- **Limit:** 100 requests per 15 minutes
- **Header:** `X-RateLimit-Remaining`

## Pagination

Default: 20 items per page, max: 100

**Query:**

```
?page=1&limit=20
```

**Response:**

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## Examples

### Fetch Leads with Filters

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/leads?status=new&score_min=70&page=1&limit=20"
```

### Create Lead

```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "uuid",
    "contact_id": "uuid",
    "source": "manual"
  }'
```

### Export Leads

```bash
curl -X POST http://localhost:3000/api/exports \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "xlsx",
    "filters": {"score_min": 50}
  }'
```

---

**Note:** This is the bootstrap API documentation. Specific endpoints will be implemented in Phase 1.

**Last Updated:** 2026-06-10
