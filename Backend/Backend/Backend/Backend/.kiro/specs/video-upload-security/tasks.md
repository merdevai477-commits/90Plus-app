# Implementation Plan

## 1. Update Configuration Constants

- [x] 1.1 Update file size limits and add comment limits
  - Update `FILE_SIZE_LIMITS.REEL` to 50MB in `supabase.config.ts`
  - Add `COMMENT_LIMITS.MAX_PER_USER_PER_REEL = 5`
  - _Requirements: 1.2, 3.2, 3.3_

## 2. Implement MIME Validation Middleware

- [x] 2.1 Create file validation middleware with magic bytes detection
  - Create `Backend/src/middleware/file-validation.middleware.ts`
  - Implement `validateFileSize()` function
  - Implement `validateMimeType()` function with magic bytes checking
  - Support MP4, WebM, QuickTime signatures
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

- [x] 2.2 Write property test for size limit enforcement
  - **Property 1: Size Limit Enforcement**
  - **Validates: Requirements 1.2, 1.4**

- [x] 2.3 Write property test for valid video MIME acceptance
  - **Property 2: Valid Video MIME Acceptance**
  - **Validates: Requirements 2.2**

- [x] 2.4 Write property test for invalid MIME rejection
  - **Property 3: Invalid MIME Rejection**
  - **Validates: Requirements 2.3**

- [x] 2.5 Write property test for MIME mismatch rejection
  - **Property 4: MIME Mismatch Rejection**
  - **Validates: Requirements 2.4**

## 3. Integrate Validation in Video Upload

- [x] 3.1 Update video controller to use new validation
  - Import and use `validateFileSize()` before processing
  - Import and use `validateMimeType()` after size check
  - Return proper error responses with Arabic messages
  - _Requirements: 1.3, 1.4, 2.5_

- [x] 3.2 Update upload middleware with new size limit
  - Update multer config to use new 50MB limit
  - _Requirements: 1.2_

## 4. Checkpoint - Ensure upload validation tests pass

- [x] 4. Ensure all tests pass, ask the user if questions arise.





## 5. Implement Comment Rate Limiting

- [x] 5.1 Create or update comment controller with limit check
  - Add function to count user comments on a reel (including replies)
  - Add limit check before creating new comment
  - Return proper error response when limit reached
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5.2 Write property test for comment limit boundary
  - **Property 5: Comment Limit Boundary**
  - **Validates: Requirements 3.2, 3.3, 3.5**

## 6. Final Checkpoint - Ensure all tests pass

- [x] 6. Ensure all tests pass, ask the user if questions arise.





