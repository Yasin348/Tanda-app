import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Button, Card } from '../../components';
import { stellarService } from '../../services/stellar';

interface RecoverAccountScreenProps {
  onRecover: (seed: string) => void;
  onBack: () => void;
}

export const RecoverAccountScreen: React.FC<RecoverAccountScreenProps> = ({
  onRecover,
  onBack,
}) => {
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleWordChange = (index: number, value: string) => {
    // Limpiar y normalizar la entrada
    const cleanValue = value.toLowerCase().trim();

    // Si se pega texto con múltiples palabras
    if (cleanValue.includes(' ')) {
      const pastedWords = cleanValue.split(/\s+/).filter(w => w.length > 0);
      const newWords = [...words];

      pastedWords.forEach((word, i) => {
        if (index + i < 12) {
          newWords[index + i] = word;
        }
      });

      setWords(newWords);
      return;
    }

    const newWords = [...words];
    newWords[index] = cleanValue;
    setWords(newWords);
    setError(null);
  };

  const handleRecover = async () => {
    // Verificar que todas las palabras estén completas
    const emptyIndices = words
      .map((w, i) => (w.trim() === '' ? i + 1 : null))
      .filter((i) => i !== null);

    if (emptyIndices.length > 0) {
      setError(`Faltan las palabras: ${emptyIndices.join(', ')}`);
      return;
    }

    const seed = words.join(' ');

    setIsLoading(true);
    setError(null);

    try {
      // Intentar crear cuenta con el seed para verificar validez
      stellarService.initializeFromSeed(seed);
      onRecover(seed);
    } catch (err) {
      setError('Las palabras ingresadas no son válidas. Revísalas e intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderWordInput = (index: number) => (
    <View key={index} style={styles.wordInputContainer}>
      <Text style={styles.wordNumber}>{index + 1}</Text>
      <TextInput
        style={styles.wordInput}
        value={words[index]}
        onChangeText={(value) => handleWordChange(index, value)}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="palabra"
        placeholderTextColor="#94a3b8"
      />
    </View>
  );

  // Crear filas de 3 palabras
  const rows = [];
  for (let i = 0; i < 12; i += 3) {
    rows.push([i, i + 1, i + 2]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>🔄</Text>
          <Text style={styles.title}>Recuperar cuenta</Text>
          <Text style={styles.subtitle}>
            Ingresa tus 12 palabras secretas en orden
          </Text>
        </View>

        <Card variant="outlined" style={styles.inputsCard}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((index) => renderWordInput(index))}
            </View>
          ))}
        </Card>

        {error && (
          <Card variant="outlined" style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}

        <Card variant="outlined" style={styles.hintCard}>
          <Text style={styles.hintIcon}>💡</Text>
          <Text style={styles.hintText}>
            Puedes pegar todas las palabras de una vez en el primer campo
          </Text>
        </Card>
      </ScrollView>

      <View style={styles.buttons}>
        <Button
          title="Recuperar cuenta"
          onPress={handleRecover}
          size="large"
          loading={isLoading}
          disabled={words.some((w) => w.trim() === '')}
        />
        <Button
          title="Volver"
          onPress={onBack}
          variant="secondary"
          size="large"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  inputsCard: {
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  wordInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
  },
  wordNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    width: 20,
  },
  wordInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  hintIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: '#0369a1',
  },
  buttons: {
    padding: 24,
    gap: 12,
  },
});
