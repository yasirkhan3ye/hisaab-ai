import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Syncs the data to the cloud using the "Secret Sync Word" as the unique identifier.
 * This allows multiple devices using the same word to stay in sync.
 */
export const syncDataToCloud = async (table: string, data: any[]) => {
    if (!supabaseUrl || !data.length) return;

    // Retrieve the secret sync word from local storage
    const syncWord = localStorage.getItem('hisaab_sync_word');
    if (!syncWord) return;

    // Attach the sync word to every record as the user_id
    const dataWithSync = data.map(item => ({
        ...item,
        user_id: syncWord
    }));

    const { error } = await supabase
        .from(table)
        .upsert(dataWithSync, { onConflict: 'id' });

    if (error) console.error(`Sync error for ${table}:`, error);
};

/**
 * Fetches data from the cloud that matches the current device's Secret Sync Word.
 */
export const fetchDataFromCloud = async (table: string) => {
    if (!supabaseUrl) return null;

    const syncWord = localStorage.getItem('hisaab_sync_word');
    if (!syncWord) return null;

    const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', syncWord); // Filter by the secret word

    if (error) {
        console.error(`Fetch error for ${table}:`, error);
        return null;
    }
    return data;
};

/**
 * Explicitly removes a record from the cloud.
 */
export const deleteRecordFromCloud = async (table: string, id: string) => {
    if (!supabaseUrl) return;
    const syncWord = localStorage.getItem('hisaab_sync_word');
    if (!syncWord) return;

    const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('user_id', syncWord);

    if (error) console.error(`Delete error for ${table}:`, error);
};
