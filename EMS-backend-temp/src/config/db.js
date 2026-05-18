import { Pool } from 'pg';
import 'dotenv/config';

const useSsl = process.env.DB_SSL === 'true';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Add error listener
pool.on('error', (err) => {
    console.error('[DATABASE ERROR] Unexpected error on idle client', err);
});

export { pool };
export default pool;