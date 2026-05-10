# Tamagui Setup — 90Plus

## ✅ Installation Complete

Tamagui has been successfully installed and configured in the project.

---

## 📁 Files Created

1. **`tamagui.config.ts`** — Main configuration file with design tokens
2. **`components/tamagui/index.ts`** — Re-exports of Tamagui primitives
3. **`components/tamagui/GlassCard.tsx`** — Example custom component

---

## 🎨 Design Tokens Available

### Colors
```tsx
// Primary (Neon Green)
$primary500  // #32CD32

// Secondary (Neon Blue)
$secondary500  // #00D9FF

// Accent colors
$orange  // #FF7A3D
$teal  // #11998E
$purple  // #8E54E9
$pink  // #F5576C

// Surface
$surface  // #0A0A0A
$surfaceBright  // #1A1A1A

// Glass
$glass  // rgba(255,255,255,0.08)
$glassMedium  // rgba(255,255,255,0.12)
$glassBorder  // rgba(255,255,255,0.12)

// Text
$textPrimary  // #FFFFFF
$textSecondary  // rgba(255,255,255,0.7)
```

### Spacing
```tsx
$1  // 4px
$2  // 8px
$3  // 12px
$4  // 16px
$6  // 24px
$8  // 32px
$12  // 48px
```

### Border Radius
```tsx
$1  // 4px
$3  // 12px
$4  // 16px
$6  // 24px
$9  // 999px (pill/round)
```

### Sizes (for width/height)
```tsx
$11  // 44px (minimum touch target)
$12  // 48px
$16  // 64px
```

---

## 🚀 Usage Examples

### Basic Stack Layout
```tsx
import { YStack, XStack, Text } from '@/components/tamagui';

<YStack space="$4" padding="$4">
  <Text color="$textPrimary" fontSize="$6">Hello</Text>
  <XStack space="$2">
    <Text>Item 1</Text>
    <Text>Item 2</Text>
  </XStack>
</YStack>
```

### Glass Card
```tsx
import { GlassCard } from '@/components/tamagui/GlassCard';
import { YStack, Text } from '@/components/tamagui';

<GlassCard 
  variant="medium" 
  elevation="high"
  padding="$4"
  borderRadius="$6"
>
  <YStack space="$3">
    <Text color="$textPrimary" fontSize="$7" fontWeight="700">
      Welcome Back
    </Text>
    <Text color="$textSecondary" fontSize="$4">
      Your stats are looking great
    </Text>
  </YStack>
</GlassCard>
```

### Responsive Layout
```tsx
<YStack 
  padding="$4"
  $gtSm={{ padding: '$6' }}  // Tablet+
  $gtMd={{ padding: '$8' }}  // Desktop+
>
  <Text>Responsive content</Text>
</YStack>
```

### Themed Components
```tsx
import { Theme } from '@/components/tamagui';

<Theme name="dark_green">
  <GlassCard>
    <Text>This card uses green accent theme</Text>
  </GlassCard>
</Theme>
```

### Animations
```tsx
<YStack
  animation="bouncy"
  enterStyle={{ opacity: 0, scale: 0.9 }}
  exitStyle={{ opacity: 0, scale: 0.9 }}
  opacity={1}
  scale={1}
>
  <Text>Animated content</Text>
</YStack>
```

---

## 🎯 Tamagui Features You Can Use

### 1. **Token-based Design**
All spacing, colors, sizes use tokens — no more hardcoded values.

### 2. **Variants System**
Create component variants for different states/styles.

### 3. **Media Queries**
Built-in responsive props: `$gtSm`, `$gtMd`, `$sm`, etc.

### 4. **Animations**
Integrated with React Native Reanimated via `animation` prop.

### 5. **Themes**
Switch between themes: `dark`, `dark_green`, `dark_orange`, etc.

### 6. **Shorthands**
- `px` → `paddingHorizontal`
- `py` → `paddingVertical`
- `bg` → `backgroundColor`
- `br` → `borderRadius`
- `w` → `width`
- `h` → `height`

### 7. **Pseudo States**
- `hoverStyle` — hover state (web only)
- `pressStyle` — press state
- `focusStyle` — focus state

### 8. **Type Safety**
Full TypeScript support with autocomplete for all tokens.

---

## 📦 Available Primitives

- `Stack`, `XStack`, `YStack`, `ZStack` — Layout containers
- `Text` — Typography
- `Button` — Interactive buttons
- `Card` — Card container
- `Input` — Text input
- `Image` — Optimized images
- `ScrollView` — Scrollable container
- `Avatar` — User avatars
- `Circle`, `Square` — Shape primitives
- `Separator` — Divider lines
- `Spinner` — Loading indicator
- `Sheet` — Bottom sheet
- `Dialog` — Modal dialog
- `Popover` — Floating popover
- `Tooltip` — Hover tooltip
- `Switch`, `Checkbox`, `RadioGroup` — Form controls
- `Slider`, `Progress` — Range controls

---

## 🔧 Next Steps

1. **Migrate existing components** — Start with `WelcomeSection`
2. **Create custom variants** — Add more component variants as needed
3. **Build design system components** — Badge, Chip, IconButton, etc.
4. **Add animations** — Use Reanimated integration for smooth transitions

---

## 📚 Resources

- [Tamagui Docs](https://tamagui.dev)
- [Tamagui Stacks](https://tamagui.dev/docs/components/stacks)
- [Tamagui Themes](https://tamagui.dev/docs/core/theme)
- [Tamagui Animations](https://tamagui.dev/docs/core/animations)

---

## ⚠️ Important Notes

- Tamagui uses its own `Text` component — don't mix with RN `Text`
- Tamagui `Image` is different from `expo-image` — use `expo-image` for advanced features
- For complex animations, still use Reanimated directly
- Tamagui works best with Expo SDK 50+

---

## 🎨 Design System Alignment

The Tamagui config is aligned with your existing `designSystem.ts`:
- Same color palette
- Same spacing scale (8px grid)
- Same border radius values
- Same typography scale
- Same elevation/shadow system

You can now gradually migrate components from `StyleSheet` to Tamagui while maintaining visual consistency.
