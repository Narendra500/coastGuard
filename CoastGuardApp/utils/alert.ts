import { Platform, Alert } from 'react-native';

type AlertOptions = {
    title?: string;
    message: string;
};

export function showAlert({ title = 'Alert', message }: AlertOptions) {
    if (Platform.OS === 'web') {
        window.alert(title ? `${title}\n\n${message}` : message);
    } else {
        Alert.alert(title, message);
    }
}
