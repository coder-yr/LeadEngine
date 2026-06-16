import { supabase } from './src/config/supabase.js';

async function createBucket() {
  const { data, error } = await supabase.storage.createBucket('proposals', { public: true });
  if (error) {
    console.error('Error creating bucket:', error);
  } else {
    console.log('Bucket created successfully:', data);
  }
}

createBucket();
