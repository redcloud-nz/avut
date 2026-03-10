/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /personal/profile
 */

import { headers as nextHeaders } from "next/headers";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { formatDate } from "@/lib/datetime";
import { auth } from "@/server/auth";

export async function UserLinkedAccounts_Card() {
    const headers = await nextHeaders();
    const accounts = await auth.api.listUserAccounts({ headers });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Linked Accounts</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeadCell>Account ID</TableHeadCell>
                            <TableHeadCell>Provider</TableHeadCell>
                            <TableHeadCell>Created</TableHeadCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accounts.map((account) => (
                            <TableRow key={account.id}>
                                <TableCell>{account.id}</TableCell>
                                <TableCell>{account.providerId}</TableCell>
                                <TableCell>
                                    {formatDate(account.createdAt)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
