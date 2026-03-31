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

    // Whitelist: Only send columns that exist in Supabase tables
    const allowedFields: Record<string, string[]> = {
        transactions: ['id', 'amount', 'category', 'date', 'type', 'description'],
        lend_records: ['id', 'personName', 'amount', 'currency', 'exchangeRateAtLending', 'dateLent', 'dueDate', 'status', 'description', 'repayments'],
        profiles: ['name', 'avatarSeed', 'photo'],
    };

    const fields = allowedFields[table];

    // Sanitize: strip any fields NOT in the whitelist, then attach user_id
    const dataWithSync = data.map(item => {
        const clean: any = { user_id: syncWord };
        if (fields) {
            fields.forEach(f => {
                if (item[f] !== undefined) clean[f] = item[f];
            });
        } else {
            // Fallback: send everything but strip known problematic fields
            Object.keys(item).forEach(k => {
                if (k !== 'excludeFromAnalytics') clean[k] = item[k];
            });
        }
        return clean;
    });

    const { error } = await supabase
        .from(table)
        .upsert(dataWithSync, { onConflict: 'id' });

    if (error) {
        console.error(`Sync error for ${table}:`, error);
        return error;
    }
    return null;
};

/**
 * Fetches data from the cloud that matches the current device's Secret Sync Word.
 */
export const fetchDataFromCloud = async (table: string) => {
    if (!supabaseUrl) return { data: null, error: 'No Supabase URL' };

    const syncWord = localStorage.getItem('hisaab_sync_word');
    if (!syncWord) return { data: null, error: 'No Sync Word' };

    const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', syncWord);

    if (error) {
        console.error(`Fetch error for ${table}:`, error);
        return { data: null, error };
    }
    return { data, error: null };
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
