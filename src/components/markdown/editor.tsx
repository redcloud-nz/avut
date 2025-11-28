/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import dynamic from "next/dynamic";
import { forwardRef } from "react";

import { type MDXEditorMethods, type MDXEditorProps } from "@mdxeditor/editor";

// This is the only place InitializedMDXEditor is imported directly.
const InitializedMDXEditor = dynamic(() => import("./initialized-mdx-editor"), {
    ssr: false,
});

export const MarkdownEditor = forwardRef<MDXEditorMethods, MDXEditorProps>(
    (props, ref) => <InitializedMDXEditor {...props} editorRef={ref} />,
);
MarkdownEditor.displayName = "MarkdownEditor";
