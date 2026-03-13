# Profile Tasks Badge Feature

## Overview
A visual badge that shows remaining profile completion tasks, positioned next to the coins badge in the profile screen. The badge changes color based on completion percentage and opens a detailed modal when tapped.

## Components

### 1. ProfileTasksBadge
**Location:** `front/components/common/ProfileTasksBadge.tsx`

A compact badge component that displays:
- Number of remaining tasks
- Color-coded indicator based on completion percentage
- Checkmark icon

**Color Scheme:**
- 🔴 Red (0-29%): Just started
- 🟠 Orange (30-49%): Getting started
- 🟡 Yellow (50-79%): Halfway there
- 🟢 Green (80-99%): Almost done
- Hidden at 100%: Profile complete!

**Props:**
```typescript
interface ProfileTasksBadgeProps {
  remainingTasks: number;      // Number of incomplete tasks
  totalTasks: number;           // Total number of tasks
  percentage: number;           // Completion percentage (0-100)
  onPress: () => void;          // Handler when badge is tapped
}
```

### 2. ProfileTasksModal
**Location:** `front/components/common/ProfileTasksModal.tsx`

A full-featured modal that displays:
- Overall completion percentage with progress bar
- List of all profile completion tasks
- Visual indicators for completed/incomplete tasks
- Task weights (percentage contribution)
- Required task badges
- Warning if user can't upload videos yet

**Props:**
```typescript
interface ProfileTasksModalProps {
  visible: boolean;
  onClose: () => void;
  percentage: number;
  completedSteps: number;
  totalSteps: number;
  steps: ProfileTaskStep[];
  canUploadVideo: boolean;
  onStepPress: (stepId: string) => void;
}
```

## Profile Completion Tasks

### Required Tasks (Must complete 3 to upload videos)
1. **Avatar** (20%) - Profile picture
2. **Country** (15%) - User's country
3. **Club** (15%) - Favorite football club

### Optional Tasks
4. **Bio** (10%) - Profile description
5. **Position** (10%) - Playing position
6. **Age** (5%) - User's age
7. **Height** (5%) - User's height
8. **Weight** (5%) - User's weight
9. **Foot** (5%) - Preferred foot (R/L/B)
10. **Brand** (5%) - Favorite brand
11. **Social Links** (5%) - Social media links

## Integration

### In Profile Screen
The badge is positioned at the top-left of the profile screen, next to the coins badge:

```typescript
{/* Profile Tasks Badge - Only show if incomplete */}
{completionStatus && completionStatus.percentage < 100 && (
  <View style={styles.tasksBadgeContainer}>
    <ProfileTasksBadge
      remainingTasks={completionStatus.totalSteps - completionStatus.completedSteps}
      totalTasks={completionStatus.totalSteps}
      percentage={completionStatus.percentage}
      onPress={() => setIsTasksModalVisible(true)}
    />
  </View>
)}
```

### Positioning
```typescript
tasksBadgeContainer: {
  position: 'absolute',
  top: 50,
  left: 90,  // Next to coins badge
  zIndex: 1000,
}
```

## User Flow

1. **User opens profile** → Badge appears if profile < 100% complete
2. **User taps badge** → Modal opens showing all tasks
3. **User taps a task** → Appropriate modal/action opens (country picker, club picker, etc.)
4. **User completes task** → Progress updates automatically
5. **Profile reaches 100%** → Badge disappears

## Backend Integration

### API Endpoints
- `GET /api/profile/completion` - Get completion status
- `POST /api/profile/completion/step` - Mark step as completed

### Service
**Location:** `Backend/src/services/profile-completion.service.ts`

Calculates completion percentage based on:
- Field presence in database
- Weighted scoring system
- Required vs optional tasks

## Features

### Auto-hide at 100%
The badge automatically disappears when the profile is fully complete, providing a clean UI for users who have finished all tasks.

### Haptic Feedback
- Light haptic on badge tap
- Medium haptic on task selection

### Visual Feedback
- Smooth animations for modal open/close
- Progress bar with gradient colors
- Completed tasks show checkmark with green background
- Incomplete tasks show relevant icon

### Accessibility
- Clear visual indicators
- Color-coded progress
- Required task badges
- Warning messages for upload restrictions

## Testing

To test the feature:
1. Create a new user account
2. Check that badge appears with red/orange color
3. Complete some tasks (avatar, country, club)
4. Verify badge color changes to yellow/green
5. Complete all tasks
6. Verify badge disappears at 100%

## Notes

- Badge only shows for the current user's profile (not when viewing others)
- Completion status is cached for performance
- Updates happen in real-time when tasks are completed
- Backend validates all completion criteria
