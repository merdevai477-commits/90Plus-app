/**
 * Back arrow plus screen title, shared by the tabs that lay out in normal flow.
 *
 * The pitch keeps its own copy because every one of its elements is pinned to
 * design-frame coordinates, header included.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

type TsfHeaderProps = {
  onBack: () => void;
  s: (value: number) => number;
  testID?: string;
};

export function TsfHeader({ onBack, s, testID }: TsfHeaderProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const copy = t.topScorersFive;
  const fontSemi = useAppFont(600);

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + s(10),
          paddingBottom: s(10),
          paddingLeft: Math.max(insets.left, s(24)),
          paddingRight: Math.max(insets.right, s(24)),
        },
      ]}
    >
      <TouchableOpacity
        onPress={onBack}
        hitSlop={12}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={copy.back}
        testID={testID}
        style={[styles.button, { width: s(38), height: s(38) }]}
      >
        <Ionicons name="arrow-back" size={s(28)} color="#FFFFFF" />
      </TouchableOpacity>
      <Text
        style={[styles.title, { fontFamily: fontSemi, fontSize: s(20) }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.1}
      >
        {copy.title}
      </Text>
      <View style={{ width: s(38) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  button: { alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#FFFFFF', textAlign: 'center' },
});
