import 'dotenv/config';
export default { schema: './src/schema.js', out: './drizzle', dialect: 'sqlite', dbCredentials: { url: process.env.DATABASE_PATH || './data/verdant.db' } };
