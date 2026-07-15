import "@tanstack/react-table";

declare module "@tanstack/react-table" {
    interface ColumnMeta<TData extends RowData, TValue> {
        readonly columnName?: string;

        readonly headerProps?: Omit<ComponentProps<"th">, "children">;
        readonly cellProps?: Omit<ComponentProps<"td">, "children">;

        /**
         * For filterable columns, an optional list of options to show in the filter dropdown.
         */
        readonly columnOptions?: ReadonlyArray<{ readonly label: string; readonly value: TValue }>;
    }
}
