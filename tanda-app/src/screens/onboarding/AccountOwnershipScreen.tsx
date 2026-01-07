import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Button } from '../../components';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

interface AccountOwnershipScreenProps {
  onContinue: () => void;
  onBack: () => void;
}

export const AccountOwnershipScreen: React.FC<AccountOwnershipScreenProps> = ({
  onContinue,
  onBack,
}) => {
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
              <Text style={styles.icon}>🔐</Text>
            </View>
            <Text style={styles.title}>Tu cuenta es{'\n'}solo tuya</Text>
            <Text style={styles.subtitle}>
              Esto es importante, tómate un momento para leerlo
            </Text>
          </View>

          {/* Info Cards */}
          <View style={styles.cards}>
            <InfoCard
              icon="✅"
              iconBg={colors.success + '15'}
              title="Tú tienes el control total"
              description="Solo tú puedes acceder a tu cuenta. Ni nosotros ni nadie más puede ver tu dinero o hacer transacciones por ti."
            />

            <InfoCard
              icon="🔑"
              iconBg={colors.primary[100]}
              title="12 palabras secretas"
              description="Te daremos 12 palabras que son la llave de tu cuenta. Guárdalas en un lugar seguro. Si las pierdes, perderás acceso para siempre."
            />

            <InfoCard
              icon="⚠️"
              iconBg="#fef3c7"
              title="Muy importante"
              description="Nunca compartas tus 12 palabras con nadie. Nadie de nuestro equipo te las pedirá jamás. Quien las tenga, controla tu cuenta."
              highlight
            />
          </View>
        </ScrollView>

        {/* Buttons */}
        <View style={styles.buttons}>
          <Button
            title="Entendido, continuar"
            onPress={onContinue}
            size="large"
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

const InfoCard: React.FC<{
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  highlight?: boolean;
}> = ({ icon, iconBg, title, description, highlight }) => (
  <View style={[styles.card, highlight && styles.cardHighlight]}>
    <View style={[styles.cardIcon, { backgroundColor: iconBg }]}>
      <Text style={styles.cardIconText}>{icon}</Text>
    </View>
    <View style={styles.cardContent}>
      <Text style={[styles.cardTitle, highlight && styles.cardTitleHighlight]}>
        {title}
      </Text>
      <Text style={[styles.cardDescription, highlight && styles.cardDescriptionHighlight]}>
        {description}
      </Text>
    </View>
  </View>
);

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
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  cardHighlight: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardIconText: {
    fontSize: 22,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardTitleHighlight: {
    color: '#92400e',
  },
  cardDescription: {
    ...typography.small,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  cardDescriptionHighlight: {
    color: '#a16207',
  },
  buttons: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
