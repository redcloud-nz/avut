/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { AlertIcons } from "./icons";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

export function UnderConstruction() {
    return (
        <Alert variant="underConstruction">
            <AlertIcons.UnderConstruction />
            <AlertTitle>Under Construction</AlertTitle>
            <AlertDescription>This feature is currently under construction.</AlertDescription>
        </Alert>
    );
}
