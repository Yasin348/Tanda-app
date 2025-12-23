import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography } from '../../theme';

const { width, height } = Dimensions.get('window');

interface WelcomeScreenProps {
  onCreateAccount: () => void;
  onRecoverAccount: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onCreateAccount,
  onRecoverAccount,
}) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.primary[600], colors.primary[800]]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            {/* Hero Section */}
            <View style={styles.hero}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>T</Text>
              </View>
              <Text style={styles.title}>Tanda</Text>
              <Text style={styles.tagline}>
                Ahorro colaborativo{'\n'}sin intermediarios
              </Text>
            </View>

            {/* Features */}
            <View style={styles.features}>
              <FeatureChip icon="shield-checkmark" text="100% Seguro" />
              <FeatureChip icon="flash" text="Instantáneo" />
              <FeatureChip icon="people" text="P2P" />
            </View>

            {/* Bottom Section */}
            <View style={styles.bottomSection}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onCreateAccount}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryButtonText}>Comenzar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onRecoverAccount}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>
                  Ya tengo una cuenta
                </Text>
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                Al continuar, aceptas nuestros términos de servicio
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const FeatureChip: React.FC<{ icon: string; text: string }> = ({ text }) => (
  <View style={styles.chip}>
    <View style={styles.chipDot} />
    <Text style={styles.chipText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingTop: height * 0.08,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoText: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.text.inverse,
  },
  title: {
    ...typography.display,
    color: colors.text.inverse,
    marginBottom: spacing.sm,
    letterSpacing: -1,
  },
  tagline: {
    ...typography.h3,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 28,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.inverse,
    marginRight: spacing.sm,
  },
  chipText: {
    ...typography.smallMedium,
    color: colors.text.inverse,
  },
  bottomSection: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.text.inverse,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonText: {
    ...typography.bodySemibold,
    color: colors.primary[700],
    fontSize: 17,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  secondaryButtonText: {
    ...typography.bodySemibold,
    color: colors.text.inverse,
  },
  disclaimer: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
