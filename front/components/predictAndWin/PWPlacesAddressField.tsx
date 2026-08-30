import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import { hasGooglePlacesApiKey } from './googlePlaces';
import {
  fetchPlaceFormattedAddress,
  fetchPlaceSuggestions,
  type PlaceSuggestion,
} from '../../services/placesAutocomplete.service';
import { PWBox } from './fields';
import { usePWDirection, usePWFonts, usePWScale, PW } from './theme';

export function PWPlacesAddressField({
  value,
  onChangeText,
  placeholder,
  icon,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const { s, f } = usePWScale();
  const { regular, medium } = usePWFonts();
  const dir = usePWDirection();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const runSearch = useDebouncedCallback(async (text: string) => {
    if (!hasGooglePlacesApiKey()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const items = await fetchPlaceSuggestions(text);
    setSuggestions(items);
    setLoading(false);
  }, 320);

  useEffect(() => {
    return () => runSearch.cancel();
  }, [runSearch]);

  const onTextChange = useCallback(
    (text: string) => {
      onChangeText(text);
      if (text.trim().length >= 2) {
        setLoading(true);
        runSearch(text);
      } else {
        runSearch.cancel();
        setSuggestions([]);
        setLoading(false);
      }
    },
    [onChangeText, runSearch],
  );

  const pickSuggestion = useCallback(
    async (item: PlaceSuggestion) => {
      setSuggestions([]);
      setFocused(false);
      const detailed = await fetchPlaceFormattedAddress(item.placeId);
      onChangeText(detailed ?? item.description);
    },
    [onChangeText],
  );

  const showSuggestions = focused && suggestions.length > 0;

  return (
    <View style={{ width: '100%' }}>
      <PWBox height={64}>
        <View style={{ flexDirection: dir.rowReverse, alignItems: 'center', gap: s(12) }}>
          <TextInput
            value={value}
            onChangeText={onTextChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setSuggestions([]);
            }}
            placeholder={placeholder}
            placeholderTextColor={PW.textPlaceholder}
            style={{
              flex: 1,
              fontFamily: regular,
              fontSize: f(17),
              color: PW.text,
              textAlign: dir.textAlign,
            }}
          />
          {loading ? (
            <ActivityIndicator size="small" color={PW.textPlaceholder} />
          ) : icon ? (
            <View style={{ width: s(35), height: s(35) }}>{icon}</View>
          ) : null}
        </View>
      </PWBox>

      {showSuggestions ? (
        <View
          style={{
            marginTop: s(6),
            borderRadius: s(12),
            borderWidth: 1,
            borderColor: PW.inputBorder,
            backgroundColor: '#0c051a',
            maxHeight: s(200),
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((item) => (
              <Pressable
                key={item.placeId}
                onPress={() => pickSuggestion(item)}
                style={{
                  paddingHorizontal: s(16),
                  paddingVertical: s(12),
                  borderBottomWidth: 1,
                  borderBottomColor: PW.inputBorder,
                }}
              >
                <Text
                  style={{
                    fontFamily: medium,
                    fontSize: f(14),
                    color: PW.text,
                    textAlign: dir.textAlign,
                  }}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
