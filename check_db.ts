import { supabase } from './src/integrations/supabase/client';

async function checkEvents() {
    console.log('Checking vtc_events table...');
    const { data, error, count } = await supabase
        .from('vtc_events')
        .select('*', { count: 'exact' });

    if (error) {
        console.error('Supabase Error:', error);
    } else {
        console.log(`Found ${data?.length} rows. Total count: ${count}`);
        console.log('Data:', JSON.stringify(data, null, 2));
    }
}

checkEvents();
