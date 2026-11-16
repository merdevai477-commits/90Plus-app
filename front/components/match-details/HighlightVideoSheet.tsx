import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

type Props = {
  visible: boolean;
  url: string;
  onClose: () => void;
  closeLabel?: string;
};

/** In-app web sheet. The video page stays inside the app instead of the system browser. */
export function HighlightVideoSheet({ visible, url, onClose, closeLabel = 'Close' }: Props) {
  const { height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel} />
        <View style={[styles.sheet, { height: Math.round(height * 0.78) }]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              hitSlop={12}
              style={styles.close}
            >
              <Ionicons name="close" size={22} color="#24104E" />
            </Pressable>
          </View>
          <View style={styles.web}>
            {visible && url ? (
              <WebView
                source={{ uri: url }}
                style={styles.webView}
                setSupportMultipleWindows={false}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
              />
            ) : null}
            {loading ? (
              <View style={styles.loader} pointerEvents="none">
                <ActivityIndicator color="#6A2BD9" size="large" />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 6, 28, 0.55)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleRow: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8CDEE',
  },
  close: {
    position: 'absolute',
    right: 16,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EBFF',
  },
  web: {
    flex: 1,
    backgroundColor: '#0C061C',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0C061C',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
