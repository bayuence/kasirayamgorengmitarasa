import { config } from 'dotenv';
config({ path: '.env.local' });

const PAT = process.env.SUPABASE_ACCESS_TOKEN || '';
const PROJECT_REF = 'dgnpcutgnmrsyjaspgwj';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function main() {
  console.log('Menghapus semua data dummy outlet dari Supabase...');

  const sql = `
    DELETE FROM harga_produk_outlet;
    DELETE FROM harga_tambahan_outlet;
    DELETE FROM outlet;
  `;

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAT}` },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  console.log('Hasil hapus Supabase:', res.status, text);
}

main().catch(console.error);

