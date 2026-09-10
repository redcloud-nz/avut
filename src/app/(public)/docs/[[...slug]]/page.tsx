/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/[[...slug]]
 *
 * Renders one documentation page from the compiled `docs` content collection.
 * The same MDX is reused by the in-app `?help=<slug>` dialog.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXContent } from "@content-collections/mdx/react";

import { docsMdxComponents } from "@/components/docs/mdx-components";
import { getAllDocSlugs, getDocBySlug } from "@/lib/docs";

interface DocsPageProps {
    params: Promise<{ slug?: string[] }>;
}

export function generateStaticParams(): { slug: string[] }[] {
    return getAllDocSlugs().map((slug) => ({ slug: slug === "" ? [] : slug.split("/") }));
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
    const { slug } = await params;
    const doc = getDocBySlug((slug ?? []).join("/"));
    if (!doc) return {};
    return { title: `${doc.title} — Docs`, description: doc.description };
}

export default async function DocsPage({ params }: DocsPageProps) {
    const { slug } = await params;
    const doc = getDocBySlug((slug ?? []).join("/"));
    if (!doc) notFound();

    return (
        <article>
            <MDXContent code={doc.mdx} components={docsMdxComponents} />
        </article>
    );
}
