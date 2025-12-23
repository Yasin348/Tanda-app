import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Button } from '../../components';

interface SuccessScreenProps {
  publicKey: string;
  onFinish: () => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  publicKey,
  onFinish,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const shortKey = `${publicKey.slice(0, 12)}...${publicKey.slice(-8)}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={styles.icon}>🎉</Text>
        </Animated.View>

        <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
          <Text style={styles.title}>¡Cuenta creada!</Text>
          <Text style={styles.subtitle}>
            Tu cuenta está lista para usar
          </Text>

          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Tu dirección</Text>
            <View style={styles.addressBox}>
              <Text style={styles.address} numberOfLines={1}>
                {shortKey}
              </Text>
            </View>
            <Text style={styles.addressHint}>
              Esta es tu identificador público. Puedes compartirlo para recibir pagos.
            </Text>
          </View>

          <View style={styles.features}>
            <FeatureCheck text="Puedes crear y unirte a tandas" />
            <FeatureCheck text="Tu dinero está 100% bajo tu control" />
            <FeatureCheck text="Transacciones rápidas y seguras" />
          </View>
        </Animated.View>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Empezar a usar Tanda"
          onPress={onFinish}
          size="large"
        />
      </View>
    </SafeAreaView>
  );
};

const FeatureCheck: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.featureRow}>
    <Text style={styles.featureCheck}>✓</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  icon: {
    fontSize: 80,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  addressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  addressBox: {
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    alignItems: 'center',
  },
  address: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#475569',
  },
  addressHint: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  features: {
    gap: 16,
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureCheck: {
    fontSize: 18,
    color: '#22c55e',
    fontWeight: '700',
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#475569',
  },
  buttons: {
    padding: 24,
  },
});
