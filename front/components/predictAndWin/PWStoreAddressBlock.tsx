import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PWMapPickerModal } from './PWMapPickerModal';
import { PWPlacesAddressField } from './PWPlacesAddressField';
import { IconMapFill } from './icons';
import { PW, usePWDirection, usePWFonts, usePWScale } from './theme';

export function PWStoreAddressBlock({
  value,
  onChangeText,
  storeName,
  labels,
  onPasteEmpty,
  onPasteDone,
  icon,
}: {
  value: string;
  onChangeText: (t: string) => void;
  storeName: string;
  labels: {
    fieldPlaceholder: string;
    steps: string;
    pickOnMap: string;
    pasteAddress: string;
    mapPicker: {
      title: string;
      close: string;
      myLocation: string;
      hint: string;
      confirm: string;
      noKey: string;
      loadError: string;
      geoDenied: string;
    };
  };
  onPasteEmpty: () => void;
  onPasteDone: () => void;
  icon?: React.ReactNode;
}) {
  const { s, f } = usePWScale();
  const { semibold, regular, medium } = usePWFonts();
  const dir = usePWDirection();
  const [mapOpen, setMapOpen] = useState(false);

  const pasteFromClipboard = useCallback(async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (!text) {
      onPasteEmpty();
      return;
    }
    onChangeText(text);
    onPasteDone();
  }, [onChangeText, onPasteEmpty, onPasteDone]);

  const confirmMapAddress = useCallback(
    (address: string) => {
      onChangeText(address);
      setMapOpen(false);
      onPasteDone();
    },
    [onChangeText, onPasteDone],
  );

  return (
    <View style={{ width: '100%', gap: s(10) }}>
      <PWPlacesAddressField
        value={value}
        onChangeText={onChangeText}
        placeholder={labels.fieldPlaceholder}
        icon={icon}
      />

      <Text
        style={{
          fontFamily: regular,
          fontSize: f(12),
          lineHeight: f(18),
          color: PW.textTileSub,
          textAlign: dir.textAlign,
        }}
      >
        {labels.steps}
      </Text>

      <View
        style={{
          flexDirection: dir.isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: s(10),
          alignSelf: dir.alignStart,
        }}
      >
        <Pressable
          onPress={() => setMapOpen(true)}
          accessibilityRole="button"
          style={{
            flexDirection: dir.isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: s(8),
            paddingVertical: s(8),
            paddingHorizontal: s(12),
            borderRadius: s(10),
            backgroundColor: '#3d0ab3',
          }}
        >
          <IconMapFill width={s(18)} height={s(18)} />
          <Text style={{ fontFamily: semibold, fontSize: f(13), color: '#fff' }}>
            {labels.pickOnMap}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void pasteFromClipboard()}
          accessibilityRole="button"
          style={{
            paddingVertical: s(8),
            paddingHorizontal: s(12),
            borderRadius: s(10),
            borderWidth: 1,
            borderColor: '#2b2539',
            backgroundColor: '#0c051a',
          }}
        >
          <Text style={{ fontFamily: medium, fontSize: f(13), color: '#EDE4F7' }}>
            {labels.pasteAddress}
          </Text>
        </Pressable>
      </View>

      <PWMapPickerModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={confirmMapAddress}
        onAddressChange={onChangeText}
        labels={labels.mapPicker}
      />
    </View>
  );
}
