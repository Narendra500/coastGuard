import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { showAlert } from '@/utils/alert';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const login = useAuthStore((state) => state.login);

    const handleLogin = async () => {
        if (!email || !password) {
            showAlert({ title: 'Error', message: 'Please fill in all fields' });
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await api.post('/auth/login', {
                email: email,
                password: password
            });

            const { user_id: userID, access_token: accessToken, refresh_token: refreshToken, user_name: userName, user_role: role } = response.data;

            await login(accessToken, refreshToken, { userID, userName, role });

        } catch (error: any) {
            const msg = error.response?.data?.message || 'Login failed';
            showAlert({ title: 'Error', message: msg });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View className="flex-1 bg-gray-900 justify-center items-center px-6">
            <View className="mb-10">
                <Text className="text-center md:text-6xl text-5xl font-bold text-blue-500 mb-2">CoastGuard</Text>
                <Text className="text-center md:text-3xl text-gray-400 text-lg">Situational awareness for everyone.</Text>
            </View>

            <View className="md:mx-96 w-full md:w-1/2">
                <View>
                    <Text className="md:text-2xl text-xl text-gray-300 mb-1 ml-1">Email</Text>
                    <TextInput
                        className="w-full bg-gray-800 text-white md:text-xl p-4 mb-4 rounded-xl border border-gray-700 focus:border-blue-500"
                        placeholder="citizen@example.com"
                        placeholderTextColor="#6b7280"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>

                <View className='mt-4'>
                    <Text className="md:text-2xl text-xl text-gray-300 mb-1 ml-1">Password</Text>
                    <TextInput
                        className="w-full bg-gray-800 text-white md:text-xl p-4 rounded-xl border border-gray-700 focus:border-blue-500"
                        placeholder="••••••••"
                        placeholderTextColor="#6b7280"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>

                <TouchableOpacity
                    className="w-full bg-blue-600 p-4 rounded-xl hover:bg-blue-500 items-center mt-8 md:my-16"
                    onPress={handleLogin}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text className="md:text-xl text-white font-bold text-lg">Log In</Text>
                    )}
                </TouchableOpacity>

                <View className="flex-row justify-center mt-8">
                    <Text className="text-xl text-gray-400">Don't have an account? </Text>
                    <Link href="/(auth)/register" asChild>
                        <TouchableOpacity>
                            <Text className="text-xl text-blue-400 font-bold">Sign Up</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </View>
    );
}
