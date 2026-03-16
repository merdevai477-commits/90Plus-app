# Requirements Document

## Introduction

هذا المستند يحدد متطلبات تحسين أمان رفع الفيديوهات ونظام التعليقات في تطبيق الريلز. يشمل ثلاث ميزات رئيسية:
1. **Hard Size Limit** - حد صارم لحجم الملفات لا يمكن تجاوزه
2. **MIME Type Verification** - التحقق من نوع الملف الفعلي عبر فحص الـ magic bytes وليس الامتداد فقط
3. **Comment Rate Limiting** - تحديد عدد التعليقات لكل مستخدم على كل فيديو

## Glossary

- **Video_Upload_System**: نظام رفع الفيديوهات في الباك إند
- **MIME_Validator**: مكون التحقق من نوع الملف الفعلي
- **Comment_System**: نظام التعليقات على الريلز
- **Magic_Bytes**: البايتات الأولى من الملف التي تحدد نوعه الفعلي
- **Hard_Limit**: الحد الأقصى المطلق لحجم الملف (50MB)
- **User**: المستخدم المسجل في التطبيق
- **Reel**: فيديو قصير في التطبيق

## Requirements

### Requirement 1: Hard Size Limit

**User Story:** As a system administrator, I want to enforce a strict file size limit on video uploads, so that I can prevent server overload and storage abuse.

#### Acceptance Criteria

1. WHEN a user attempts to upload a video file THEN the Video_Upload_System SHALL check the file size before processing
2. WHEN the uploaded file size exceeds 50MB THEN the Video_Upload_System SHALL reject the upload with error code "FILE_TOO_LARGE"
3. WHEN the uploaded file size exceeds 50MB THEN the Video_Upload_System SHALL return a clear error message in Arabic explaining the size limit
4. WHEN the file size check fails THEN the Video_Upload_System SHALL terminate the upload process immediately without storing any data
5. WHEN a valid file under 50MB is uploaded THEN the Video_Upload_System SHALL proceed with MIME type verification

### Requirement 2: MIME Type Verification

**User Story:** As a security engineer, I want to verify the actual file type by inspecting magic bytes, so that I can prevent malicious files disguised with fake extensions.

#### Acceptance Criteria

1. WHEN a file passes the size check THEN the MIME_Validator SHALL read the first 12 bytes of the file buffer
2. WHEN the magic bytes match video signatures (MP4, WebM, QuickTime) THEN the MIME_Validator SHALL allow the upload to proceed
3. WHEN the magic bytes do not match any allowed video signature THEN the MIME_Validator SHALL reject the file with error code "INVALID_FILE_TYPE"
4. WHEN the MIME type from magic bytes differs from the declared Content-Type THEN the MIME_Validator SHALL reject the file
5. WHEN MIME validation fails THEN the Video_Upload_System SHALL return a clear error message indicating the file type is not allowed

### Requirement 3: Comment Rate Limiting Per Video

**User Story:** As a content moderator, I want to limit each user to 5 comments per video, so that I can prevent spam and encourage meaningful engagement.

#### Acceptance Criteria

1. WHEN a user attempts to add a comment to a reel THEN the Comment_System SHALL count existing comments by that user on that reel
2. WHEN the user has fewer than 5 comments on the reel THEN the Comment_System SHALL allow the new comment
3. WHEN the user already has 5 comments on the reel THEN the Comment_System SHALL reject the comment with error code "COMMENT_LIMIT_REACHED"
4. WHEN the comment limit is reached THEN the Comment_System SHALL return a message indicating the maximum comments allowed
5. WHEN counting comments THEN the Comment_System SHALL include both top-level comments and replies by the same user
