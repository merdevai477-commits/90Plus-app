import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { getGoogleMapsJsApiKey, hasGoogleMapsJsApiKey } from '../../config/googlePlaces';
import { buildMapPickerHtml } from './mapPickerHtml';
import { PW, usePWDirection, usePWFonts, usePWScale } from './theme';

type MapPickerMessage =
  | { type: 'ready' }
  | { type: 'address'; address: string; lat: number; lng: number }
  | { type: 'error'; code: string };

export function PWMapPickerModal({
  visible,
  onClose,
  onConfirm,
  onAddressChange,
  labels,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (address: string) => void;
  /** Live updates the parent field while the user moves the pin. */
  onAddressChange?: (address: string) => void;
  labels: {
    title: string;
    close: string;
    myLocation: string;
    hint: string;
    confirm: string;
    noKey: string;
    loadError: string;
    geoDenied: string;
  };
}) {
  const { s, f } = usePWScale();
  const { semibold, regular, medium } = usePWFonts();
  const dir = usePWDirection();
  const apiKey = getGoogleMapsJsApiKey();
  const [preview, setPreview] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const html = useMemo(
    () => (apiKey ? buildMapPickerHtml(apiKey, { myLocation: labels.myLocation }) : ''),
    [apiKey, labels.myLocation],
  );

  const reset = () => {
    setPreview('');
    setMapReady(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleMessage = (raw: string) => {
    try {
      const msg = JSON.parse(raw) as MapPickerMessage;
      if (msg.type === 'ready') {
        setMapReady(true);
        setError(null);
        return;
      }
      if (msg.type === 'address') {
        setPreview(msg.address);
        setError(null);
        onAddressChange?.(msg.address);
        return;
      }
      if (msg.type === 'error') {
        if (msg.code === 'GEO_DENIED') {
          setError(labels.geoDenied);
        } else {
          setError(labels.loadError);
        }
      }
    } catch {
      /* ignore malformed messages */
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: '#080512' }}>
        <View
          style={{
            flexDirection: dir.row,
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: s(20),
            paddingTop: s(16),
            paddingBottom: s(12),
          }}
        >
          <Text style={{ fontFamily: semibold, fontSize: f(18), color: PW.text }}>
            {labels.title}
          </Text>
          <Pressable onPress={handleClose} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontFamily: medium, fontSize: f(15), color: '#9B8FB0' }}>{labels.close}</Text>
          </Pressable>
        </View>

        {!hasGoogleMapsJsApiKey() ? (
          <Text style={{ color: '#fda4af', textAlign: 'center', padding: s(24), fontFamily: regular }}>
            {labels.noKey}
          </Text>
        ) : (
          <View style={{ flex: 1, marginHorizontal: s(12), borderRadius: s(20), overflow: 'hidden' }}>
            <WebView
              originWhitelist={['*']}
              source={{ html, baseUrl: 'https://90plus.pro' }}
              geolocationEnabled
              onGeolocationPermissionsShowPrompt={(event) => {
                event.nativeEvent.callback(true);
              }}
              onMessage={(event) => handleMessage(event.nativeEvent.data)}
              style={{ flex: 1, backgroundColor: '#080512' }}
            />
            {!mapReady ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#A44AF9" size="large" />
              </View>
            ) : null}
          </View>
        )}

        <View style={{ padding: s(16), gap: s(10) }}>
          {error ? (
            <Text style={{ fontFamily: regular, fontSize: f(12), color: '#fda4af', textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}
          {preview ? (
            <Text
              style={{
                fontFamily: regular,
                fontSize: f(13),
                color: '#EDE4F7',
                textAlign: dir.textAlign,
                lineHeight: f(20),
              }}
              numberOfLines={3}
            >
              {preview}
            </Text>
          ) : (
            <Text style={{ fontFamily: regular, fontSize: f(12), color: '#9B8FB0', textAlign: 'center' }}>
              {labels.hint}
            </Text>
          )}

          <Pressable
            onPress={() => {
              if (!preview.trim()) return;
              onConfirm(preview.trim());
              reset();
            }}
            disabled={!preview.trim()}
            style={{
              borderRadius: s(16),
              backgroundColor: preview.trim() ? '#3d0ab3' : '#2b2539',
              paddingVertical: s(16),
              alignItems: 'center',
              opacity: preview.trim() ? 1 : 0.5,
            }}
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: semibold, fontSize: f(16), color: '#fff' }}>{labels.confirm}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080512',
  },
});
