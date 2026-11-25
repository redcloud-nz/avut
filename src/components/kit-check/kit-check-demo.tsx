/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { KitCheckResponse } from "@/lib/kit-check-types";

import { demoHeldItems, demoProposals, demoSubject, demoTemplates } from "./kit-check-demo-data";
import { KitCheck_Form } from "./kit-check-form";
import { KitCheck_Summary } from "./kit-check-summary";

/** The kit-check member form over sample data: nothing is saved or sent. */
export function KitCheck_Demo() {
    const [response, setResponse] = useState<KitCheckResponse | null>(null);
    const [formKey, setFormKey] = useState(0);

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
            <Alert variant="info">
                <AlertTitle>Demonstration</AlertTitle>
                <AlertDescription>
                    This is the form each member would get by email, filled with made-up data.
                    Nothing you enter here is saved or sent.
                </AlertDescription>
            </Alert>
            {response ? (
                <KitCheck_Summary
                    templates={demoTemplates}
                    heldItems={demoHeldItems}
                    proposals={demoProposals}
                    response={response}
                    onRestart={() => {
                        setResponse(null);
                        setFormKey((key) => key + 1);
                        window.scrollTo({ top: 0 });
                    }}
                />
            ) : (
                <KitCheck_Form
                    key={formKey}
                    subject={demoSubject}
                    templates={demoTemplates}
                    heldItems={demoHeldItems}
                    proposals={demoProposals}
                    onSubmit={(submitted) => {
                        setResponse(submitted);
                        window.scrollTo({ top: 0 });
                    }}
                />
            )}
        </div>
    );
}
