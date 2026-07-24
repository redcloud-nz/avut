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
    EllipsisIcon,
    EyeIcon,
    FunnelIcon,
    MoreVerticalIcon,
    SearchIcon,
} from "lucide-react";
import { ComponentProps, Fragment } from "react";
import {
    ColumnDef,
    ColumnHelper,
    createColumnHelper,
    flexRender,
    Header,
    Row,
    RowData,
    Table as TanstackTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
                            <KagaTableHeadCell key={header.id} header={header} table={table} />
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
    table,
}: ComponentProps<typeof TableHeadCell> & {
    header: Header<TData, unknown>;
    table: TanstackTable<TData>;
}) {
    const { columnDef } = header.column;

    const canFilter = header.column.getCanFilter();
    const canSort = header.column.getCanSort();
    const isSorted = header.column.getIsSorted();
    return (
        <TableHeadCell
            key={header.id}
            data-column-id={header.column.id}
            {...(columnDef.meta?.headerProps ?? {})}
        >
            <div className="flex items-center">
                <div data-slot="table-head-cell-content">
                    {flexRender(columnDef.header, header.getContext())}
                </div>
                <div data-slot="table-head-cell-indicators" className="flex items-center">
                    {isSorted == "asc" && (
                        <ArrowDownAZIcon className="size-4 ml-2 inline-block text-muted-foreground" />
                    )}
                    {isSorted == "desc" && (
                        <ArrowDownZAIcon className="size-4 ml-2 inline-block text-muted-foreground" />
                    )}
                    {/* <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVerticalIcon className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-50" align="end">
                            <DropdownMenuGroup>
                                {canFilter && (
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Filter</DropdownMenuLabel>
                                        <DropdownMenuItem></DropdownMenuItem>
                                    </DropdownMenuGroup>
                                )}
                                {canSort && (
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Sort</DropdownMenuLabel>
                                        <DropdownMenuCheckboxItem
                                            onSelect={() => {
                                                if (isSorted != "asc")
                                                    header.column.toggleSorting(false);
                                                else header.column.clearSorting();
                                            }}
                                            checked={isSorted === "asc"}
                                        >
                                            <ArrowDownAZIcon />
                                            Ascending
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            onSelect={() => {
                                                if (isSorted != "desc")
                                                    header.column.toggleSorting(true);
                                                else header.column.clearSorting();
                                            }}
                                            checked={isSorted === "desc"}
                                        >
                                            <ArrowDownZAIcon />
                                            Descending
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuGroup>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu> */}
                </div>
            </div>
        </TableHeadCell>
    );
}

function KagaTableToolbar<TData extends RowData>({ table }: { table: TanstackTable<TData> }) {
    const columns = table.getAllColumns();

    return (
        <div
            className="flex flex-col sm:flex-row sm:items-center gap-2 bg-accent/50 p-2 border rounded-lg"
            data-slot="table-toolbar"
        >
            <InputGroup className={cn("grow bg-background")}>
                <InputGroupInput
                    placeholder="Search..."
                    value={table.getState().globalFilter ?? ""}
                    onChange={(ev) => table.setGlobalFilter(ev.target.value)}
                />
                <InputGroupAddon>
                    <SearchIcon className="size-4" />
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">{table.getRowCount()} results</InputGroupAddon>
            </InputGroup>

            <div className="flex items-center gap-2">
                <KagaColumnSortingControl table={table} />
                <KagaColumnFilterControl table={table} />
                <KagaColumnVisibilityControl table={table} />
            </div>
        </div>
    );
}

function KagaColumnSortingControl<TData extends RowData>({
    table,
}: {
    table: TanstackTable<TData>;
}) {
    const sortableColumns = table.getAllColumns().filter((column) => column.getCanSort());

    if (sortableColumns.length === 0) {
        return null;
    }

    const currentSortedColumn =
        sortableColumns.find((column) => column.getIsSorted()) ?? sortableColumns[0];

    function handleSortChange(columnId: string) {
        const column = sortableColumns.find((col) => col.id === columnId);

        column?.toggleSorting(column.getIsSorted() === "asc" ? true : false);
    }

    function handleSortDirectionChange() {
        const currentDirection = currentSortedColumn.getIsSorted();
        currentSortedColumn.toggleSorting(currentDirection == "asc");
    }

    return (
        <ButtonGroup>
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                {getColumnDisplayName(currentSortedColumn.columnDef)}
                                <ChevronDownIcon className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        Select column to sort by. <br /> Currently sorted by{" "}
                        {getColumnDisplayName(currentSortedColumn.columnDef)}.
                    </TooltipContent>
                </Tooltip>

                <DropdownMenuContent className="w-50" align="end">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                            value={currentSortedColumn.id}
                            onValueChange={handleSortChange}
                        >
                            {sortableColumns.map((column) => (
                                <DropdownMenuRadioItem value={column.id} key={column.id}>
                                    {getColumnDisplayName(column.columnDef)}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleSortDirectionChange}>
                        {currentSortedColumn.getIsSorted() == "asc" ? (
                            <ArrowDownAZIcon className="size-4" />
                        ) : (
                            <ArrowDownZAIcon className="size-4" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    Toggle sort direction. <br /> Currently{" "}
                    {currentSortedColumn.getIsSorted() == "asc" ? "Ascending" : "Descending"}
                </TooltipContent>
            </Tooltip>
        </ButtonGroup>
    );
}

function KagaColumnFilterControl<TData extends RowData>({
    table,
}: {
    table: TanstackTable<TData>;
}) {
    const filterableColumns = table.getAllColumns().filter((column) => column.getCanFilter());

    if (filterableColumns.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    <FunnelIcon className="size-4" />
                    <ChevronDownIcon className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-50" align="end">
                {filterableColumns.map((column) => {
                    const current = (column.getFilterValue() ?? []) as any[];
                    return (
                        <DropdownMenuGroup key={column.id}>
                            <DropdownMenuLabel>
                                {getColumnDisplayName(column.columnDef)}
                            </DropdownMenuLabel>
                            {column.columnDef.meta?.columnOptions?.map((option) => (
                                <DropdownMenuCheckboxItem
                                    key={option.label}
                                    checked={current.includes(option.value)}
                                    onCheckedChange={(checked) => {
                                        if (checked)
                                            column.setFilterValue([...current, option.value]);
                                        else
                                            column.setFilterValue(
                                                current.filter((v) => v != option.value),
                                            );
                                    }}
                                >
                                    {option.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuGroup>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
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
    factory: (columnHelper: ColumnHelper<TData>) => (ColumnDef<TData, any> | null)[],
): ColumnDef<TData>[] {
    const columnHelper = createColumnHelper<TData>();
    const columns = factory(columnHelper);

    return columns.filter((column): column is ColumnDef<TData> => column !== null);
}

const oneOfFilterFn = <TData extends RowData>(
    row: Row<TData>,
    columnId: string,
    filterValue: any[],
) => filterValue.includes(row.getValue<any>(columnId));

oneOfFilterFn.autoRemove = (val: any[]) => false;

oneOfFilterFn.resolveFilterValue = (filterValue: any) =>
    Array.isArray(filterValue) ? filterValue : [filterValue];

export const Kaga = {
    DEFAULT_PAGE_SIZE: 50,
    Table: KagaTable,
    TableToolbar: KagaTableToolbar,
    TablePagination: KagaTablePagination,
    defineColumns,
    oneOfFilterFn,
    filterFns: {
        /**
         * Filters rows where the value in the specified column is in the filter value array.
         */
        oneOf: oneOfFilterFn,
    },
};
