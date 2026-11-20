/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Kaga's plain constants, kept out of `kaga.tsx` so server code (e.g. a page's search-param
 * loader) can read them without pulling the client-only table components into the server graph.
 */

/** Rows per page of a Kaga table. Also exposed as `Kaga.DEFAULT_PAGE_SIZE`. */
export const KAGA_DEFAULT_PAGE_SIZE = 50;
