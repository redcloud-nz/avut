/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /i3/[slug]
 */
"use client";

import { useEffect } from "react";

import Artie from "@/components/art/artie";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@/components/ui/link";
import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";

export default function I3_Error({
    error,
}: { error: Error } & { digest?: string }) {
    useEffect(() => {
        console.error("Error occurred:", error);
    }, [error]);

    const organization = useOrganization();

    return (
        <div className="w-full h-screen flex flex-col justify-center md:items-center gap-4">
            <Empty>
                <EmptyHeader>
                    <EmptyMedia>
                        <Artie pose="Error" />
                    </EmptyMedia>
                    <EmptyTitle>{error.name}</EmptyTitle>
                    <EmptyDescription>
                        {error.message || "An unexpected error occurred."}
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" asChild>
                        <Link to={Paths.main(organization.slug).index}>
                            Dashboard
                        </Link>
                    </Button>
                </EmptyContent>
            </Empty>
        </div>
    );
}
