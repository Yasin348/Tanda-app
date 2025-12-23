import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Button } from '../../components';
import { stellarService } from '../../services/stellar';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { alertMessage } from '../../utils/alert';

interface SeedPhraseScreenProps {
  onContinue: (seed: string) => void;
  onBack: () => void;
}

export const SeedPhraseScreen: React.FC<SeedPhraseScreenProps> = ({
  onContinue,
  onBack,
}) => {
  const [seed, setSeed] = useState<string>('');
  const [words, setWords] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    generateSeed();
  }, []);

  const generateSeed = () => {
    const newSeed = stellarService.generateMnemonic();
    setSeed(newSeed);
    setWords(newSeed.split(' '));
  };

  const handleContinue = () => {
    if (!confirmed) {
      alertMessage(
        'Confirma que las guardaste',
        'Debes marcar que guardaste tus palabras antes de continuar.'
      );
      return;
    }
    onContinue(seed);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔑</Text>
            </View>
            <Text style={styles.title}>Tu frase secreta</Text>
            <Text style={styles.subtitle}>
              Estas 12 palabras son la única forma de recuperar tu cuenta
            </Text>
          </View>

          {/* Seed Words Grid */}
          <View style={styles.seedContainer}>
            <View style={styles.seedGrid}>
              {words.map((word, index) => (
                <View key={index} style={styles.wordCard}>
                  <Text style={styles.wordNumber}>{index + 1}</Text>
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.regenerateButton}
              onPress={generateSeed}
              activeOpacity={0.7}
            >
              <Text style={styles.regenerateIcon}>🔄</Text>
              <Text style={styles.regenerateText}>Generar nuevas palabras</Text>
            </TouchableOpacity>
          </View>

          {/* Warning */}
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningTitle}>Importante</Text>
            </View>
            <Text style={styles.warningText}>
              • Escríbelas en papel, NO en tu teléfono{'\n'}
              • Guárdalas en un lugar seguro{'\n'}
              • Nunca las compartas con nadie{'\n'}
              • Si las pierdes, perderás tu cuenta
            </Text>
          </View>

          {/* Confirmation Checkbox */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setConfirmed(!confirmed)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
              {confirmed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              Las anoté en papel y las guardé en un lugar seguro
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Buttons */}
        <View style={styles.buttons}>
          <Button
            title="Continuar"
            onPress={handleContinue}
            size="large"
            disabled={!confirmed}
          />
          <Button
            title="Volver"
            onPress={onBack}
            variant="ghost"
            size="large"
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  seedContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  wordCard: {
    width: '31%',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  wordNumber: {
    ...typography.caption,
    color: colors.text.tertiary,
    width: 20,
  },
  wordText: {
    ...typography.smallMedium,
    color: colors.text.primary,
    flex: 1,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  regenerateIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  regenerateText: {
    ...typography.smallMedium,
    color: colors.primary[500],
  },
  warningCard: {
    backgroundColor: '#fffbeb',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  warningTitle: {
    ...typography.bodySemibold,
    color: '#92400e',
  },
  warningText: {
    ...typography.small,
    color: '#92400e',
    lineHeight: 22,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.gray[300],
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  checkmark: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
  },
  buttons: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
