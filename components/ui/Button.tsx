import React from 'react';
import { Pressable, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    const baseContainer: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      gap: 8,
    };

    switch (variant) {
      case 'primary':
        return {
          container: {
            ...baseContainer,
            backgroundColor: disabled ? colors.textMuted : colors.primary,
          },
          text: { color: '#FFFFFF', fontWeight: '600' },
        };
      case 'secondary':
        return {
          container: {
            ...baseContainer,
            backgroundColor: isDark ? colors.cardElevated : colors.primaryLight + '20',
          },
          text: { color: colors.primary, fontWeight: '600' },
        };
      case 'outline':
        return {
          container: {
            ...baseContainer,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: disabled ? colors.textMuted : colors.primary,
          },
          text: { color: disabled ? colors.textMuted : colors.primary, fontWeight: '600' },
        };
      case 'ghost':
        return {
          container: {
            ...baseContainer,
            backgroundColor: 'transparent',
          },
          text: { color: disabled ? colors.textMuted : colors.primary, fontWeight: '600' },
        };
      case 'danger':
        return {
          container: {
            ...baseContainer,
            backgroundColor: disabled ? colors.textMuted : colors.error,
          },
          text: { color: '#FFFFFF', fontWeight: '600' },
        };
      default:
        return {
          container: baseContainer,
          text: { color: colors.text, fontWeight: '600' },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: { paddingHorizontal: 12, paddingVertical: 8 },
          text: { fontSize: 14 },
        };
      case 'lg':
        return {
          container: { paddingHorizontal: 24, paddingVertical: 16 },
          text: { fontSize: 18 },
        };
      default:
        return {
          container: { paddingHorizontal: 16, paddingVertical: 12 },
          text: { fontSize: 16 },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle: ViewStyle = {
    ...variantStyles.container,
    ...sizeStyles.container,
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? '100%' : undefined,
    ...style,
  };

  const textStyle: TextStyle = {
    ...variantStyles.text,
    ...sizeStyles.text,
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[containerStyle, animatedStyle]}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary} 
        />
      ) : (
        <>
          {leftIcon}
          <Text style={textStyle}>{children}</Text>
          {rightIcon}
        </>
      )}
    </AnimatedPressable>
  );
}

