"use client";

import { Argus } from "@/components/blocks/argus";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Tmpl } from "@/lib/tmpl";
import { useState } from "react";

const testData = {
    categoryTitle: "Test Category",
    kindTitle: "Test Kind",
    memberRef: "#16",
    teamPrefix: "NZRT11",
};

export default function DevTmlpTestPage() {
    const [inputValue, setInputValue] = useState("");

    const isValid = Tmpl.validate(inputValue, testData);
    const output = Tmpl.renderSafe(inputValue, testData);

    return (
        <Argus.Root>
            <Argus.Column>
                <div className="border p-2 flex flex-col gap-2">
                    <div className="text-center font-semibold">Tmpl Test</div>
                    <FieldGroup>
                        <Field data-invalid={!isValid} orientation="responsive">
                            <FieldLabel>Input</FieldLabel>
                            <Input
                                placeholder="Test Input"
                                aria-invalid={!isValid}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Output</FieldLabel>
                            <FieldValue value={output.data ?? output.error} />
                        </Field>
                    </FieldGroup>
                </div>
            </Argus.Column>
        </Argus.Root>
    );
}
