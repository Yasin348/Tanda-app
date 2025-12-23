import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Button, Card } from '../../components';

interface VerifySeedScreenProps {
  seed: string;
  onContinue: () => void;
  onBack: () => void;
}

// Generar 2 índices aleatorios diferentes (0-11)
const generateRandomIndices = (): number[] => {
  const indices: number[] = [];
  while (indices.length < 2) {
    const randomIndex = Math.floor(Math.random() * 12);
    if (!indices.includes(randomIndex)) {
      indices.push(randomIndex);
    }
  }
  return indices.sort((a, b) => a - b);
};

export const VerifySeedScreen: React.FC<VerifySeedScreenProps> = ({
  seed,
  onContinue,
  onBack,
}) => {
  const words = useMemo(() => seed.split(' '), [seed]);
  // Generar índices aleatorios una sola vez al montar el componente
  const verifyIndices = useMemo(() => generateRandomIndices(), []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean[]>([false, false]);

  // Generar opciones aleatorias para la palabra actual
  const options = useMemo(() => {
    const targetIndex = verifyIndices[currentIndex];
    const correctWord = words[targetIndex];

    // Seleccionar 3 palabras aleatorias del seed (diferentes a la correcta)
    const otherWords = words.filter((_, i) => i !== targetIndex);
    const shuffled = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);

    // Mezclar la correcta con las otras
    const allOptions = [...shuffled, correctWord].sort(() => Math.random() - 0.5);
    return allOptions;
  }, [words, currentIndex, verifyIndices]);

  const handleSelectWord = (word: string) => {
    setSelectedWord(word);
    setError(null);
  };

  const handleVerify = () => {
    const targetIndex = verifyIndices[currentIndex];
    const correctWord = words[targetIndex];

    if (selectedWord === correctWord) {
      const newVerified = [...verified];
      newVerified[currentIndex] = true;
      setVerified(newVerified);

      if (currentIndex < verifyIndices.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedWord(null);
      } else {
        onContinue();
      }
    } else {
      setError('Palabra incorrecta. Revisa tus 12 palabras e intenta de nuevo.');
      setSelectedWord(null);
    }
  };

  const currentWordNumber = verifyIndices[currentIndex] + 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>🔍</Text>
          <Text style={styles.title}>Verifica tus palabras</Text>
          <Text style={styles.subtitle}>
            Confirma que guardaste correctamente tus palabras
          </Text>
        </View>

        <View style={styles.progress}>
          {verifyIndices.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= currentIndex && styles.progressDotActive,
                verified[index] && styles.progressDotComplete,
              ]}
            />
          ))}
        </View>

        <Card variant="elevated" style={styles.questionCard}>
          <Text style={styles.questionLabel}>
            ¿Cuál es la palabra #{currentWordNumber}?
          </Text>

          <View style={styles.options}>
            {options.map((word, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.option,
                  selectedWord === word && styles.optionSelected,
                ]}
                onPress={() => handleSelectWord(word)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedWord === word && styles.optionTextSelected,
                  ]}
                >
                  {word}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </Card>

        <Card variant="outlined" style={styles.hintCard}>
          <Text style={styles.hintIcon}>💡</Text>
          <Text style={styles.hintText}>
            Si no recuerdas, vuelve atrás y revisa tus 12 palabras
          </Text>
        </Card>
      </ScrollView>

      <View style={styles.buttons}>
        <Button
          title="Verificar"
          onPress={handleVerify}
          size="large"
          disabled={!selectedWord}
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
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  progressDotActive: {
    backgroundColor: '#3b82f6',
  },
  progressDotComplete: {
    backgroundColor: '#22c55e',
  },
  questionCard: {
    padding: 24,
    marginBottom: 20,
  },
  questionLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 24,
  },
  options: {
    gap: 12,
  },
  option: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#475569',
  },
  optionTextSelected: {
    color: '#3b82f6',
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  hintIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
  },
  buttons: {
    padding: 24,
    gap: 12,
  },
});
