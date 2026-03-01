/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Akagi data table components.
 *
 * A set of components for displaying and interacting with data tables.
 */

"use client";

import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsUpDownIcon,
    EllipsisIcon,
    FunnelIcon,
    SearchIcon,
} from "lucide-react";
import { ComponentProps, Fragment, useId } from "react";
import { match } from "ts-pattern";

import {
    CellContext,
    ColumnDef,
    ColumnHelper,
    createColumnHelper,
    flexRender,
    HeaderContext,
    RowData,
    Table as TanstackTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";

type AkagiTableHeadCellProps<TData extends RowData> = Omit<
    ComponentProps<"th">,
    "align"
> &
    Pick<HeaderContext<TData, unknown>, "header"> & {
        align?: "start" | "center" | "end";
        filterOptions?: (string | { value: any; label: string })[];
        showAbove?: "sm" | "md" | "lg" | "xl" | "2xl";
    };

function AkagiTableHeadCell<TData extends RowData>({
    align = "start",
    children,
    className,
    filterOptions,
    header,
    showAbove: showAbove,
    ...props
}: AkagiTableHeadCellProps<TData>) {
    const canFilter =
        header.column.getCanFilter() &&
        filterOptions &&
        filterOptions.length > 0;
    const canSort = header.column.getCanSort();
    const isSorted = header.column.getIsSorted();

    return (
        <TableHeadCell
            className={cn(
                "first:rounded-tl-md last:rounded-tr-md text-table-head-foreground",
                showAbove == "sm" && "hidden sm:table-cell",
                showAbove == "md" && "hidden md:table-cell",
                showAbove == "lg" && "hidden lg:table-cell",
                showAbove == "xl" && "hidden xl:table-cell",
                showAbove == "2xl" && "hidden 2xl:table-cell",
                className,
            )}
            {...props}
        >
            <div
                className={cn(
                    "flex items-center",
                    align == "start",
                    "justify-start",
                    align == "center" && "justify-center",
                    align == "end" && "justify-end",
                )}
            >
                {children}
                {canSort ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground"
                            >
                                {match(isSorted)
                                    .with("asc", () => (
                                        <ArrowDownAZIcon className="size-4" />
                                    ))
                                    .with("desc", () => (
                                        <ArrowDownZAIcon className="size-4" />
                                    ))
                                    .otherwise(() => (
                                        <ChevronsUpDownIcon className="size-4" />
                                    ))}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-32">
                            <DropdownMenuLabel>Sort</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() =>
                                    header.column.toggleSorting(false)
                                }
                                disabled={isSorted == "asc"}
                            >
                                <ArrowDownAZIcon />
                                <span>Ascending</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    header.column.toggleSorting(true)
                                }
                                disabled={isSorted == "desc"}
                            >
                                <ArrowDownZAIcon />
                                <span>Descending</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
                {canFilter ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground pl-1"
                            >
                                <FunnelIcon className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-50">
                            <DropdownMenuLabel>Filter</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {filterOptions.map((option) => {
                                const { value, label } =
                                    typeof option === "string"
                                        ? { value: option, label: option }
                                        : option;

                                const checked = (
                                    (header.column.getFilterValue() as string[]) ??
                                    []
                                ).includes(value);
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={value}
                                        checked={checked}
                                        onSelect={(ev) => {
                                            ev.preventDefault();
                                            if (checked)
                                                header.column.setFilterValue(
                                                    (
                                                        (header.column.getFilterValue() as string[]) ??
                                                        []
                                                    ).filter(
                                                        (v) => v !== value,
                                                    ),
                                                );
                                            else
                                                header.column.setFilterValue([
                                                    ...((header.column.getFilterValue() as string[]) ??
                                                        []),
                                                    value,
                                                ]);
                                        }}
                                    >
                                        {label}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </div>
        </TableHeadCell>
    );
}

type AkagiTableCellProps<TData extends RowData> = Omit<
    ComponentProps<"td">,
    "align"
> &
    Pick<CellContext<TData, unknown>, "cell"> & {
        align?: "start" | "center" | "end";
        showAbove?: "sm" | "md" | "lg" | "xl" | "2xl";
    };

function AkagiTableCell<TData extends RowData>({
    align = "start",
    children,
    className,
    showAbove,
    ...props
}: AkagiTableCellProps<TData>) {
    return (
        <TableCell
            className={cn(
                align == "start" && "text-start",
                align == "center" && "text-center",
                align == "end" && "text-end",
                showAbove == "sm" && "hidden sm:table-cell",
                showAbove == "md" && "hidden md:table-cell",
                showAbove == "lg" && "hidden lg:table-cell",
                showAbove == "xl" && "hidden xl:table-cell",
                showAbove == "2xl" && "hidden 2xl:table-cell",
                className,
            )}
            {...props}
        >
            {children}
        </TableCell>
    );
}

interface AkagiTableProps<TData extends RowData> {
    table: TanstackTable<TData>;
    pagination?: boolean;
}

function AkagiTable<TData extends RowData>({
    table,
    pagination = true,
}: AkagiTableProps<TData>) {
    const tableId = useId();

    const isEmpty = table.getRowCount() == 0;

    return (
        <Table
            slotProps={{
                container: {
                    className: "",
                },
            }}
        >
            <AkagiTableHeader table={table} />
            <TableBody>
                {table.getRowModel().rows.map((row) => (
                    <TableRow key={`${row.id}`}>
                        {row.getVisibleCells().map((cell) => (
                            <Fragment key={cell.id}>
                                {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                )}
                            </Fragment>
                        ))}
                    </TableRow>
                ))}
                {isEmpty && (
                    <tr>
                        <td
                            colSpan={table.getVisibleFlatColumns().length}
                            className="text-center py-4"
                        >
                            No results found
                        </td>
                    </tr>
                )}
            </TableBody>
            {pagination && !isEmpty ? (
                <AkagiPagination tableId={tableId} table={table} />
            ) : null}
        </Table>
    );
}

function AkagiTableHeader<TData extends RowData>({
    className,
    table,
    ...props
}: ComponentProps<"thead"> & { table: TanstackTable<TData> }) {
    return (
        <TableHeader
            className={cn("w-full sticky top-0 bg-background z-5", className)}
            {...props}
        >
            {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="rounded-md">
                    {headerGroup.headers.map((header) => (
                        <Fragment key={header.id}>
                            {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                            )}
                        </Fragment>
                    ))}
                </tr>
            ))}
        </TableHeader>
    );
}

function AkagiPagination<TData extends RowData>({
    className,
    tableId,
    table,
    ...props
}: ComponentProps<"tfoot"> & { tableId: string; table: TanstackTable<TData> }) {
    const pagination = table.getState().pagination;
    const rowCount = table.getRowCount();
    const pageIndex = pagination.pageIndex;
    const pageCount = table.getPageCount();

    const startRowIndex = pagination.pageSize * pagination.pageIndex;
    const endRowIndex = Math.min(startRowIndex + pagination.pageSize, rowCount);

    return (
        <TableFooter
            className={cn("sticky bottom-0 bg-background z-5", className)}
            {...props}
        >
            <tr>
                <td colSpan={table.getAllColumns().length}>
                    <div className="h-10 grid grid-cols-3 items-center text-sm px-2 py-1">
                        <div
                            className={cn(
                                "flex gap-1 lg:gap-1.5 text-muted-foreground",
                                rowCount > 10
                                    ? "justify-start"
                                    : "col-span-full justify-center",
                            )}
                        >
                            {pageCount > 1 ? (
                                <>
                                    <span className="hidden lg:inline">
                                        {rowCount > 1 ? "rows" : "row"}
                                    </span>
                                    <span>
                                        {rowCount > 1
                                            ? `${startRowIndex + 1} - ${endRowIndex}`
                                            : "1"}
                                    </span>
                                    <span className="text-muted-foreground/80">
                                        of
                                    </span>
                                    <span>{rowCount}</span>
                                </>
                            ) : (
                                <span>
                                    {rowCount} {rowCount > 1 ? "rows" : "row"}
                                </span>
                            )}
                        </div>
                        {pageCount > 1 ? (
                            <div className="flex justify-center">
                                {/* Previous Button. Disabled on first page */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!table.getCanPreviousPage()}
                                    onClick={() => table.previousPage()}
                                >
                                    <ChevronLeftIcon />{" "}
                                    <span className="hidden sm:block">
                                        Previous
                                    </span>
                                </Button>

                                {/* Preceeding ellipsis. Shown if there are more than 2 preceeding pages. */}
                                {pageIndex > 1 ? (
                                    <div className="flex size-8 items-center justify-center">
                                        <EllipsisIcon className="size-4" />
                                    </div>
                                ) : null}

                                {/* Previous page number button. Shown if not the first page */}
                                {pageIndex > 0 ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => table.previousPage()}
                                    >
                                        {pageIndex}
                                    </Button>
                                ) : null}

                                {/* Current page number button. Disabled */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="border"
                                    disabled
                                >
                                    {pageIndex + 1}
                                </Button>

                                {/* Next page number button. Shown if not the last page */}
                                {pageIndex + 1 < pageCount ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => table.nextPage()}
                                    >
                                        {pageIndex + 2}
                                    </Button>
                                ) : null}

                                {/* Succeeding ellipsis. Shown if there are more than 2 succeeding pages. */}
                                {pageIndex + 2 < pageCount && (
                                    <div className="flex size-8 items-center justify-center">
                                        <EllipsisIcon className="size-4" />
                                    </div>
                                )}

                                {/* Next Button. Disabled on last page */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!table.getCanNextPage()}
                                    onClick={() => table.nextPage()}
                                >
                                    <span className="hidden sm:block">
                                        Next
                                    </span>{" "}
                                    <ChevronRightIcon />
                                </Button>
                            </div>
                        ) : (
                            <div /* Empty center div to maintain grid structure */
                            ></div>
                        )}
                        {rowCount > 10 ? (
                            <div className="flex items-center justify-end gap-2">
                                <Label
                                    className="text-muted-foreground"
                                    htmlFor={`${tableId}-page-size`}
                                >
                                    per page
                                </Label>
                                <Select
                                    value={pagination.pageSize.toString()}
                                    onValueChange={(value) => {
                                        table.setPageSize(Number(value));
                                    }}
                                >
                                    <SelectTrigger
                                        className="w-20"
                                        id={`${tableId}-page-size`}
                                        size="sm"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 20, 50, 100, 200, 500].map(
                                            (size) => (
                                                <SelectItem
                                                    key={size}
                                                    value={size.toString()}
                                                >
                                                    {size}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}
                    </div>
                </td>
            </tr>
        </TableFooter>
    );
}

function AkagiTableSearch<TData extends RowData>({
    className,
    table,
    ...props
}: ComponentProps<typeof InputGroup> & { table: TanstackTable<TData> }) {
    return (
        <InputGroup className={cn("max-w-sm", className)} {...props}>
            <InputGroupInput
                placeholder="Search..."
                value={table.getState().globalFilter ?? ""}
                onChange={(ev) => table.setGlobalFilter(ev.target.value)}
            />
            <InputGroupAddon>
                <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
                {table.getRowCount()} results
            </InputGroupAddon>
        </InputGroup>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defineColumns<TData extends RowData>(
    factory: (
        columnHelper: ColumnHelper<TData>,
    ) => (ColumnDef<TData, any> | null)[],
): ColumnDef<TData>[] {
    const columnHelper = createColumnHelper<TData>();
    const columns = factory(columnHelper);

    return columns.filter(
        (column): column is ColumnDef<TData> => column !== null,
    );
}

export const Akagi = {
    DEFAULT_PAGE_SIZE: 50,
    Table: AkagiTable,
    TableHeadCell: AkagiTableHeadCell,
    TableCell: AkagiTableCell,
    TableSearch: AkagiTableSearch,
    defineColumns,
};
