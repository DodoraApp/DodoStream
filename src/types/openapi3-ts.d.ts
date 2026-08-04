/**
 * The vendored `trakt-api` package (Deno monorepo source, deep-imported for
 * types) calls `.openapi({ mediaExamples: [...] })` on a few rating schemas.
 * `mediaExamples` is not part of openapi3-ts v4's `SchemaObject`, which
 * `@anatine/zod-openapi` (peer `openapi3-ts@^4.1.2`) types against, so those
 * metadata objects fail excess-property checks. The metadata is OpenAPI-doc
 * only and never consumed at runtime, so we add a lenient `openapi` overload
 * to zod's `ZodType`. The app itself never calls `.openapi`, so this only
 * affects the vendored package's source.
 */
export {};

declare module 'zod' {
  interface ZodType {
    openapi<T>(this: T, metadata: Record<string, unknown>): T;
  }
}
