/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ForwardedRef } from "react";

import {
    headingsPlugin,
    listsPlugin,
    quotePlugin,
    markdownShortcutPlugin,
    linkPlugin,
    tablePlugin,
    toolbarPlugin,
    Separator,
    MDXEditor,
    type MDXEditorMethods,
    type MDXEditorProps,
    linkDialogPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import "./markdown.css";

import { cn } from "@/lib/utils";

import {
    CreateLinkButton,
    FormatTextToggleGroup,
    InsertTableButton,
    ListStyleToggleGroup,
} from "./toolbar";

export default function InitializedMDXEditor({
    contentEditableClassName,
    editorRef,
    ...props
}: { editorRef: ForwardedRef<MDXEditorMethods> | null } & MDXEditorProps) {
    return (
        <MDXEditor
            contentEditableClassName={cn(
                "markdown-content min-h-16 overflow-y-auto",
                contentEditableClassName,
            )}
            plugins={[
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                markdownShortcutPlugin(),
                linkPlugin(),
                linkDialogPlugin(),
                // imagePlugin(),
                tablePlugin(),
                toolbarPlugin({
                    toolbarPosition: "bottom",
                    toolbarContents: () => (
                        <>
                            <FormatTextToggleGroup options={["bold", "italic", "underline"]} />
                            <Separator />
                            <ListStyleToggleGroup />
                            <Separator />
                            <CreateLinkButton />
                            {/* <InsertImage /> */}
                            {/* <Separator /> */}
                            <InsertTableButton />
                        </>
                    ),
                }),
                markdownShortcutPlugin(),
            ]}
            {...props}
            ref={editorRef}
        />
    );
}
