/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Kaga data table components.
 *
 * A set of components for displaying and interacting with data tables.
 */

import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    EyeIcon,
    SearchIcon,
} from "lucide-react";
import { ComponentProps } from "react";
import {
    ColumnDef,
    ColumnHelper,
    Column,
    createColumnHelper,
    flexRender,
    Header,
    Row,
    RowData,
    Table as TanstackTable,
} from "@tanstack/react-table";

import { KagaSearchHotkey } from "@/components/blocks/kaga-search-hotkey";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";

interface KagaTableProps<TData extends RowData> {
    table: TanstackTable<TData>;
}

function KagaTable<TData extends RowData>({ table }: KagaTableProps<TData>) {
    const isEmpty = table.getRowCount() == 0;

    return (
        <Table>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="">
                        {headerGroup.headers.map((header) => (
                            <KagaTableHeadCell key={header.id} header={header} />
                        ))}
                    </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => {
                            const { columnDef } = cell.column;
                            return (
                                <TableCell key={cell.id} {...(columnDef.meta?.cellProps ?? {})}>
                                    {flexRender(columnDef.cell, cell.getContext())}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))}
                {isEmpty && (
                    <TableRow>
                        <TableCell
                            colSpan={table.getVisibleFlatColumns().length}
                            className="text-center"
                        >
                            No results found
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}

function KagaTableHeadCell<TData extends RowData>({
    header,
}: ComponentProps<typeof TableHeadCell> & {
    header: Header<TData, unknown>;
}) {
    const { column } = header;
    const { columnDef } = column;

    const canSort = column.getCanSort();
    const canFilter = column.getCanFilter() && !!columnDef.meta?.columnOptions?.length;
    const isSorted = column.getIsSorted();
    const label = flexRender(columnDef.header, header.getContext());

    if (!canSort && !canFilter) {
        return (
            <TableHeadCell data-column-id={column.id} {...(columnDef.meta?.headerProps ?? {})}>
                <div data-slot="table-head-cell-content">{label}</div>
            </TableHeadCell>
        );
    }

    const activeFilterCount = (column.getFilterValue() as unknown[] | undefined)?.length ?? 0;

    return (
        <TableHeadCell
            data-column-id={column.id}
            {...(columnDef.meta?.headerProps ?? {})}
            className={cn("p-0", columnDef.meta?.headerProps?.className)}
        >
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        data-slot="table-head-cell-content"
                        className="flex h-10 w-full items-center gap-1.5 px-2 text-left font-medium outline-none select-none hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                        <span className="truncate">{label}</span>
                        {isSorted == "asc" && (
                            <ArrowDownAZIcon className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        {isSorted == "desc" && (
                            <ArrowDownZAIcon className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        {activeFilterCount > 0 && (
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDownIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-50" align="start">
                    {canSort && <KagaSortMenuItems column={column} isSorted={isSorted} />}
                    {canSort && canFilter && <DropdownMenuSeparator />}
                    {canFilter && <KagaFilterMenuItems column={column} />}
                </DropdownMenuContent>
            </DropdownMenu>
        </TableHeadCell>
    );
}

function KagaSortMenuItems<TData extends RowData>({
    column,
    isSorted,
}: {
    column: Column<TData, unknown>;
    isSorted: false | "asc" | "desc";
}) {
    return (
        <DropdownMenuGroup>
            <DropdownMenuLabel>Sort</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
                checked={isSorted === "asc"}
                onSelect={(ev) => {
                    ev.preventDefault();
                    if (isSorted === "asc") column.clearSorting();
                    else column.toggleSorting(false);
                }}
            >
                <ArrowDownAZIcon />
                Ascending
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
                checked={isSorted === "desc"}
                onSelect={(ev) => {
                    ev.preventDefault();
                    if (isSorted === "desc") column.clearSorting();
                    else column.toggleSorting(true);
                }}
            >
                <ArrowDownZAIcon />
                Descending
            </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
    );
}

function KagaFilterMenuItems<TData extends RowData>({
    column,
}: {
    column: Column<TData, unknown>;
}) {
    const current = (column.getFilterValue() ?? []) as unknown[];

    return (
        <DropdownMenuGroup>
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            {column.columnDef.meta?.columnOptions?.map((option) => (
                <DropdownMenuCheckboxItem
                    key={option.label}
                    checked={current.includes(option.value)}
                    onSelect={(ev) => ev.preventDefault()}
                    onCheckedChange={(checked) => {
                        column.setFilterValue(
                            checked
                                ? [...current, option.value]
                                : current.filter((v) => v !== option.value),
                        );
                    }}
                >
                    {option.label}
                </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuGroup>
    );
}

function KagaTableToolbar<TData extends RowData>({ table }: { table: TanstackTable<TData> }) {
    return (
        <div
            className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2 sm:flex-row sm:items-center"
            data-slot="table-toolbar"
        >
            <KagaSearchHotkey />
            <InputGroup className={cn("grow bg-background")}>
                <InputGroupInput
                    placeholder="Search..."
                    value={table.getState().globalFilter ?? ""}
                    onChange={(ev) => table.setGlobalFilter(ev.target.value)}
                />
                <InputGroupAddon>
                    <SearchIcon className="size-4" />
                </InputGroupAddon>
                <InputGroupAddon align="inline-end" className="text-muted-foreground">
                    {table.getRowCount()} results
                </InputGroupAddon>
            </InputGroup>

            <KagaColumnVisibilityControl table={table} />
        </div>
    );
}

function KagaColumnVisibilityControl<TData extends RowData>({
    table,
}: {
    table: TanstackTable<TData>;
}) {
    const hidableColumns = table.getAllColumns().filter((column) => column.getCanHide());

    if (hidableColumns.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    <EyeIcon className="size-4" />
                    <ChevronDownIcon className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-50" align="end">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                    {hidableColumns.map((column) => (
                        <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={column.getIsVisible()}
                            onCheckedChange={(checked) => column.toggleVisibility(checked)}
                        >
                            {getColumnDisplayName(column.columnDef)}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function KagaTablePagination<TData extends RowData>({
    className,
    table,
    ...props
}: ComponentProps<"div"> & { table: TanstackTable<TData> }) {
    const pagination = table.getState().pagination;
    const rowCount = table.getRowCount();
    const pageCount = table.getPageCount();

    const startRowIndex = pagination.pageSize * pagination.pageIndex;
    const endRowIndex = Math.min(startRowIndex + pagination.pageSize, rowCount);

    return (
        <div
            className={cn("grid grid-cols-2 items-center text-sm p-2 border-t", className)}
            {...props}
        >
            <div
                className={cn(
                    "flex gap-1 lg:gap-1.5 text-muted-foreground",
                    rowCount > 10 ? "justify-start" : "col-span-full justify-center",
                )}
            >
                {pageCount > 1 ? (
                    <>
                        <span className="hidden lg:inline">{rowCount > 1 ? "rows" : "row"}</span>
                        <span>{rowCount > 1 ? `${startRowIndex + 1} - ${endRowIndex}` : "1"}</span>
                        <span className="text-muted-foreground/80">of</span>
                        <span>{rowCount}</span>
                    </>
                ) : (
                    <span>
                        {rowCount} {rowCount > 1 ? "rows" : "row"}
                    </span>
                )}
            </div>
            {pageCount > 1 && (
                <div className="flex gap-2 items-center justify-end text-muted-foreground">
                    <Button
                        variant="outline"
                        disabled={!table.getCanPreviousPage()}
                        onClick={() => table.previousPage()}
                    >
                        <ChevronLeftIcon className="size-4" />{" "}
                        <span className="hidden sm:block">Previous</span>
                    </Button>
                    <Button
                        variant="outline"
                        disabled={!table.getCanNextPage()}
                        onClick={() => table.nextPage()}
                    >
                        <span className="hidden sm:block">Next</span>{" "}
                        <ChevronRightIcon className="size-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}

function getColumnDisplayName<TData extends RowData>(column: ColumnDef<TData>): string {
    return (
        column.meta?.columnName ??
        (typeof column.header === "string" ? column.header : column.id) ??
        "---UNKNOWN---"
    );
}

function defineColumns<TData extends RowData>(
    // Column value types are heterogeneous per column, so `any` is required here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    factory: (columnHelper: ColumnHelper<TData>) => (ColumnDef<TData, any> | null)[],
): ColumnDef<TData>[] {
    const columnHelper = createColumnHelper<TData>();
    const columns = factory(columnHelper);

    return columns.filter((column): column is ColumnDef<TData> => column !== null);
}

const oneOfFilterFn = <TData extends RowData>(
    row: Row<TData>,
    columnId: string,
    filterValue: unknown[],
) => filterValue.includes(row.getValue<unknown>(columnId));

// Unchecking the last option of a column filter leaves its filterValue as `[]`. Without
// this, the filter entry stays in table state and `[].includes(...)` hides every row
// instead of clearing back to "show all" — so treat an empty array as "remove the filter".
oneOfFilterFn.autoRemove = (filterValue: unknown) =>
    !Array.isArray(filterValue) || filterValue.length === 0;

oneOfFilterFn.resolveFilterValue = (filterValue: unknown) =>
    Array.isArray(filterValue) ? filterValue : [filterValue];

/**
 * `meta` fragment for a numeric column: centre the header label and the cell
 * values, and render digits with `tabular-nums` so they line up column-wise.
 */
const numericColumnMeta = {
    headerProps: { className: "*:data-[slot=table-head-cell-content]:justify-center" },
    cellProps: { className: "text-center tabular-nums" },
} as const;

export const Kaga = {
    DEFAULT_PAGE_SIZE: 50,
    Table: KagaTable,
    TableToolbar: KagaTableToolbar,
    TablePagination: KagaTablePagination,
    defineColumns,
    numericColumnMeta,
    oneOfFilterFn,
    filterFns: {
        /**
         * Filters rows where the value in the specified column is in the filter value array.
         */
        oneOf: oneOfFilterFn,
    },
};
