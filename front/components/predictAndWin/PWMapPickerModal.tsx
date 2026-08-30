import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import {
  getCurrentStoreCoordinates,
  getStoreLocationPermission,
  isNativeLocationAvailable,
  openAppSettings,
  requestStoreLocationPermission,
} from '../../utils/storeLocationPermission';
import { getGoogleMapsJsApiKey, hasGoogleMapsJsApiKey } from './googlePlaces';
import { buildMapPickerHtml } from './mapPickerHtml';
import { PW, usePWDirection, usePWFonts, usePWScale } from './theme';

type MapPickerMessage =
  | { type: 'ready' }
  | { type: 'locateMe' }
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
    locationPermissionTitle: string;
    locationPermissionBody: string;
    locationPermissionAllow: string;
    locationPermissionLater: string;
    openSettings: string;
  };
}) {
  const { s, f } = usePWScale();
  const { semibold, regular, medium } = usePWFonts();
  const dir = usePWDirection();
  const webViewRef = useRef<WebView>(null);
  const permissionPromptedRef = useRef(false);
  const apiKey = getGoogleMapsJsApiKey();
  const [preview, setPreview] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const html = useMemo(
    () => (apiKey ? buildMapPickerHtml(apiKey, { myLocation: labels.myLocation }) : ''),
    [apiKey, labels.myLocation],
  );

  const reset = () => {
    setPreview('');
    setMapReady(false);
    setError(null);
    setLocating(false);
    permissionPromptedRef.current = false;
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const centerMap = useCallback((lat: number, lng: number) => {
    webViewRef.current?.injectJavaScript(
      `window.setMapPosition(${lat}, ${lng}); true;`,
    );
  }, []);

  const goToMyLocation = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const nativeAvailable = await isNativeLocationAvailable();
      if (!nativeAvailable) {
        webViewRef.current?.injectJavaScript(
          'window.requestWebGeolocation && window.requestWebGeolocation(); true;',
        );
        return;
      }

      const coords = await getCurrentStoreCoordinates();
      if (!coords) {
        setError(labels.geoDenied);
        Alert.alert(labels.locationPermissionTitle, labels.geoDenied, [
          { text: labels.openSettings, onPress: openAppSettings },
          { text: labels.locationPermissionLater, style: 'cancel' },
        ]);
        return;
      }
      centerMap(coords.lat, coords.lng);
    } catch {
      setError(labels.geoDenied);
    } finally {
      setLocating(false);
    }
  }, [centerMap, labels]);

  const promptLocationPermission = useCallback(() => {
    Alert.alert(labels.locationPermissionTitle, labels.locationPermissionBody, [
      { text: labels.locationPermissionLater, style: 'cancel' },
      {
        text: labels.locationPermissionAllow,
        onPress: () => {
          void requestStoreLocationPermission().then((status) => {
            if (status === 'granted') void goToMyLocation();
          });
        },
      },
    ]);
  }, [goToMyLocation, labels]);

  useEffect(() => {
    if (!visible) return;
    if (permissionPromptedRef.current) return;

    void isNativeLocationAvailable().then((native) => {
      if (!native) return;
      return getStoreLocationPermission().then((status) => {
        if (status === 'granted') return;
        permissionPromptedRef.current = true;
        promptLocationPermission();
      });
    });
  }, [visible, promptLocationPermission]);

  const handleMessage = (raw: string) => {
    try {
      const msg = JSON.parse(raw) as MapPickerMessage;
      if (msg.type === 'ready') {
        setMapReady(true);
        setError(null);
        return;
      }
      if (msg.type === 'locateMe') {
        void goToMyLocation();
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
              ref={webViewRef}
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
            {locating ? (
              <View
                style={{
                  position: 'absolute',
                  top: s(12),
                  right: s(12),
                  padding: s(8),
                  borderRadius: s(20),
                  backgroundColor: 'rgba(61,10,179,0.9)',
                }}
              >
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : null}
          </View>
        )}

        {mapReady ? (
          <Pressable
            onPress={() => void goToMyLocation()}
            style={{
              alignSelf: dir.alignStart,
              marginHorizontal: s(20),
              marginBottom: s(8),
              paddingVertical: s(10),
              paddingHorizontal: s(14),
              borderRadius: s(12),
              backgroundColor: '#3d0ab3',
            }}
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: semibold, fontSize: f(14), color: '#fff' }}>
              {labels.myLocation}
            </Text>
          </Pressable>
        ) : null}

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
