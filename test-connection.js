import pg from 'pg';
const { Client } = pg;

const config = {
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres',
  password: 'E9zPE6!6LXL2qk:',
  ssl: {
    rejectUnauthorized: false
  }
};

async function test() {
  const client = new Client(config);
  try {
    await client.connect();
    console.log('Connected successfully');
    const res = await client.query('SELECT 1');
    console.log('Query result:', res.rows);
    await client.end();
    console.log('Connection closed');
  } catch (err) {
    console.error('Connection error:', err.message);
  }
}

test();