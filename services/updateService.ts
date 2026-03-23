import { supabase } from './supabaseClient';

export interface UpdateInfo {
  latestVersion: string;
  updateUrl: string;
  isAvailable: boolean;
}

/**
 * Fetches the latest app version and update URL from Supabase.
 */
export const getLatestAppMetadata = async (): Promise<Record<string, string>> => {
  try {
    const { data, error } = await supabase
      .from('app_metadata')
      .select('key, value');

    if (error) throw error;

    const metadata: Record<string, string> = {};
    data?.forEach(item => {
      metadata[item.key] = item.value;
    });

    return metadata;
  } catch (error) {
    console.error('Error fetching app metadata:', error);
    return {};
  }
};

/**
 * Checks if a newer version of the app is available.
 * @param currentVersion - The currently running version (e.g., '1.1.0')
 */
export const checkForUpdates = async (currentVersion: string): Promise<UpdateInfo> => {
  const metadata = await getLatestAppMetadata();
  const latestVersion = metadata['latest_version'];
  const updateUrl = metadata['update_url'] || 'https://github.com/yasirkhan3ye/hisaab-ai/releases/latest';

  console.log(`Update check: Current=${currentVersion}, Latest=${latestVersion}`);

  if (!latestVersion) {
    return { latestVersion: currentVersion, updateUrl, isAvailable: false };
  }

  // Simple semver comparison (1.2.0 > 1.1.0)
  const isAvailable = compareVersions(latestVersion, currentVersion) > 0;

  return {
    latestVersion,
    updateUrl,
    isAvailable
  };
};

/**
 * Helper to compare two version strings.
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
const compareVersions = (v1: string, v2: string): number => {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
};
