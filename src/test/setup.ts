/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

// This file is required by vitest.config.ts and is loaded before the test framework is installed in the environment.
// You can use this file to set up any global configuration or behavior that modifies the testing environment.

import "@testing-library/jest-dom/vitest";

// Radix primitives (DropdownMenu, Select, ...) call these during pointer interactions;
// jsdom doesn't implement them, so component tests that open such menus need stubs.
if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}
