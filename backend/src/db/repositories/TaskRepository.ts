import { supabase } from '../../config/supabase.js';

export interface TaskInput {
  company_id: string;
  contact_id?: string | null;
  type: 'Call Lead' | 'Send Proposal' | 'Follow Up' | 'Other';
  status?: 'Pending' | 'Completed';
  title: string;
  notes?: string;
  due_date?: string;
}

export class TaskRepository {
  /**
   * Get all tasks, optionally filtered by company ID
   */
  async getTasks(companyId?: string) {
    let query = supabase
      .from('tasks')
      .select(`
        *,
        companies (name, website_url),
        contacts (first_name, last_name, email, phone)
      `)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create a new task
   */
  async createTask(task: TaskInput) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([task])
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: 'Pending' | 'Completed') {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating task ${taskId} status:`, error);
      throw error;
    }

    return data;
  }
}
