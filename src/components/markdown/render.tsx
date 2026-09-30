/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { type ComponentProps } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import "./markdown.css";

/**
 * `rehype-raw` stays because the editor's underline button saves `<u>` as raw HTML. Everything raw
 * HTML lets through is then sanitized: GitHub's default schema, which already covers GFM output
 * (table `align`, task-list checkboxes, footnotes), plus `u`.
 */
const sanitizeSchema: SanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), "u"],
};

interface RenderMarkdownProps extends Omit<ComponentProps<"div">, "children"> {
    markdown: string;
}

export function RenderMarkdown({ className, markdown, ...props }: RenderMarkdownProps) {
    return (
        <div className={cn("markdown-content", className)} {...props}>
            <Markdown
                remarkPlugins={[remarkGfm, remarkBreaks, remarkDirective]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
            >
                {markdown}
            </Markdown>
        </div>
    );
}
