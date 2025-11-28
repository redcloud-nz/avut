/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    ArrowDownAZIcon,
    ArrowDownZAIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    EllipsisVerticalIcon,
    EyeOffIcon,
    GroupIcon,
    ListRestartIcon,
    SettingsIcon,
    UngroupIcon,
} from "lucide-react";
import React, { ComponentProps, ReactNode } from "react";
import { match } from "ts-pattern";

import {
    CellContext,
    Column,
    ColumnDef,
    ColumnHelper,
    createColumnHelper,
    flexRender,
    Row,
    RowData,
    Table as TanstackTable,
} from "@tanstack/react-table";

import { Show } from "@/components/show";
import { cn } from "@/lib/utils";

import { Button } from "./button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupLabel,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./select";
import { Table, TableBody, TableCell, TableHead, TableRow } from "./table";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DataTableContext = React.createContext<TanstackTable<any> | null>(null);

export const DataTableProvider = DataTableContext.Provider;
const useDataTable = () => {
    const table = React.useContext(DataTableContext);
    if (table == null)
        throw new Error("useDataTable called outside of provider.");
    return table;
};

export const DataTable = Table;

export function DataTableHead(
    props: Omit<ComponentProps<typeof TableHead>, "children">,
) {
    const table = useDataTable();
    return (
        <thead {...props}>
            {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="divide-x divide-x-gray-400">
                    {headerGroup.headers.map((header) => (
                        <ColumnHeader key={header.id} column={header.column}>
                            {header.isPlaceholder
                                ? null
                                : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                  )}
                        </ColumnHeader>
                    ))}
                </tr>
            ))}
            <tr>
                <td
                    className="h-1"
                    colSpan={table.getVisibleFlatColumns().length}
                />
            </tr>
        </thead>
    );
}

type ColumnHeaderProps<T> = {
    children: ReactNode;
    // eslint-disable-next-line
    column: Column<T, any>;
};

export function ColumnHeader<T>({ children, column }: ColumnHeaderProps<T>) {
    const table = useDataTable();

    const enumOptions = column.columnDef.meta?.enumOptions;
    const filterValue = (column.getFilterValue() as string[]) ?? [];

    const slotProps = column.columnDef.meta?.slotProps ?? {};
    const thProps = slotProps.th ?? {};

    const showMenu =
        column.getCanSort() ||
        !!enumOptions ||
        column.getCanHide() ||
        column.getCanGroup();

    function handleHideColumn() {
        column.toggleVisibility();
    }

    return (
        <th
            {...thProps}
            className={cn(
                "pl-2 text-left align-middle font-medium",
                thProps.className,
            )}
        >
            <div className={"w-full flex items-center justify-between gap-2"}>
                <div data-slot="name">{children}</div>

                {(column.getIsSorted() || showMenu) && (
                    <div className="flex items-center">
                        {match(column.getIsSorted())
                            .with(false, () => null)
                            .with("asc", () => (
                                <ArrowDownAZIcon className="w-4 h-4 stroke-muted-foreground" />
                            ))
                            .with("desc", () => (
                                <ArrowDownZAIcon className="w-4 h-4 text-muted-foreground" />
                            ))
                            .exhaustive()}
                        {showMenu && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <EllipsisVerticalIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-56"
                                    align="end"
                                >
                                    <DropdownMenuLabel className="text-center">
                                        Column Options
                                    </DropdownMenuLabel>
                                    {column.getCanSort() && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuGroupLabel>
                                                    Sort
                                                </DropdownMenuGroupLabel>
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        column.toggleSorting()
                                                    }
                                                >
                                                    <ArrowDownAZIcon />
                                                    <span>Ascending</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        column.toggleSorting(
                                                            true,
                                                        )
                                                    }
                                                >
                                                    <ArrowDownZAIcon />
                                                    <span>Descending</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                        </>
                                    )}
                                    {enumOptions && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuGroupLabel>
                                                    Show
                                                </DropdownMenuGroupLabel>
                                                {Object.keys(enumOptions).map(
                                                    (key) => (
                                                        <DropdownMenuCheckboxItem
                                                            key={key}
                                                            checked={filterValue.includes(
                                                                key,
                                                            )}
                                                            onCheckedChange={(
                                                                checked,
                                                            ) => {
                                                                if (checked)
                                                                    column.setFilterValue(
                                                                        [
                                                                            ...filterValue,
                                                                            key,
                                                                        ],
                                                                    );
                                                                else
                                                                    column.setFilterValue(
                                                                        filterValue.filter(
                                                                            (
                                                                                x,
                                                                            ) =>
                                                                                x !=
                                                                                key,
                                                                        ),
                                                                    );
                                                            }}
                                                        >
                                                            <span>
                                                                {
                                                                    enumOptions[
                                                                        key
                                                                    ]
                                                                }
                                                            </span>
                                                        </DropdownMenuCheckboxItem>
                                                    ),
                                                )}
                                            </DropdownMenuGroup>
                                        </>
                                    )}
                                    {(column.getCanHide() ||
                                        column.getCanGroup()) && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                {column.getCanGroup() && (
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            table.setGrouping(
                                                                column.getIsGrouped()
                                                                    ? []
                                                                    : [
                                                                          column.id,
                                                                      ],
                                                            )
                                                        }
                                                    >
                                                        {column.getIsGrouped() ? (
                                                            <UngroupIcon data-slot="icon" />
                                                        ) : (
                                                            <GroupIcon data-slot="icon" />
                                                        )}
                                                        <span>
                                                            {column.getIsGrouped()
                                                                ? "Ungroup by"
                                                                : "Group by"}
                                                        </span>
                                                    </DropdownMenuItem>
                                                )}
                                                {column.getCanHide() && (
                                                    <DropdownMenuItem
                                                        onClick={
                                                            handleHideColumn
                                                        }
                                                    >
                                                        <EyeOffIcon />
                                                        <span>Hide Column</span>
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuGroup>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                )}
            </div>
        </th>
    );
}

export function DataTableBody(
    props: Omit<ComponentProps<typeof TableBody>, "children">,
) {
    const table = useDataTable();

    // Check if we have editing state and are in Create mode
    const editingState = table.getState().editing;
    const isCreating =
        editingState?.mode === "Create" && editingState.modifiedRowData;

    return (
        <TableBody {...props}>
            {/* Render placeholder row for Create mode */}
            {isCreating && (
                <TableRow key="__creating__" className="bg-muted/30">
                    {table.getVisibleFlatColumns().map((column) => {
                        const columnDef = column.columnDef;
                        const cellValue =
                            editingState.modifiedRowData?.[
                                column.id as keyof typeof editingState.modifiedRowData
                            ];

                        // Create a synthetic row object for the placeholder
                        const syntheticRow = {
                            id: "__creating__",
                            original: editingState.modifiedRowData,
                            getEditMode: () => "Create" as const,
                            getModifiedRowData: () =>
                                editingState.modifiedRowData,
                            setModifiedRowData: (
                                data: Partial<
                                    typeof editingState.modifiedRowData
                                >,
                            ) => {
                                const updatedData = {
                                    ...editingState.modifiedRowData,
                                    ...data,
                                };
                                table.setEditingState({
                                    ...editingState,
                                    modifiedRowData: updatedData,
                                });
                            },
                            startEdit: () => {},
                            cancelEdit: () => {
                                table.setEditingState({
                                    mode: "View",
                                    rowId: undefined,
                                    modifiedRowData: undefined,
                                });
                            },
                            saveEdit: () => {
                                if (editingState.modifiedRowData) {
                                    table.options.onCreate?.(
                                        editingState.modifiedRowData,
                                    );
                                }
                                table.setEditingState({
                                    mode: "View",
                                    rowId: undefined,
                                    modifiedRowData: undefined,
                                });
                            },
                            delete: () => {},
                        } as Row<typeof editingState.modifiedRowData>;

                        // Create a synthetic cell context
                        const cellContext = {
                            getValue: () => cellValue,
                            renderValue: () => cellValue,
                            row: syntheticRow,
                            column,
                            cell: {
                                id: `__creating__:${column.id}`,
                                getValue: () => cellValue,
                                renderValue: () => cellValue,
                                row: syntheticRow,
                                column,
                            },
                            table,
                        } as CellContext<
                            typeof editingState.modifiedRowData,
                            (typeof editingState.modifiedRowData)[keyof typeof editingState.modifiedRowData]
                        >;

                        return (
                            <TableCell
                                key={`creating-${column.id}`}
                                align={columnDef.meta?.align}
                            >
                                {flexRender(columnDef.cell, cellContext)}
                            </TableCell>
                        );
                    })}
                </TableRow>
            )}
            {table.getRowModel().rows.map((row) => {
                return (
                    <TableRow key={row.id}>
                        {/* { enableRowSelection
                    ? <TableCell className="pl-4 leading-4">
                        <Checkbox
                            color="zinc"
                            checked={(row.getIsAllSubRowsSelected() || row.getIsSelected()) ? true : row.getIsSomeSelected() ? 'indeterminate' : false }
                            disabled={!row.getCanSelect()}
                            onCheckedChange={row.getToggleSelectedHandler()}
                        />
                    </TableCell>
                    : null
                } */}
                        {row.getVisibleCells().map((cell) => {
                            const columnDef = cell.column.columnDef;

                            if (cell.getIsGrouped()) {
                                return (
                                    <td
                                        key={cell.id}
                                        colSpan={
                                            table.getVisibleFlatColumns().length
                                        }
                                        className="pl-2"
                                    >
                                        <div
                                            className={cn(
                                                "flex items-center",
                                                "font-semibold",
                                            )}
                                        >
                                            {cell.getValue() == "" ? (
                                                <span className="italic">
                                                    EMPTY
                                                </span>
                                            ) : (
                                                flexRender(
                                                    columnDef.cell,
                                                    cell.getContext(),
                                                )
                                            )}
                                            <div className="grow" />

                                            <div>( {row.subRows.length} )</div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="ml-2"
                                                onClick={() =>
                                                    row.toggleExpanded()
                                                }
                                            >
                                                <ChevronDownIcon />
                                            </Button>
                                        </div>
                                    </td>
                                );
                            } else if (cell.getIsAggregated()) {
                                return null;
                            } else if (cell.getIsPlaceholder()) {
                                return (
                                    <TableCell
                                        key={`placeholder-${columnDef.id}`}
                                    />
                                );
                            } else {
                                return (
                                    <TableCell
                                        key={cell.id}
                                        align={columnDef.meta?.align}
                                    >
                                        {flexRender(
                                            columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </TableCell>
                                );
                            }
                        })}
                    </TableRow>
                );
            })}
        </TableBody>
    );
}

export function DataTableSearch({
    placeholder,
    ...props
}: Omit<ComponentProps<typeof Input>, "onChange" | "value">) {
    const table = useDataTable();

    return (
        <Input
            placeholder={placeholder ?? "Search ..."}
            value={table.getState().globalFilter}
            onChange={(ev) => table.setGlobalFilter(String(ev.target.value))}
            {...props}
        />
    );
}

export function TableOptionsDropdown() {
    const table = useDataTable();

    const groupableColumns = table
        .getAllColumns()
        .filter((column) => column.getCanGroup());

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <SettingsIcon />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>

                <TooltipContent>Table Options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-center">
                    Table Options
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuGroupLabel>
                        Show columns
                    </DropdownMenuGroupLabel>
                    {table.getAllColumns().map((column) => (
                        <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={column.getIsVisible()}
                            onCheckedChange={() => column.toggleVisibility()}
                            disabled={!column.getCanHide()}
                        >
                            {column.columnDef.header as string}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
                <Show when={groupableColumns.length > 0}>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuGroupLabel>
                            Group by
                        </DropdownMenuGroupLabel>
                        {groupableColumns.map((column) => (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                checked={column.getIsGrouped()}
                                onCheckedChange={() =>
                                    table.setGrouping(
                                        column.getIsGrouped()
                                            ? []
                                            : [column.id],
                                    )
                                }
                            >
                                {column.columnDef.header as string}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuGroup>
                </Show>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => table.reset()}>
                        <ListRestartIcon />
                        <span>Reset Table</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

type DataTableFooterProps = {
    variant?: "pagination" | "simple";
};

export function DataTableFooter({ variant = "simple" }: DataTableFooterProps) {
    const table = useDataTable();

    const pagination = table.getState().pagination;
    const rowCount = table.getRowCount();
    const startRowIndex = pagination.pageIndex * pagination.pageSize;

    return (
        <tfoot>
            <tr>
                <td colSpan={table.getVisibleFlatColumns().length}>
                    {match(variant)
                        .with("pagination", () => (
                            <div className="grid grid-cols-3 items-center text-sm text-muted-foreground pt-1">
                                <RowCount
                                    start={startRowIndex + 1}
                                    end={Math.min(
                                        startRowIndex + pagination.pageSize,
                                        rowCount,
                                    )}
                                    total={rowCount}
                                />
                                <div className="flex items-center justify-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={!table.getCanPreviousPage()}
                                        onClick={() => table.previousPage()}
                                    >
                                        <ChevronLeftIcon />
                                    </Button>
                                    <div className="space-x-1 lg:space-x-1.5">
                                        <span className="hidden mg:inline">
                                            Page
                                        </span>
                                        <span>{pagination.pageIndex + 1}</span>
                                        <span>of</span>
                                        <span>
                                            {Math.max(1, table.getPageCount())}
                                        </span>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={!table.getCanNextPage()}
                                        onClick={() => table.nextPage()}
                                    >
                                        <ChevronRightIcon />
                                    </Button>
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <div className="space-x-1">
                                        <span className="hidden lg:inline">
                                            rows
                                        </span>
                                        <span>per page</span>
                                    </div>
                                    <Select
                                        value={pagination.pageSize.toString()}
                                        onValueChange={(value) =>
                                            table.setPageSize(Number(value))
                                        }
                                    >
                                        <SelectTrigger
                                            className="w-16"
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
                            </div>
                        ))
                        .with("simple", () => (
                            <div className="pt-3 pb-2 flex items-center text-sm justify-center text-muted-foreground">
                                {rowCount == 0 ? (
                                    <span>No rows to display.</span>
                                ) : rowCount == 1 ? (
                                    <span>1 row</span>
                                ) : (
                                    <span>{rowCount} rows</span>
                                )}
                            </div>
                        ))
                        .exhaustive()}
                </td>
            </tr>
        </tfoot>
    );
}

function RowCount({
    start,
    end,
    total,
}: {
    start: number;
    end: number;
    total: number;
}) {
    if (total == 0) return <div className="pl-2">No rows to display.</div>;

    return (
        <div className="space-x-1 lg:space-x-1.5 pl-2">
            <span className="hidden lg:inline">
                {total > 1 ? "rows" : "row"}
            </span>
            <span>{total > 1 ? `${start}-${end}` : "1"}</span>
            <span>of</span>
            <span>{total}</span>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineColumns<TData extends RowData>(
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
