/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

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
import Link from "next/link";

export default function Root_NotFound() {
    return (
        <div className="w-full h-screen flex flex-col justify-center md:items-center gap-4">
            <Empty>
                <EmptyHeader>
                    <EmptyMedia>
                        <Artie pose="NotFound" />
                    </EmptyMedia>
                    <EmptyTitle>404 - Not Found</EmptyTitle>
                    <EmptyDescription>
                        The resource you requested was not found. Have you tried looking under the
                        couch?
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" asChild>
                        <Link href="/">Home Page</Link>
                    </Button>
                </EmptyContent>
            </Empty>
        </div>
    );
}
