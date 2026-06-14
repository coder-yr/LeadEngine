import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState
} from "@tanstack/react-table";
import { Lead } from "@/types/lead";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Building2 } from "lucide-react";

interface LeadTableProps {
  leads: Lead[];
  selectedLeadId: string | null;
  onSelectLead: (id: string | null) => void;
}

const columnHelper = createColumnHelper<Lead>();

const columns = [
  columnHelper.accessor("company", {
    header: "Company",
    cell: (info) => (
      <div className="font-medium text-foreground truncate max-w-[200px]" title={info.getValue()}>
        {info.getValue()}
      </div>
    ),
  }),
  columnHelper.accessor((row) => row.audit?.url || "No Domain", {
    id: "domain",
    header: "Domain",
    cell: (info) => (
      <div className="text-muted-foreground truncate max-w-[150px]" title={info.getValue()}>
        {info.getValue()}
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue();
      const variant = status === 'New' ? 'default' : status === 'Qualified' ? 'secondary' : 'outline';
      return <Badge variant={variant} className="text-[10px]">{status}</Badge>;
    },
  }),
  columnHelper.accessor((row) => row.intelligence.leadScore, {
    id: "leadScore",
    header: "AI Score",
    cell: (info) => {
      const score = info.getValue() || 0;
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full ${score > 70 ? 'bg-green-500' : score > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
              style={{ width: `${score}%` }} 
            />
          </div>
          <span className="text-xs font-mono">{score}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor((row) => row, {
    id: "signals",
    header: "Signals",
    cell: (info) => {
      const row = info.getValue();
      const hasWhatsApp = row.audit?.hasWhatsAppWidget ?? false;
      const hasContactForm = row.audit?.hasContactForm ?? false;
      return (
        <div className="flex gap-1">
          {hasWhatsApp ? <MessageCircle className="w-3.5 h-3.5 text-green-500" /> : <MessageCircle className="w-3.5 h-3.5 text-muted-foreground opacity-30" />}
          {hasContactForm ? <Building2 className="w-3.5 h-3.5 text-blue-500" /> : <Building2 className="w-3.5 h-3.5 text-muted-foreground opacity-30" />}
        </div>
      );
    },
  }),
];

export function LeadTable({ leads, selectedLeadId, onSelectLead }: LeadTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: leads,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex-1 overflow-auto bg-background rounded-l-lg border-r border-border">
      <Table className="w-full text-sm">
        <TableHeader className="bg-muted/50 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-border/50 hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="h-10 px-4 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{
                    asc: ' ↑',
                    desc: ' ↓',
                  }[header.column.getIsSorted() as string] ?? null}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onSelectLead(row.original.id)}
              className={`
                cursor-pointer transition-colors border-b border-border/40 hover:bg-muted/30
                ${selectedLeadId === row.original.id ? "bg-primary/5 hover:bg-primary/5" : ""}
              `}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="p-3 px-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No leads found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
