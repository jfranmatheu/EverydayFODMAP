import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, Text, View } from 'react-native';

interface ImagePickerButtonProps {
  imageUri: string | null;
  onImageSelected: (uri: string | null) => void;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
}

export function ImagePickerButton({ 
  imageUri, 
  onImageSelected, 
  height = 140,
  placeholder = 'Añadir imagen',
  disabled = false,
}: ImagePickerButtonProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permisos necesarios',
          'Necesitamos acceso a tu cámara y galería para añadir imágenes.'
        );
        return false;
      }
    }
    return true;
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      setLoading(true);
      
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      };

      let result;
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    } finally {
      setLoading(false);
    }
  };

  const showImageOptions = () => {
    if (disabled) return;
    
    if (Platform.OS === 'web') {
      // On web, just open the gallery
      pickImage(false);
    } else {
      // On mobile, show options
      Alert.alert(
        'Seleccionar imagen',
        '¿De dónde quieres obtener la imagen?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: '📷 Cámara', onPress: () => pickImage(true) },
          { text: '🖼️ Galería', onPress: () => pickImage(false) },
          ...(imageUri ? [{ text: '🗑️ Eliminar', style: 'destructive' as const, onPress: () => onImageSelected(null) }] : []),
        ]
      );
    }
  };

  return (
    <Pressable 
      onPress={showImageOptions}
      disabled={disabled || loading}
      style={{
        height,
        backgroundColor: colors.cardElevated,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: imageUri ? colors.primary + '40' : colors.border,
        borderStyle: imageUri ? 'solid' : 'dashed',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
            Cargando...
          </Text>
        </View>
      ) : imageUri ? (
        <View style={{ flex: 1 }}>
          <Image 
            source={{ uri: imageUri }} 
            style={{ 
              width: '100%', 
              height: '100%',
              resizeMode: 'cover',
            }} 
          />
          {!disabled && (
            <View style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              flexDirection: 'row',
              gap: 8,
            }}>
              <View style={{
                backgroundColor: colors.surface + 'E0',
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
                <Ionicons name="pencil" size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                  Cambiar
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="camera-outline" size={36} color={colors.textMuted} />
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
            {placeholder}
          </Text>
          {Platform.OS !== 'web' && (
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              Toca para usar cámara o galería
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

