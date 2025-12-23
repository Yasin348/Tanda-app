import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

// Componente QR compatible con web y native
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ value, size = 180 }) => {
  if (Platform.OS === 'web') {
    // En web, usar una API de QR externa
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <img
          src={qrUrl}
          alt="QR Code"
          style={{ width: size, height: size }}
        />
      </View>
    );
  }

  // En native, usar react-native-qrcode-svg
  const QRCode = require('react-native-qrcode-svg').default;

  return (
    <View style={styles.container}>
      <QRCode
        value={value}
        size={size}
        backgroundColor="#fff"
        color="#1e293b"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
