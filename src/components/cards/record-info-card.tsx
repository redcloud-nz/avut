/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";

/**
 * The record's own bookkeeping, at the top of a detail page's secondary column: its ID (mono),
 * then any `children` rows, then Created and Updated. Every prop is optional; a row whose value is
 * missing is left out.
 *
 * `children` are extra `DataItem` rows (e.g. the ID of something attached to the record that has
 * no card of its own). They must be `DataItem`s or fragments of them, because rows have to be
 * direct children of the `DataList`.
 *
 * Server-safe: `DataItemDateValue` is the only client piece, and it is its own island.
 */
export function RecordInfo_Card({
    id,
    idLabel = "ID",
    createdAt,
    updatedAt,
    children,
}: {
    id?: string;
    idLabel?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    children?: ReactNode;
}) {
    return (
        <Card>
            <CardContent>
                <DataList>
                    {id && (
                        <DataItem inline>
                            <DataItemTitle>{idLabel}</DataItemTitle>
                            <DataItemValue className="font-mono">{id}</DataItemValue>
                        </DataItem>
                    )}
                    {children}
                    {createdAt && (
                        <DataItem inline>
                            <DataItemTitle>Created</DataItemTitle>
                            <DataItemDateValue date={createdAt} />
                        </DataItem>
                    )}
                    {updatedAt && (
                        <DataItem inline>
                            <DataItemTitle>Updated</DataItemTitle>
                            <DataItemDateValue date={updatedAt} />
                        </DataItem>
                    )}
                </DataList>
            </CardContent>
        </Card>
    );
}
