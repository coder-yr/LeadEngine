import { Router, Request, Response } from 'express';
import { TaskRepository } from '../../db/repositories/TaskRepository.js';

const router = Router();
const repository = new TaskRepository();

// GET /api/tasks - Get all tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.query;
    const tasks = await repository.getTasks(companyId as string | undefined);
    return res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks - Create a task
router.post('/', async (req: Request, res: Response) => {
  try {
    const taskInput = req.body;
    
    if (!taskInput.company_id || !taskInput.title || !taskInput.type) {
      return res.status(400).json({ error: 'company_id, title, and type are required' });
    }

    const newTask = await repository.createTask(taskInput);
    return res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id/status - Update task status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'Pending' && status !== 'Completed') {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedTask = await repository.updateTaskStatus(id, status);
    return res.json(updatedTask);
  } catch (error) {
    console.error(`Error updating task ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
