/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /personal/profile
 */

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

import * as Paths from "@/paths";
import { auth } from "@/server/auth";
import { FieldValue } from "@/components/ui/field-value";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/datetime";

export default async function Personal_Profile_Page() {
    const headers = await nextHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) redirect(Paths.auth.signIn().href);

    const accounts = await auth.api.listUserAccounts({ headers });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[Paths.personal.index, Paths.personal.profile]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.Title>Profile</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>User Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>User ID</FieldLabel>
                                    <FieldValue
                                        value={session.user.id}
                                        format="id"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Email</FieldLabel>
                                    <FieldValue
                                        value={session.user.email || "No email"}
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Created At</FieldLabel>
                                    <FieldValue
                                        value={session.user.createdAt}
                                        format="dateTimeWithDistance"
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Linked Accounts</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeadCell>
                                            Account ID
                                        </TableHeadCell>
                                        <TableHeadCell>Provider</TableHeadCell>
                                        <TableHeadCell>
                                            Created At
                                        </TableHeadCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accounts.map((account) => (
                                        <TableRow key={account.id}>
                                            <TableCell>{account.id}</TableCell>
                                            <TableCell>
                                                {account.providerId}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(account.createdAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
