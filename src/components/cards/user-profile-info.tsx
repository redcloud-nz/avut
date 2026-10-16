/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { requireSession } from "@/server/session";

export async function UserProfileInfo_Card() {
    const session = await requireSession();

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent>
                <DataList>
                    <DataItem inline>
                        <DataItemTitle>User ID</DataItemTitle>
                        <DataItemValue className="font-mono">{session.user.id}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Name</DataItemTitle>
                        <DataItemValue>{session.user.name}</DataItemValue>
                    </DataItem>
                    <DataItem>
                        <DataItemTitle>Email</DataItemTitle>
                        <DataItemValue>{session.user.email || "No email"}</DataItemValue>
                    </DataItem>
                </DataList>
            </CardContent>
        </Card>
    );
}
