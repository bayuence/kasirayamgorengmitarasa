const SUPABASE_URL = 'https://dgnpcutgnmrsyjaspgwj.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnbnBjdXRnbm1yc3lqYXNwZ3dqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDEzMDExOSwiZXhwIjoyMTA5NzA2MTE5fQ.cWuxFPCGH7Cwl67-CdhabAwxclrV9W62lH86fosfmGE';

async function main() {
  // Buat user kasir@mitarasa.com
  console.log('Membuat user kasir@mitarasa.com...');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
    },
    body: JSON.stringify({
      email: 'kasir@mitarasa.com',
      password: 'admin354',
      email_confirm: true,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Gagal buat user:', JSON.stringify(data));
    process.exit(1);
  }

  const userId = data.id;
  console.log('User dibuat. ID:', userId);

  // Insert profil owner
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/profil`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: userId, nama: 'Owner Mitarasa', peran: 'owner' }),
  });

  if (res2.ok || res2.status === 201) {
    console.log('Profil owner berhasil!');
  } else {
    const err = await res2.text();
    console.error('Gagal insert profil:', err);
  }

  console.log('\nAkun siap:');
  console.log('  Email   : kasir@mitarasa.com');
  console.log('  Password: admin354');
}

main().catch(console.error);
