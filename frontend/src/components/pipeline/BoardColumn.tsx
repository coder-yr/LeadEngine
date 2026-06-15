import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BoardCard } from "./BoardCard";
import { Badge } from "@/components/ui/badge";

interface BoardColumnProps {
  id: string;
  title: string;
  companies: any[];
}

export function BoardColumn({ id, title, companies }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div className="flex flex-col flex-shrink-0 w-80 bg-muted/30 border border-border/50 rounded-xl overflow-hidden h-full">
      <div className="p-4 border-b border-border/50 bg-card flex justify-between items-center">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="px-2 py-0">{companies.length}</Badge>
      </div>
      
      <div 
        ref={setNodeRef} 
        className={`flex-1 p-3 overflow-y-auto transition-colors ${isOver ? 'bg-muted/50' : ''}`}
      >
        <SortableContext items={companies.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {companies.map((company) => (
            <BoardCard key={company.id} id={company.id} company={company} />
          ))}
        </SortableContext>
        
        {companies.length === 0 && (
          <div className="h-24 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center text-xs text-muted-foreground/60">
            Drop companies here
          </div>
        )}
      </div>
    </div>
  );
}
