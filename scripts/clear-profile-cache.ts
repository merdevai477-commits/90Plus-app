/**
 * Script to clear all profile cache data
 * Run this once to remove shared cache data after the fix
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function clearAllProfileCache() {
  try {
    console.log('🧹 Clearing all profile cache data...');
    
    // Get all keys
    const allKeys = await AsyncStorage.getAllKeys();
    
    // Filter profile-related keys
    const profileKeys = allKeys.filter(key => 
      key.includes('profile') || 
      key.includes('user_data') ||
      key.includes('PROFILE_DATA')
    );
    
    if (profileKeys.length > 0) {
      console.log(`Found ${profileKeys.length} profile cache keys to clear:`, profileKeys);
      await AsyncStorage.multiRemove(profileKeys);
      console.log('✅ Profile cache cleared successfully');
    } else {
      console.log('ℹ️ No profile cache keys found');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error clearing profile cache:', error);
    return false;
  }
}

// Run if executed directly
if (require.main === module) {
  clearAllProfileCache()
    .then(() => console.log('Done'))
    .catch(err => console.error('Failed:', err));
}
