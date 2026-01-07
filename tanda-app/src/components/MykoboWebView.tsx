/**
 * Mykobo WebView Component
 *
 * Displays the Mykobo SEP-24 interactive WebView for deposits/withdrawals.
 * KYC and payment processing happens inside this WebView.
 *
 * On web: Opens in a new browser tab (WebView not supported)
 * On mobile: Uses native WebView component
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';

// Only import WebView on native platforms
let WebView: any = null;
let WebViewNavigation: any = null;
if (Platform.OS !== 'web') {
  const webviewModule = require('react-native-webview');
  WebView = webviewModule.WebView;
  WebViewNavigation = webviewModule.WebViewNavigation;
}

interface MykoboWebViewProps {
  url: string;
  transactionId: string;
  type: 'deposit' | 'withdraw';
  amount?: number;
  onClose: () => void;
  onComplete: (transactionId: string) => void;
  onError: (error: string) => void;
}

export const MykoboWebView: React.FC<MykoboWebViewProps> = ({
  url,
  transactionId,
  type,
  amount,
  onClose,
  onComplete,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentUrl, setCurrentUrl] = useState(url);
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // On web, use iframe
  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsLoading(false);
    }
  }, [url]);

  // Handle navigation state changes (native only)
  const handleNavigationStateChange = (navState: any) => {
    setCurrentUrl(navState.url);

    // Check for completion URLs (Mykobo redirects here when done)
    if (navState.url.includes('callback') || navState.url.includes('success')) {
      console.log('[MykoboWebView] Transaction completed:', transactionId);
      onComplete(transactionId);
    }

    // Check for error/cancel URLs
    if (navState.url.includes('error') || navState.url.includes('cancel')) {
      console.log('[MykoboWebView] Transaction cancelled or failed');
      onError('Transaccion cancelada');
    }
  };

  // Handle messages from the WebView (if Mykobo sends postMessage)
  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[MykoboWebView] Message from WebView:', data);

      if (data.type === 'complete' || data.status === 'completed') {
        onComplete(transactionId);
      } else if (data.type === 'error' || data.status === 'error') {
        onError(data.message || 'Error en la transaccion');
      }
    } catch (e) {
      // Not JSON, ignore
    }
  };

  // Web platform - open in popup window (iframes have CSRF/cookie issues)
  if (Platform.OS === 'web') {
    // Open Mykobo in a centered popup window
    const openPopup = () => {
      const width = 500;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(
        url,
        'MykoboPayment',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );
    };

    useEffect(() => {
      openPopup();
    }, [url]);

    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeButton}>
            <Text style={s.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>
              {type === 'deposit' ? 'Depositar EUR' : 'Retirar EUR'}
            </Text>
            {amount && (
              <Text style={s.headerAmount}>{amount.toFixed(2)} EUR</Text>
            )}
          </View>
          <View style={s.headerRight}>
            <View style={s.secureBadge}>
              <Text style={s.secureIcon}>🔒</Text>
              <Text style={s.secureText}>Seguro</Text>
            </View>
          </View>
        </View>

        {/* Instructions for web */}
        <View style={s.webInstructions}>
          <Text style={s.webInstructionsIcon}>🏦</Text>
          <Text style={s.webInstructionsTitle}>Mykobo abierto en nueva pestaña</Text>
          <Text style={s.webInstructionsText}>
            Completa el proceso de pago en la pestaña de Mykobo.
            {'\n'}Cuando termines, vuelve aquí y pulsa el botón verde.
          </Text>

          <TouchableOpacity
            style={s.webOpenAgainButton}
            onPress={openPopup}
          >
            <Text style={s.webOpenAgainButtonText}>Abrir Mykobo de nuevo</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom buttons */}
        <View style={s.webBottomBar}>
          <View style={s.webButtonRow}>
            <TouchableOpacity
              style={s.webBackButton}
              onPress={onClose}
            >
              <Text style={s.webBackButtonText}>← Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.webCompleteButton}
              onPress={() => onComplete(transactionId)}
            >
              <Text style={s.webCompleteButtonText}>He completado el pago ✓</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>
            Procesado por Mykobo · Regulado en Lituania
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Native platforms - use WebView
  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.closeButton}>
          <Text style={s.closeButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>
            {type === 'deposit' ? 'Depositar EUR' : 'Retirar EUR'}
          </Text>
          {amount && (
            <Text style={s.headerAmount}>{amount.toFixed(2)} EUR</Text>
          )}
        </View>

        <View style={s.headerRight}>
          <View style={s.secureBadge}>
            <Text style={s.secureIcon}>🔒</Text>
            <Text style={s.secureText}>Seguro</Text>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      {isLoading && (
        <View style={s.progressContainer}>
          <View style={[s.progressBar, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {/* WebView */}
      {WebView && (
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={s.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onLoadProgress={({ nativeEvent }: any) => setProgress(nativeEvent.progress)}
          onError={(syntheticEvent: any) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[MykoboWebView] Error:', nativeEvent);
            onError('Error al cargar la pagina');
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsBackForwardNavigationGestures={true}
          renderLoading={() => (
            <View style={s.loadingOverlay}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={s.loadingText}>Cargando Mykobo...</Text>
            </View>
          )}
        />
      )}

      {/* Info footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>
          Procesado por Mykobo · Regulado en Lituania
        </Text>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '500',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  headerAmount: {
    fontSize: 13,
    color: '#868e96',
    marginTop: 2,
  },
  headerRight: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d3f9d8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  secureIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  secureText: {
    fontSize: 11,
    color: '#2f9e44',
    fontWeight: '600',
  },
  progressContainer: {
    height: 3,
    backgroundColor: '#e9ecef',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#868e96',
  },
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  footerText: {
    fontSize: 12,
    color: '#868e96',
    textAlign: 'center',
  },
  // Web styles
  webInstructions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8f9fa',
  },
  webInstructionsIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  webInstructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },
  webInstructionsText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  webOpenAgainButton: {
    backgroundColor: '#e7f5ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#74c0fc',
  },
  webOpenAgainButtonText: {
    color: '#1971c2',
    fontSize: 14,
    fontWeight: '600',
  },
  webBottomBar: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  webButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  webBackButton: {
    flex: 1,
    backgroundColor: '#f1f3f5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  webBackButtonText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '600',
  },
  webCompleteButton: {
    flex: 2,
    backgroundColor: '#2f9e44',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  webCompleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MykoboWebView;
