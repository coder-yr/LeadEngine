import { Activity } from "@/types/lead";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Globe, BrainCircuit, Mail, FileText, Activity as ActivityIcon } from "lucide-react";

interface ActivityTimelineTabProps {
  activities: Activity[];
}

export function ActivityTimelineTab({ activities }: ActivityTimelineTabProps) {
  // Sort activities by timestamp descending
  const sortedActivities = [...activities].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'Discovery': return <Search className="w-4 h-4" />;
      case 'Audit': return <Globe className="w-4 h-4" />;
      case 'AI_Analysis': return <BrainCircuit className="w-4 h-4" />;
      case 'Email_Sent': return <Mail className="w-4 h-4" />;
      case 'Note_Added': return <FileText className="w-4 h-4" />;
      default: return <ActivityIcon className="w-4 h-4" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'Discovery': return "bg-blue-500/10 text-blue-500";
      case 'Audit': return "bg-purple-500/10 text-purple-500";
      case 'AI_Analysis': return "bg-yellow-500/10 text-yellow-500";
      case 'Email_Sent': return "bg-green-500/10 text-green-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <p>No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="relative border-l border-border ml-3 space-y-8 pb-4">
        {sortedActivities.map((activity) => {
          const date = new Date(activity.timestamp);
          const formattedDate = date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });

          return (
            <div key={activity.id} className="relative pl-8">
              <div className={`absolute -left-3.5 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-background ring-2 ring-background ${getIconColor(activity.type)}`}>
                {getIcon(activity.type)}
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 mb-1">
                <h4 className="font-semibold text-sm">{activity.title}</h4>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formattedDate}
                </span>
              </div>
              
              <Card className="mt-2 bg-muted/30 border-border/50 shadow-none">
                <CardContent className="p-3 text-sm">
                  {activity.description}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
