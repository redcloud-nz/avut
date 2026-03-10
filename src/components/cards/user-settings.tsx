/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertIcons } from "../icons";

export function UserSettings_Card() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>User Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="underConstruction">
                    <AlertIcons.UnderConstruction />
                    <AlertTitle>Under Construction</AlertTitle>
                    <AlertDescription>
                        This feature is currently in development.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
}
