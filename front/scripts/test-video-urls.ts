/**
 * سكريبت لاختبار روابط الفيديو
 * استخدمه للتحقق من صلاحية روابط الفيديو قبل استخدامها
 */

export const TEST_VIDEO_URLS = [
  // روابط W3Schools (موثوقة)
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://www.w3schools.com/html/movie.mp4',
  
  // روابط Blender Foundation (جودة عالية)
  'https://download.blender.org/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4',
  
  // روابط Sample Videos (متنوعة)
  'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
  
  // روابط Pexels (فيديوهات مجانية)
  'https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c0fd273d2c6d9a064f3ae35579b2bbdf&profile_id=139&oauth2_token_id=57447761',
];

/**
 * اختبار رابط فيديو واحد
 */
export const testVideoUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    
    console.log(`Testing: ${url}`);
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${contentType}`);
    
    return response.ok && (contentType?.includes('video') ?? false);
  } catch (error) {
    console.error(`Failed to test ${url}:`, error);
    return false;
  }
};

/**
 * اختبار جميع الروابط
 */
export const testAllVideoUrls = async () => {
  console.log('🎬 Testing video URLs...\n');
  
  const results = await Promise.all(
    TEST_VIDEO_URLS.map(async (url) => {
      const isValid = await testVideoUrl(url);
      return { url, isValid };
    })
  );
  
  console.log('\n📊 Results:');
  results.forEach(({ url, isValid }) => {
    console.log(`${isValid ? '✅' : '❌'} ${url}`);
  });
  
  const validUrls = results.filter(r => r.isValid);
  console.log(`\n✅ Valid URLs: ${validUrls.length}/${results.length}`);
  
  return validUrls.map(r => r.url);
};

// للاستخدام في React Native
export const getWorkingVideoUrls = () => {
  // هذه الروابط تم اختبارها وتعمل
  return [
    'https://www.w3schools.com/html/mov_bbb.mp4',
    'https://www.w3schools.com/html/movie.mp4',
  ];
};
