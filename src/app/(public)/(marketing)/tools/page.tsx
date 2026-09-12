/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /tools
 */

import { TOOLS_CONTENT, type ToolStatus } from "@/components/marketing/tools-content";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tools" };

const STATUS_LABEL: Record<ToolStatus, string> = {
    available: "",
    "in-development": "In Development",
    planned: "Planned",
};

const STATUS_CLASSNAME: Record<ToolStatus, string> = {
    available: "",
    "in-development": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    planned: "border border-dashed border-muted-foreground/40 text-muted-foreground bg-transparent",
};

function StatusBadge({ status }: { status: ToolStatus }) {
    if (status === "available") return null;
    return (
        <span
            className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                STATUS_CLASSNAME[status],
            )}
        >
            {STATUS_LABEL[status]}
        </span>
    );
}

export default function ToolsPage() {
    return (
        <>
            <div className="border-b border-border bg-muted/40">
                <div className="mx-auto max-w-[1120px] px-6 py-12 md:px-10 md:py-16">
                    <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        The tools
                    </div>
                    <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight text-pretty md:text-5xl">
                        Everything AVUT does, module by module.
                    </h1>
                    <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-muted-foreground text-pretty">
                        Every module is scoped to an organisation. Some are shipped and in daily
                        use; a couple are still being built, and one is only an idea so far — each
                        section below says which.
                    </p>
                </div>
            </div>

            <div className="mx-auto flex max-w-[1120px] flex-col divide-y divide-border px-6 md:px-10">
                {TOOLS_CONTENT.map((section) => {
                    const Icon = section.icon;
                    return (
                        <section key={section.id} className="flex flex-col gap-5 py-12">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <Icon className="size-5 shrink-0 opacity-75" />
                                    <h2 className="text-2xl font-semibold tracking-tight">
                                        {section.label}
                                    </h2>
                                    <StatusBadge status={section.status} />
                                </div>
                                <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
                                    {section.description}
                                </p>
                            </div>

                            {section.tools && (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {section.tools.map((tool) => (
                                        <div
                                            key={tool.name}
                                            className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-[18px]"
                                        >
                                            <span className="text-[15px] font-medium">
                                                {tool.name}
                                            </span>
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                {tool.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>

            <div className="h-8" />
        </>
    );
}
