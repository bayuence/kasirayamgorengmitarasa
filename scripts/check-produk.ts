import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function check() {
  const { data: kategoris } = await supabase.from('kategori').select('*').order('urutan');
  console.log('Kategoris:', kategoris);

  const { data: produks } = await supabase.from('produk').select('*').order('urutan');
  console.log('Produks:', produks);
}

check();

