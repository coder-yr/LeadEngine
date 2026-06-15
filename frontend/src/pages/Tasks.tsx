import { useState, useEffect } from "react";
import axios from "axios";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Calendar, Phone, Mail, MessageSquare, Building2, User } from "lucide-react";

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:3000/api/tasks");
      setTasks(res.data);
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggleStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "Pending" ? "Completed" : "Pending";
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      await axios.patch(`http://localhost:3000/api/tasks/${taskId}/status`, {
        status: newStatus
      });
    } catch (error) {
      console.error("Failed to update task status", error);
      fetchTasks(); // Revert
    }
  };

  const pendingTasks = tasks.filter(t => t.status === "Pending");
  const completedTasks = tasks.filter(t => t.status === "Completed");

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "Call Lead": return <Phone className="w-4 h-4" />;
      case "Send Proposal": return <Mail className="w-4 h-4" />;
      case "Follow Up": return <MessageSquare className="w-4 h-4" />;
      default: return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const renderTaskCard = (task: any) => (
    <Card key={task.id} className={`transition-all hover:shadow-md ${task.status === "Completed" ? "opacity-60" : ""}`}>
      <CardContent className="p-4 flex items-start gap-4">
        <button 
          onClick={() => handleToggleStatus(task.id, task.status)}
          className="mt-1 text-muted-foreground hover:text-primary transition-colors"
        >
          {task.status === "Completed" ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
        
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <h3 className={`font-semibold ${task.status === "Completed" ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {getTaskIcon(task.type)}
                  {task.type}
                </span>
                {task.companies && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {task.companies.name}
                  </span>
                )}
                {task.contacts && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {task.contacts.first_name} {task.contacts.last_name}
                  </span>
                )}
              </div>
            </div>
            
            {task.due_date && (
              <Badge variant={new Date(task.due_date) < new Date() && task.status === "Pending" ? "destructive" : "secondary"} className="flex items-center gap-1 text-[10px]">
                <Calendar className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </Badge>
            )}
          </div>
          
          {task.notes && (
            <p className="text-sm text-muted-foreground border-l-2 border-muted pl-2 mt-2">
              {task.notes}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Manage follow-ups, calls, and proposals.
          </p>
        </div>
        <CreateTaskDialog onTaskCreated={fetchTasks} />
      </div>

      <div className="grid gap-8">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Pending Tasks
            <Badge variant="secondary" className="rounded-full">{pendingTasks.length}</Badge>
          </h2>
          {pendingTasks.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground">
              No pending tasks. You're all caught up!
            </div>
          ) : (
            <div className="grid gap-3">
              {pendingTasks.map(renderTaskCard)}
            </div>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
              Completed Tasks
              <Badge variant="outline" className="rounded-full">{completedTasks.length}</Badge>
            </h2>
            <div className="grid gap-3">
              {completedTasks.map(renderTaskCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
