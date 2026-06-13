# Contributing Guide

Contribution guidelines for LeadEngine project.

## Code of Conduct

- Be respectful to all contributors
- Provide constructive feedback
- Help others succeed

## Getting Started

1. Fork repository
2. Clone your fork
3. Create feature branch: `git checkout -b feature/amazing-feature`
4. Make changes
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Create Pull Request

## Development Setup

See [SETUP.md](SETUP.md) for detailed instructions.

## Code Standards

### TypeScript

- Strict mode enabled
- No `any` types without justification
- Proper error handling
- Type all function parameters and returns

```typescript
// ✅ Good
function calculateScore(data: LeadData): number {
  return data.quality * data.relevance;
}

// ❌ Bad
function calculateScore(data: any) {
  return data.quality * data.relevance;
}
```

### Error Handling

Always handle errors explicitly:

```typescript
try {
  const result = await service.process(data);
  return result;
} catch (error) {
  logger.error(error, 'Operation failed');
  throw new AppError('User-friendly message', 500);
}
```

### Async/Await

Prefer async/await over promises:

```typescript
// ✅ Good
async function fetchLeads() {
  try {
    const leads = await db.leads.find();
    return leads;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

// ❌ Bad
function fetchLeads() {
  return db.leads.find()
    .then(leads => leads)
    .catch(error => logger.error(error));
}
```

### Logging

Use structured logging:

```typescript
import { logger } from '@/utils/logger';

logger.info({ userId: '123' }, 'User logged in');
logger.error(error, 'Failed to process lead');
logger.warn({ score: 30 }, 'Low lead score');
```

### Validation

Use Zod for schema validation:

```typescript
import { z } from 'zod';

const CreateLeadSchema = z.object({
  company_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  source: z.enum(['manual', 'api', 'import']),
});

type CreateLeadDTO = z.infer<typeof CreateLeadSchema>;
```

## Frontend Standards

### Components

- One component per file
- Named exports
- Props interface
- JSDoc comments

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Primary button component
 */
export function Button({ label, onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### Hooks

- Custom hooks in `hooks/` folder
- Prefix with `use`
- Document dependencies

```typescript
export function useLeads() {
  const query = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const response = await api.get('/leads');
      return response.data;
    },
  });

  return query;
}
```

### API Calls

- Centralize in `services/`
- Use Axios
- Proper error handling

```typescript
// services/leads.ts
export async function fetchLeads(page: number, limit: number) {
  try {
    const response = await api.get('/leads', {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    logger.error(error, 'Failed to fetch leads');
    throw error;
  }
}
```

## Backend Standards

### Services

- Single responsibility
- Dependency injection
- Async methods

```typescript
export class LeadService {
  constructor(
    private leadRepository: LeadRepository,
    private scoreService: ScoreService,
  ) {}

  async createLead(dto: CreateLeadDTO): Promise<Lead> {
    const lead = await this.leadRepository.create(dto);
    await this.scoreService.scoreLead(lead.id);
    return lead;
  }
}
```

### Repositories

- Abstract database queries
- Return DTOs
- Handle errors

```typescript
export class LeadRepository {
  async create(data: CreateLeadDTO): Promise<Lead> {
    const lead = await db
      .from('leads')
      .insert(data)
      .select()
      .single();
    return lead;
  }

  async findById(id: string): Promise<Lead | null> {
    const lead = await db
      .from('leads')
      .select()
      .eq('id', id)
      .single();
    return lead;
  }
}
```

### Routes

- Keep controllers thin
- Delegate to services
- Proper HTTP status codes

```typescript
router.post('/leads', async (req, res) => {
  try {
    const dto = CreateLeadSchema.parse(req.body);
    const lead = await leadService.createLead(dto);
    res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to create lead',
    });
  }
});
```

## Testing

### Test File Naming

```
src/services/lead.service.ts
src/services/__tests__/lead.service.test.ts
```

### Test Structure

```typescript
describe('LeadService', () => {
  let service: LeadService;

  beforeEach(() => {
    service = new LeadService(mockRepository, mockScoreService);
  });

  describe('createLead', () => {
    it('should create a new lead', async () => {
      const dto = { company_id: '123', contact_id: '456' };
      const result = await service.createLead(dto);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should score lead after creation', async () => {
      const dto = { company_id: '123', contact_id: '456' };
      await service.createLead(dto);
      expect(mockScoreService.scoreLead).toHaveBeenCalled();
    });
  });
});
```

## Git Commit Messages

Follow conventional commits:

```
feat: Add lead scoring algorithm
fix: Resolve database connection issue
docs: Update API documentation
test: Add tests for lead service
refactor: Restructure file organization
chore: Update dependencies
```

## Pull Request Process

1. Update README/docs if needed
2. Add tests for new features
3. Ensure all tests pass: `npm run test`
4. Run linter: `npm run lint`
5. Fill PR template with description
6. Link related issues

## Deployment

- Main branch deploys to production
- Use semantic versioning
- Tag releases
- Update CHANGELOG

## Performance Guidelines

- Database queries: Include indexes
- API responses: Paginate large datasets
- Frontend: Code split and lazy load
- Workers: Implement timeouts and retries

## Security

- Never commit secrets
- Validate all inputs
- Use prepared statements
- Implement rate limiting
- CORS properly configured

## Documentation

- Update docs for new features
- Add JSDoc comments
- Include examples
- Update ROADMAP

## Questions?

Open an issue or discussion for:
- Architecture decisions
- Design feedback
- Feature proposals
- Bug reports

---

**Last Updated:** 2026-06-10
