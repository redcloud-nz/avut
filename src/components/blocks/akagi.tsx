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

import { S2_Button } from "../ui/s2-button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "../ui/input-group";
import {
    S2_Table,
    S2_TableBody,
    S2_TableCell,
    S2_TableFoot,
    S2_TableHead,
    S2_TableHeader,
    S2_TableRow,
} from "@/components/ui/s2-table";

import { cn } from "@/lib/utils";
import {
    S2_Select,
    S2_SelectContent,
    S2_SelectItem,
    S2_SelectTrigger,
    S2_SelectValue,
} from "../ui/s2-select";
import { Label } from "../ui/label";

type AkagiTableHeaderProps<TData extends RowData> = Omit<
    ComponentProps<"th">,
    "align"
> &
    Pick<HeaderContext<TData, unknown>, "header"> & {
        align?: "start" | "center" | "end";
        filterOptions?: string[];
        showAbove?: "sm" | "md" | "lg" | "xl" | "2xl";
    };

function AkagiTableHeader<TData extends RowData>({
    align = "start",
    children,
    className,
    filterOptions,
    header,
    showAbove: showAbove,
    ...props
}: AkagiTableHeaderProps<TData>) {
    const canFilter =
        header.column.getCanFilter() &&
        filterOptions &&
        filterOptions.length > 0;
    const canSort = header.column.getCanSort();
    const isSorted = header.column.getIsSorted();

    return (
        <S2_TableHeader
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
                            <S2_Button
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
                            </S2_Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-32">
                            <DropdownMenuLabel>Sort</DropdownMenuLabel>
                            <DropdownMenuSeparator />
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
                            <S2_Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground"
                            >
                                <FunnelIcon className="size-4" />
                            </S2_Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-32">
                            <DropdownMenuLabel>Filter</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {filterOptions.map((option) => {
                                const checked = (
                                    (header.column.getFilterValue() as string[]) ??
                                    []
                                ).includes(option);
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={option}
                                        checked={checked}
                                        onSelect={(ev) => {
                                            ev.preventDefault();
                                            if (checked)
                                                header.column.setFilterValue(
                                                    (
                                                        (header.column.getFilterValue() as string[]) ??
                                                        []
                                                    ).filter(
                                                        (v) => v !== option,
                                                    ),
                                                );
                                            else
                                                header.column.setFilterValue([
                                                    ...((header.column.getFilterValue() as string[]) ??
                                                        []),
                                                    option,
                                                ]);
                                        }}
                                    >
                                        {option}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </div>
        </S2_TableHeader>
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
        <S2_TableCell
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
        </S2_TableCell>
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
        <S2_Table
            slotProps={{
                container: {
                    className: "",
                },
            }}
        >
            <AkagiTableHead table={table} />
            <S2_TableBody>
                {table.getRowModel().rows.map((row) => (
                    <S2_TableRow key={`${row.id}`}>
                        {row.getVisibleCells().map((cell) => (
                            <Fragment key={cell.id}>
                                {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                )}
                            </Fragment>
                        ))}
                    </S2_TableRow>
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
            </S2_TableBody>
            {pagination && !isEmpty ? (
                <AkagiPagination tableId={tableId} table={table} />
            ) : null}
        </S2_Table>
    );
}

function AkagiTableHead<TData extends RowData>({
    className,
    table,
    ...props
}: ComponentProps<"thead"> & { table: TanstackTable<TData> }) {
    return (
        <S2_TableHead
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
        </S2_TableHead>
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
        <S2_TableFoot
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
                                <S2_Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!table.getCanPreviousPage()}
                                    onClick={() => table.previousPage()}
                                >
                                    <ChevronLeftIcon />{" "}
                                    <span className="hidden sm:block">
                                        Previous
                                    </span>
                                </S2_Button>

                                {/* Preceeding ellipsis. Shown if there are more than 2 preceeding pages. */}
                                {pageIndex > 1 ? (
                                    <div className="flex size-8 items-center justify-center">
                                        <EllipsisIcon className="size-4" />
                                    </div>
                                ) : null}

                                {/* Previous page number button. Shown if not the first page */}
                                {pageIndex > 0 ? (
                                    <S2_Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => table.previousPage()}
                                    >
                                        {pageIndex}
                                    </S2_Button>
                                ) : null}

                                {/* Current page number button. Disabled */}
                                <S2_Button
                                    variant="ghost"
                                    size="sm"
                                    className="border-1"
                                    disabled
                                >
                                    {pageIndex + 1}
                                </S2_Button>

                                {/* Next page number button. Shown if not the last page */}
                                {pageIndex + 1 < pageCount ? (
                                    <S2_Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => table.nextPage()}
                                    >
                                        {pageIndex + 2}
                                    </S2_Button>
                                ) : null}

                                {/* Succeeding ellipsis. Shown if there are more than 2 succeeding pages. */}
                                {pageIndex + 2 < pageCount && (
                                    <div className="flex size-8 items-center justify-center">
                                        <EllipsisIcon className="size-4" />
                                    </div>
                                )}

                                {/* Next Button. Disabled on last page */}
                                <S2_Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!table.getCanNextPage()}
                                    onClick={() => table.nextPage()}
                                >
                                    <span className="hidden sm:block">
                                        Next
                                    </span>{" "}
                                    <ChevronRightIcon />
                                </S2_Button>
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
                                <S2_Select
                                    value={pagination.pageSize.toString()}
                                    onValueChange={(value) => {
                                        table.setPageSize(Number(value));
                                    }}
                                >
                                    <S2_SelectTrigger
                                        className="w-20"
                                        id={`${tableId}-page-size`}
                                        size="sm"
                                    >
                                        <S2_SelectValue />
                                    </S2_SelectTrigger>
                                    <S2_SelectContent>
                                        {[10, 20, 50, 100, 200, 500].map(
                                            (size) => (
                                                <S2_SelectItem
                                                    key={size}
                                                    value={size.toString()}
                                                >
                                                    {size}
                                                </S2_SelectItem>
                                            ),
                                        )}
                                    </S2_SelectContent>
                                </S2_Select>
                            </div>
                        ) : null}
                    </div>
                </td>
            </tr>
        </S2_TableFoot>
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
    TableHeader: AkagiTableHeader,
    TableCell: AkagiTableCell,
    TableSearch: AkagiTableSearch,
    defineColumns,
};
