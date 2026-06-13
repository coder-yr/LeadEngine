import { useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type Lead = {
  id: string
  name: string
  company: string
  email: string
  score: number
  status: "New" | "Contacted" | "Qualified" | "Lost"
}

const mockData: Lead[] = [
  { id: "1", name: "Alice Smith", company: "Acme Corp", email: "alice@acme.com", score: 85, status: "New" },
  { id: "2", name: "Bob Jones", company: "Globex", email: "bob@globex.com", score: 45, status: "Contacted" },
  { id: "3", name: "Charlie Brown", company: "Initech", email: "charlie@initech.com", score: 92, status: "Qualified" },
  { id: "4", name: "Diana Prince", company: "Stark Ind", email: "diana@stark.com", score: 12, status: "Lost" },
  { id: "5", name: "Evan Wright", company: "Soylent", email: "evan@soylent.com", score: 67, status: "New" },
]

export default function Leads() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "company",
      header: "Company",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "score",
      header: "Score",
      cell: ({ row }) => {
        const score = row.getValue("score") as number
        return (
          <Badge variant={score > 80 ? "default" : score > 50 ? "secondary" : "destructive"}>
            {score}
          </Badge>
        )
      }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return (
          <Badge variant="outline" className={
            status === 'Qualified' ? 'border-green-500 text-green-500' :
            status === 'Lost' ? 'border-red-500 text-red-500' : ''
          }>
            {status}
          </Badge>
        )
      }
    },
  ]

  const table = useReactTable({
    data: mockData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <Button>Add Lead</Button>
      </div>

      <div className="flex items-center py-4">
        <Input
          placeholder="Filter leads..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm bg-background"
        />
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
