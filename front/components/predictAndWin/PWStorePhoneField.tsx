import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import CountryPickerModal from '../common/CountryPickerModal';
import {
  DEFAULT_SPONSOR_PHONE_COUNTRY_ID,
  formatNationalDisplay,
  getCountryById,
  getDialCode,
  normalizeNationalDigits,
} from './sponsorPhone';
import { PWBox } from './fields';
import { usePWDirection, usePWFonts, usePWScale, PW } from './theme';

export function PWStorePhoneField({
  countryId,
  nationalDigits,
  onCountryChange,
  onNationalChange,
  placeholder,
  hint,
}: {
  countryId: string;
  nationalDigits: string;
  onCountryChange: (countryId: string) => void;
  onNationalChange: (digits: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const { s, f } = usePWScale();
  const { regular, medium } = usePWFonts();
  const dir = usePWDirection();
  const [pickerOpen, setPickerOpen] = useState(false);

  const country = useMemo(() => getCountryById(countryId), [countryId]);
  const dial = getDialCode(countryId);
  const displayValue = formatNationalDisplay(nationalDigits, countryId);

  const onChangeText = (text: string) => {
    onNationalChange(normalizeNationalDigits(text, countryId));
  };

  return (
    <>
      <View style={{ gap: s(8) }}>
        <PWBox height={64}>
          <View
            style={{
              flexDirection: dir.isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: s(10),
            }}
          >
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={country?.nameAr ?? country?.name ?? 'Country'}
              style={{
                flexDirection: dir.isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: s(6),
                paddingHorizontal: s(4),
                paddingVertical: s(4),
              }}
            >
              <Text style={{ fontSize: f(22) }}>{country?.flag ?? '🇪🇬'}</Text>
              <Text style={{ fontFamily: medium, fontSize: f(15), color: PW.vsTop }}>
                {dial}
              </Text>
            </Pressable>

            <TextInput
              value={displayValue}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={PW.textPlaceholder}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              style={{
                flex: 1,
                fontFamily: regular,
                fontSize: f(17),
                color: PW.text,
                textAlign: dir.textAlign,
                paddingVertical: 0,
              }}
            />
          </View>
        </PWBox>
        {hint ? (
          <Text
            style={{
              fontFamily: regular,
              fontSize: f(11),
              color: PW.textTileSub,
              textAlign: dir.textAlign,
            }}
          >
            {hint}
          </Text>
        ) : null}
      </View>

      <CountryPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedCountryId={countryId}
        onSelect={(item) => {
          onCountryChange(item.id);
          onNationalChange(normalizeNationalDigits(nationalDigits, item.id));
          setPickerOpen(false);
        }}
      />
    </>
  );
}
