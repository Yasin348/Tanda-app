/**
 * KYC Screen - Simplified for Mykobo Integration
 *
 * All KYC verification is handled by Mykobo during the deposit/withdrawal flow.
 * This screen just informs users and redirects them to deposit.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';

interface KYCScreenProps {
  navigation: any;
}

export const KYCScreen: React.FC<KYCScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backButton}>
          <Text style={s.backButtonText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Verificacion KYC</Text>
      </View>

      <View style={s.content}>
        <View style={s.iconContainer}>
          <Text style={s.icon}>🪪</Text>
        </View>

        <Text style={s.title}>Verificacion integrada</Text>

        <Text style={s.description}>
          La verificacion de identidad (KYC) se realiza automaticamente cuando haces tu primer deposito a traves de Mykobo.
        </Text>

        <View style={s.stepsCard}>
          <Text style={s.stepsTitle}>Como funciona:</Text>

          <View style={s.step}>
            <View style={s.stepNumber}>
              <Text style={s.stepNumberText}>1</Text>
            </View>
            <View style={s.stepContent}>
              <Text style={s.stepText}>Ve a Depositar EUR</Text>
            </View>
          </View>

          <View style={s.step}>
            <View style={s.stepNumber}>
              <Text style={s.stepNumberText}>2</Text>
            </View>
            <View style={s.stepContent}>
              <Text style={s.stepText}>Mykobo te pedira verificar tu identidad</Text>
              <Text style={s.stepHint}>Solo la primera vez</Text>
            </View>
          </View>

          <View style={s.step}>
            <View style={[s.stepNumber, { backgroundColor: '#2f9e44' }]}>
              <Text style={s.stepNumberText}>3</Text>
            </View>
            <View style={s.stepContent}>
              <Text style={s.stepText}>Listo! Ya puedes operar sin limites</Text>
            </View>
          </View>
        </View>

        <View style={s.infoBox}>
          <Text style={s.infoTitle}>Que necesitaras:</Text>
          <Text style={s.infoItem}>• Documento de identidad (DNI o pasaporte)</Text>
          <Text style={s.infoItem}>• Selfie para verificacion facial</Text>
          <Text style={s.infoItem}>• 2-3 minutos de tu tiempo</Text>
        </View>

        <TouchableOpacity
          style={s.depositButton}
          onPress={() => navigation.navigate('Deposit')}
        >
          <Text style={s.depositButtonText}>Ir a Depositar</Text>
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Tu informacion es procesada de forma segura por Mykobo,
          regulado por el Banco de Lituania.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#212529' },
  backButton: { position: 'absolute', left: 16 },
  backButtonText: { fontSize: 16, color: '#6366f1', fontWeight: '500' },

  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },

  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e7f5ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  icon: { fontSize: 48 },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 16,
    textAlign: 'center',
  },

  description: {
    fontSize: 16,
    color: '#868e96',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },

  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepNumberText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stepContent: { flex: 1 },
  stepText: { fontSize: 15, color: '#212529', fontWeight: '500' },
  stepHint: { fontSize: 13, color: '#868e96', marginTop: 2 },

  infoBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 12,
  },
  infoItem: {
    fontSize: 14,
    color: '#78350f',
    marginBottom: 6,
    lineHeight: 20,
  },

  depositButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginBottom: 16,
  },
  depositButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  disclaimer: {
    fontSize: 12,
    color: '#adb5bd',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 24,
  },
});
