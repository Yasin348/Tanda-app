// Helper para alertas cross-platform (Web + Native)
import { Alert, Platform } from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export const showAlert = (
  title: string,
  message: string,
  buttons?: AlertButton[]
) => {
  if (Platform.OS === 'web') {
    // En web, usar alert/confirm nativos del navegador
    if (!buttons || buttons.length === 0) {
      window.alert(`${title}\n\n${message}`);
    } else if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      buttons[0].onPress?.();
    } else {
      // Si hay botón cancel y otro botón, usar confirm
      const cancelButton = buttons.find(b => b.style === 'cancel');
      const actionButton = buttons.find(b => b.style !== 'cancel');

      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && actionButton) {
        actionButton.onPress?.();
      } else if (!confirmed && cancelButton) {
        cancelButton.onPress?.();
      }
    }
  } else {
    // En native, usar Alert normal
    Alert.alert(title, message, buttons);
  }
};

// Versión simplificada para mensajes simples
export const alertMessage = (title: string, message: string, onOk?: () => void) => {
  showAlert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
};

// Versión para confirmación
export const confirmAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  showAlert(title, message, [
    { text: 'Cancelar', style: 'cancel', onPress: onCancel },
    { text: 'Confirmar', onPress: onConfirm },
  ]);
};
