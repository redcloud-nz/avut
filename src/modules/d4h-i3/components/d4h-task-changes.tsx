/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { D4HTask } from "@/lib/schemas/d4h-task";

/** One field to change in D4H's edit form, named as D4H labels it. */
type D4HTaskChange = { field: string; value: string };

/** The changes to make by hand in D4H to apply a task. */
function d4hTaskChanges(task: D4HTask): D4HTaskChange[] {
    switch (task.kind) {
        case "Retire":
            return [
                { field: "Status", value: "Retired" },
                { field: "Retired Reason", value: task.payload.reason },
                { field: "Location", value: "No Location" },
            ];
    }
}

/**
 * A task's changes as a bulleted list of "Set <field> to <value>", with the field and value
 * set apart from the instruction text, followed by the task's note (e.g. who received a returned
 * item) when it has one.
 */
export function D4HI3Module_D4HTaskChanges({ task }: { task: D4HTask }) {
    return (
        <div className="space-y-1">
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {d4hTaskChanges(task).map(({ field, value }) => (
                    <li key={field}>
                        Set <span className="font-semibold">{field}</span> to{" "}
                        <span className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                            {value}
                        </span>
                    </li>
                ))}
            </ul>
            {task.payload.note ? (
                <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Note:</span> {task.payload.note}
                </p>
            ) : null}
        </div>
    );
}
