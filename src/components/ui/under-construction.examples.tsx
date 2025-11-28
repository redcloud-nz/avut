/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * UnderConstruction Component Usage Examples
 *
 * This file demonstrates various ways to use the UnderConstruction component.
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UnderConstruction } from "@/components/ui/under-construction";

// Example 1: Basic usage with a Card
export function Example1_BasicCard() {
    return (
        <div className="relative">
            <Card>
                <CardHeader>
                    <CardTitle>Feature Name</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>This content is under construction...</p>
                </CardContent>
            </Card>
            <UnderConstruction />
        </div>
    );
}

// Example 2: Custom message
export function Example2_CustomMessage() {
    return (
        <div className="relative">
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>New features coming soon...</p>
                </CardContent>
            </Card>
            <UnderConstruction message="Coming in Q1 2026" />
        </div>
    );
}

// Example 3: Without icon
export function Example3_NoIcon() {
    return (
        <div className="relative">
            <Card>
                <CardHeader>
                    <CardTitle>Maintenance</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Temporarily unavailable...</p>
                </CardContent>
            </Card>
            <UnderConstruction
                message="Scheduled Maintenance"
                showIcon={false}
            />
        </div>
    );
}

// Example 4: With any container (not just Card)
export function Example4_GenericContainer() {
    return (
        <div className="relative border rounded-lg p-4 bg-background">
            <h2 className="text-xl font-semibold mb-2">Dashboard Section</h2>
            <p>Dashboard content here...</p>
            <UnderConstruction message="New Dashboard In Development" />
        </div>
    );
}

// Example 5: Grid of cards with some under construction
export function Example5_GridExample() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Regular card */}
            <Card>
                <CardHeader>
                    <CardTitle>Active Feature</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>This feature is available.</p>
                </CardContent>
            </Card>

            {/* Card under construction */}
            <div className="relative">
                <Card>
                    <CardHeader>
                        <CardTitle>Beta Feature</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Being developed...</p>
                    </CardContent>
                </Card>
                <UnderConstruction message="Beta Testing" />
            </div>

            {/* Another card under construction */}
            <div className="relative">
                <Card>
                    <CardHeader>
                        <CardTitle>Future Feature</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Planned for next release...</p>
                    </CardContent>
                </Card>
                <UnderConstruction />
            </div>
        </div>
    );
}

// Example 6: Conditional rendering
export function Example6_ConditionalRendering({
    isComplete,
}: {
    isComplete: boolean;
}) {
    return (
        <div className="relative">
            <Card>
                <CardHeader>
                    <CardTitle>Dynamic Feature</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>This feature status changes dynamically.</p>
                </CardContent>
            </Card>
            {!isComplete && <UnderConstruction />}
        </div>
    );
}
