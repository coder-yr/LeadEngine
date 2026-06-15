import { useState, useEffect } from "react";
import axios from "axios";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { BoardColumn } from "@/components/pipeline/BoardColumn";
import { BoardCard } from "@/components/pipeline/BoardCard";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";

const COLUMNS = [
  "Discovered",
  "Qualified",
  "Contacted",
  "Meeting Scheduled",
  "Proposal Sent",
  "Won",
  "Lost"
];

export default function Pipeline() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:3000/api/companies");
      setCompanies(res.data);
    } catch (error) {
      console.error("Failed to fetch companies", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const activeCompanyId = active.id as string;
    const overId = over.id as string;

    const activeCompany = companies.find((c) => c.id === activeCompanyId);
    if (!activeCompany) return;

    // Determine the target column
    let targetStage = overId;
    
    // If dropping over another card, find that card's column
    if (!COLUMNS.includes(targetStage)) {
      const overCompany = companies.find((c) => c.id === overId);
      if (overCompany) {
        targetStage = overCompany.pipeline_stage || "Discovered";
      } else {
        return;
      }
    }

    // Only update if stage changed
    if (activeCompany.pipeline_stage !== targetStage) {
      // Optimistic update
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === activeCompanyId ? { ...c, pipeline_stage: targetStage } : c
        )
      );

      // Backend update
      try {
        await axios.patch(`http://localhost:3000/api/companies/${activeCompanyId}/stage`, {
          stage: targetStage,
        });
      } catch (error) {
        console.error("Failed to update pipeline stage", error);
        // Revert on failure (could refetch instead)
        fetchCompanies();
      }
    }
  };

  const activeCompany = activeId ? companies.find(c => c.id === activeId) : null;

  return (
    <div className="flex flex-col h-full space-y-6 overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Drag and drop companies to update their sales stage.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchCompanies} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Deal
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full items-start">
            {COLUMNS.map((stage) => (
              <BoardColumn
                key={stage}
                id={stage}
                title={stage}
                companies={companies.filter(
                  (c) => (c.pipeline_stage || "Discovered") === stage
                )}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCompany ? (
              <BoardCard id={activeCompany.id} company={activeCompany} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
