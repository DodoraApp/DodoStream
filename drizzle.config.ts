import type { Config } from 'drizzle-kit';

export default {
    schema: './src/db/schema.ts',
    out: './src/db/drizzle',
    dialect: 'sqlite',
    strict: true,
} satisfies Config;
