import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type AlertModalProps = {
    visible: boolean;
    title?: string;
    message: string;
    onClose: () => void;
};

export default function AlertModal({
    visible,
    title = 'Alert',
    message,
    onClose,
}: AlertModalProps) {
    if (!visible) return null;

    return (
        <View className="absolute inset-0 z-50 items-center justify-center">
            {/* Backdrop */}
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                className="absolute inset-0 bg-black/60"
            />

            {/* Modal */}
            <View className="w-[85%] max-w-md rounded-2xl bg-gray-800 p-6 border border-gray-700 shadow-xl">
                {/* Close button */}
                <TouchableOpacity
                    onPress={onClose}
                    className="absolute right-3 top-3 p-1"
                >
                    <Ionicons name="close" size={20} color="#9ca3af" />
                </TouchableOpacity>

                {/* Title */}
                <Text className="text-xl font-bold text-white mb-3">
                    {title}
                </Text>

                {/* Message */}
                <Text className="text-gray-300 leading-6">
                    {message}
                </Text>
            </View>
        </View>
    );
}
