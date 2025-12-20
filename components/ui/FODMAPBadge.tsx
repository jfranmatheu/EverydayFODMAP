import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FODMAPLevel } from '@/lib/types';

interface FODMAPBadgeProps {
  level: FODMAPLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  style?: ViewStyle;
}

const FODMAP_LABELS: Record<FODMAPLevel, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};

export function FODMAPBadge({ level, size = 'md', showLabel = true, style }: FODMAPBadgeProps) {
  const { colors } = useTheme();

  const getColor = () => {
    switch (level) {
      case 'low':
        return colors.fodmapLow;
      case 'medium':
        return colors.fodmapMedium;
      case 'high':
        return colors.fodmapHigh;
    }
  };

  const getSizeStyles = (): { container: ViewStyle; dot: ViewStyle; fontSize: number } => {
    switch (size) {
      case 'sm':
        return {
          container: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
          dot: { width: 6, height: 6, borderRadius: 3 },
          fontSize: 10,
        };
      case 'lg':
        return {
          container: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
          dot: { width: 12, height: 12, borderRadius: 6 },
          fontSize: 14,
        };
      default:
        return {
          container: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
          dot: { width: 8, height: 8, borderRadius: 4 },
          fontSize: 12,
        };
    }
  };

  const color = getColor();
  const sizeStyles = getSizeStyles();

  if (!showLabel) {
    return (
      <View
        style={[
          sizeStyles.dot,
          { backgroundColor: color },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: color + '20',
          ...sizeStyles.container,
        },
        style,
      ]}
    >
      <View style={[sizeStyles.dot, { backgroundColor: color }]} />
      <Text
        style={{
          color: color,
          fontSize: sizeStyles.fontSize,
          fontWeight: '600',
        }}
      >
        {FODMAP_LABELS[level]}
      </Text>
    </View>
  );
}

