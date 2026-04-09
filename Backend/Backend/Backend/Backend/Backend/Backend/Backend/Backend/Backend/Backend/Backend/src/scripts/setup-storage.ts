import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKETS = [
    {
        id: process.env.SUPABASE_STORAGE_BUCKET_AVATARS || 'avatars',
        public: true,
        fileSizeLimit: parseInt(process.env.MAX_AVATAR_SIZE || '5242880'),
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
    {
        id: process.env.SUPABASE_STORAGE_BUCKET_REELS || 'reels',
        public: true,
        fileSizeLimit: parseInt(process.env.MAX_REEL_SIZE || '104857600'),
        allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    },
    {
        id: process.env.SUPABASE_STORAGE_BUCKET_THUMBNAILS || 'thumbnails',
        public: true,
        fileSizeLimit: parseInt(process.env.MAX_THUMBNAIL_SIZE || '2097152'),
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
];

async function setupStorage() {
    console.log('🚀 Starting Supabase Storage Setup...');

    for (const bucket of BUCKETS) {
        console.log(`\n📦 Checking bucket: ${bucket.id}`);

        const { data: existingBucket, error: getError } = await supabase.storage.getBucket(bucket.id);

        if (getError && getError.message.includes('not found')) {
            console.log(`   Bucket ${bucket.id} does not exist. Creating...`);

            const { data, error: createError } = await supabase.storage.createBucket(bucket.id, {
                public: bucket.public,
                fileSizeLimit: bucket.fileSizeLimit,
                allowedMimeTypes: bucket.allowedMimeTypes,
            });

            if (createError) {
                console.error(`   ❌ Failed to create bucket ${bucket.id}:`, createError.message);
            } else {
                console.log(`   ✅ Bucket ${bucket.id} created successfully!`);
            }
        } else if (existingBucket) {
            console.log(`   ℹ️  Bucket ${bucket.id} already exists.`);

            // Optional: Update bucket config if needed
            const { error: updateError } = await supabase.storage.updateBucket(bucket.id, {
                public: bucket.public,
                fileSizeLimit: bucket.fileSizeLimit,
                allowedMimeTypes: bucket.allowedMimeTypes,
            });

            if (updateError) {
                console.warn(`   ⚠️  Failed to update bucket ${bucket.id} config:`, updateError.message);
            } else {
                console.log(`   ✅ Bucket ${bucket.id} configuration updated.`);
            }
        } else {
            console.error(`   ❌ Error checking bucket ${bucket.id}:`, getError?.message);
        }
    }

    console.log('\n✨ Storage setup completed!');
}

setupStorage().catch((err) => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
