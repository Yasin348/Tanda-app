import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface ExistingAccountScreenProps {
  hasLocalAccount: boolean;
  onLoginWithPin: () => void;
  onRecoverWithSeed: () => void;
  onBack: () => void;
}

export const ExistingAccountScreen: React.FC<ExistingAccountScreenProps> = ({
  hasLocalAccount,
  onLoginWithPin,
  onRecoverWithSeed,
  onBack,
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
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>👋</Text>
              </View>
              <Text style={styles.title}>¡Bienvenido de nuevo!</Text>
              <Text style={styles.subtitle}>
                ¿Cómo quieres acceder a tu cuenta?
              </Text>
            </View>

            {/* Options */}
            <View style={styles.options}>
              {hasLocalAccount && (
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={onLoginWithPin}
                  activeOpacity={0.9}
                >
                  <View style={styles.optionIconContainer}>
                    <Text style={styles.optionIcon}>🔢</Text>
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Entrar con PIN</Text>
                    <Text style={styles.optionDescription}>
                      Usa el PIN que configuraste en este dispositivo
                    </Text>
                  </View>
                  <Text style={styles.optionArrow}>→</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.optionCard, !hasLocalAccount && styles.optionCardPrimary]}
                onPress={onRecoverWithSeed}
                activeOpacity={0.9}
              >
                <View style={styles.optionIconContainer}>
                  <Text style={styles.optionIcon}>🔑</Text>
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Recuperar con frase</Text>
                  <Text style={styles.optionDescription}>
                    Ingresa tus 12 palabras secretas
                  </Text>
                </View>
                <Text style={styles.optionArrow}>→</Text>
              </TouchableOpacity>

              {hasLocalAccount && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoIcon}>💡</Text>
                  <Text style={styles.infoText}>
                    El PIN solo funciona en el dispositivo donde lo configuraste.
                    Si es otro dispositivo, usa tu frase de recuperación.
                  </Text>
                </View>
              )}
            </View>

            {/* Back Button */}
            <View style={styles.bottomSection}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={onBack}
                activeOpacity={0.8}
              >
                <Text style={styles.backButtonText}>← Volver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.inverse,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  options: {
    flex: 1,
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.text.inverse,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  optionCardPrimary: {
    backgroundColor: colors.text.inverse,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  optionArrow: {
    fontSize: 20,
    color: colors.primary[500],
    marginLeft: spacing.sm,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  bottomSection: {
    marginTop: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    ...typography.bodySemibold,
    color: colors.text.inverse,
  },
});
