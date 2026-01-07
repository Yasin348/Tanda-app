import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SeedWordGridProps {
  words: string[];
  selectable?: boolean;
  selectedWords?: number[];
  onWordSelect?: (index: number) => void;
  showNumbers?: boolean;
  highlightIndices?: number[];
}

export const SeedWordGrid: React.FC<SeedWordGridProps> = ({
  words,
  selectable = false,
  selectedWords = [],
  onWordSelect,
  showNumbers = true,
  highlightIndices = [],
}) => {
  const renderWord = (word: string, index: number) => {
    const isSelected = selectedWords.includes(index);
    const isHighlighted = highlightIndices.includes(index);

    const wordContent = (
      <View
        style={[
          styles.wordContainer,
          isSelected && styles.wordSelected,
          isHighlighted && styles.wordHighlighted,
        ]}
      >
        {showNumbers && (
          <Text
            style={[
              styles.wordNumber,
              isSelected && styles.wordNumberSelected,
              isHighlighted && styles.wordNumberHighlighted,
            ]}
          >
            {index + 1}
          </Text>
        )}
        <Text
          style={[
            styles.word,
            isSelected && styles.wordTextSelected,
            isHighlighted && styles.wordTextHighlighted,
          ]}
        >
          {word}
        </Text>
      </View>
    );

    if (selectable && onWordSelect) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => onWordSelect(index)}
          activeOpacity={0.7}
          style={styles.wordWrapper}
        >
          {wordContent}
        </TouchableOpacity>
      );
    }

    return (
      <View key={index} style={styles.wordWrapper}>
        {wordContent}
      </View>
    );
  };

  // Dividir en filas de 3
  const rows = [];
  for (let i = 0; i < words.length; i += 3) {
    rows.push(words.slice(i, i + 3));
  }

  return (
    <View style={styles.container}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((word, colIndex) => renderWord(word, rowIndex * 3 + colIndex))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordWrapper: {
    flex: 1,
  },
  wordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wordSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  wordHighlighted: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  wordNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 8,
    minWidth: 20,
  },
  wordNumberSelected: {
    color: '#bfdbfe',
  },
  wordNumberHighlighted: {
    color: '#d97706',
  },
  word: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  wordTextSelected: {
    color: '#fff',
  },
  wordTextHighlighted: {
    color: '#92400e',
  },
});
