import "@tanstack/react-table";

declare module "@tanstack/react-table" {
    interface ColumnMeta<TData extends RowData, TValue> {
        columnName?: string;

        headerProps?: Omit<ComponentProps<"th">, "children">;
        cellProps?: Omit<ComponentProps<"td">, "children">;

        /**
         * For filterable columns, an optional list of options to show in the filter dropdown.
         */
        columnOptions?: { label: string; value: TValue }[];
    }
}
