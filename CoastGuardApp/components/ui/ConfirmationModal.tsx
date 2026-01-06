import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ConfirmationModalProps = {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDestructive?: boolean; // If true, confirm button is red
};

export default function ConfirmationModal({
    visible,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    isDestructive = false,
}: ConfirmationModalProps) {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onCancel}
        >
            <View className="flex-1 items-center justify-center bg-black/70 px-4">
                {/* Modal Container */}
                <View className="w-full max-w-sm bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">

                    {/* Header */}
                    <View className="p-6 border-b border-gray-700/50">
                        <View className="flex-row items-center gap-3 mb-2">
                            {isDestructive && <Ionicons name="warning" size={24} color="#ef4444" />}
                            <Text className="text-xl font-bold text-white flex-1">
                                {title}
                            </Text>
                        </View>
                        <Text className="text-gray-400 leading-6">
                            {message}
                        </Text>
                    </View>

                    {/* Footer Buttons */}
                    <View className="flex-row p-4 gap-3 bg-gray-900/50">
                        <TouchableOpacity
                            onPress={onCancel}
                            className="flex-1 bg-gray-700 py-3 rounded-xl items-center"
                        >
                            <Text className="text-gray-300 font-bold">{cancelText}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onConfirm}
                            className={`flex-1 py-3 rounded-xl items-center ${isDestructive ? 'bg-red-600' : 'bg-blue-600'}`}
                        >
                            <Text className="text-white font-bold">{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
