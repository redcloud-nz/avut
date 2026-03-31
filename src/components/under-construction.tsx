/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { useTranslations } from "next-intl";

import { AlertIcons } from "./icons";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert2";

export function UnderConstruction() {
    const t = useTranslations("UnderConstruction");

    return (
        <Alert variant="underConstruction">
            <AlertIcons.UnderConstruction />
            <AlertTitle>{t("title")}</AlertTitle>
            <AlertDescription>{t("description")}</AlertDescription>
        </Alert>
    );
}
