import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Mail, ArrowRight, ArrowLeft, Lock, KeyRound } from 'lucide-react-native';
import { COLORS, GRADIENTS } from '../../components/reels/constants';
import { useSignIn } from '@clerk/clerk-expo';

type Step = 'email' | 'code' | 'newPassword';

export default function ForgotPasswordScreen() {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { signIn, setActive } = useSignIn();

    const handleSendCode = async () => {
        if (!email) {
            Alert.alert('خطأ', 'يرجى إدخال البريد الإلكتروني');
            return;
        }

        setIsLoading(true);
        try {
            await signIn?.create({
                strategy: 'reset_password_email_code',
                identifier: email,
            });
            setStep('code');
            Alert.alert('تم الإرسال', 'تم إرسال رمز التحقق إلى بريدك الإلكتروني');
        } catch (error: any) {
            console.error('Send code error:', error);
            const errorMessage = error.errors?.[0]?.message || 'حدث خطأ أثناء إرسال الرمز';
            Alert.alert('خطأ', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!code || code.length < 6) {
            Alert.alert('خطأ', 'يرجى إدخال رمز التحقق المكون من 6 أرقام');
            return;
        }

        setIsLoading(true);
        try {
            const result = await signIn?.attemptFirstFactor({
                strategy: 'reset_password_email_code',
                code,
            });

            if (result?.status === 'needs_new_password') {
                setStep('newPassword');
            }
        } catch (error: any) {
            console.error('Verify code error:', error);
            const errorMessage = error.errors?.[0]?.message || 'رمز التحقق غير صحيح';
            Alert.alert('خطأ', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };


    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 8) {
            Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين');
            return;
        }

        setIsLoading(true);
        try {
            const result = await signIn?.resetPassword({
                password: newPassword,
            });

            if (result?.status === 'complete' && setActive) {
                await setActive({ session: result.createdSessionId });
                Alert.alert('تم بنجاح', 'تم تغيير كلمة المرور بنجاح', [
                    { text: 'حسناً', onPress: () => router.replace('/(tabs)/Home') }
                ]);
            }
        } catch (error: any) {
            console.error('Reset password error:', error);
            const errorMessage = error.errors?.[0]?.message || 'حدث خطأ أثناء تغيير كلمة المرور';
            Alert.alert('خطأ', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const renderEmailStep = () => (
        <>
            <Text style={styles.title}>نسيت كلمة المرور؟</Text>
            <Text style={styles.subtitle}>
                أدخل بريدك الإلكتروني وسنرسل لك رمز التحقق
            </Text>

            <View style={styles.inputWrapper}>
                <Mail color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="البريد الإلكتروني"
                    placeholderTextColor={COLORS.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSendCode}
                disabled={isLoading}
            >
                <LinearGradient
                    colors={GRADIENTS.greenGlow}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.deepBlack} />
                    ) : (
                        <>
                            <Text style={styles.submitText}>إرسال الرمز</Text>
                            <ArrowRight color={COLORS.deepBlack} size={20} />
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </>
    );

    const renderCodeStep = () => (
        <>
            <Text style={styles.title}>أدخل رمز التحقق</Text>
            <Text style={styles.subtitle}>
                تم إرسال رمز مكون من 6 أرقام إلى {email}
            </Text>

            <View style={styles.inputWrapper}>
                <KeyRound color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
                <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="000000"
                    placeholderTextColor={COLORS.textTertiary}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                />
            </View>

            <TouchableOpacity
                style={styles.submitButton}
                onPress={handleVerifyCode}
                disabled={isLoading}
            >
                <LinearGradient
                    colors={GRADIENTS.greenGlow}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.deepBlack} />
                    ) : (
                        <>
                            <Text style={styles.submitText}>تحقق</Text>
                            <ArrowRight color={COLORS.deepBlack} size={20} />
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSendCode} disabled={isLoading}>
                <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
            </TouchableOpacity>
        </>
    );


    const renderNewPasswordStep = () => (
        <>
            <Text style={styles.title}>كلمة مرور جديدة</Text>
            <Text style={styles.subtitle}>
                أدخل كلمة المرور الجديدة
            </Text>

            <View style={styles.inputWrapper}>
                <Lock color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="كلمة المرور الجديدة"
                    placeholderTextColor={COLORS.textTertiary}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                />
            </View>

            <View style={styles.inputWrapper}>
                <Lock color={COLORS.textTertiary} size={20} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="تأكيد كلمة المرور"
                    placeholderTextColor={COLORS.textTertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                />
            </View>

            <TouchableOpacity
                style={styles.submitButton}
                onPress={handleResetPassword}
                disabled={isLoading}
            >
                <LinearGradient
                    colors={GRADIENTS.greenGlow}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.deepBlack} />
                    ) : (
                        <>
                            <Text style={styles.submitText}>تغيير كلمة المرور</Text>
                            <ArrowRight color={COLORS.deepBlack} size={20} />
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <LinearGradient
                colors={[COLORS.deepBlack, '#0a1f0a', COLORS.deepBlack]}
                style={StyleSheet.absoluteFill}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        if (step === 'email') {
                            router.back();
                        } else if (step === 'code') {
                            setStep('email');
                        } else {
                            setStep('code');
                        }
                    }}
                >
                    <ArrowLeft color={COLORS.white} size={24} />
                </TouchableOpacity>

                <View style={styles.content}>
                    {step === 'email' && renderEmailStep()}
                    {step === 'code' && renderCodeStep()}
                    {step === 'newPassword' && renderNewPasswordStep()}
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.deepBlack,
    },
    keyboardView: {
        flex: 1,
    },
    backButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.white,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 54,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: COLORS.white,
        fontSize: 16,
        textAlign: 'right',
    },
    codeInput: {
        textAlign: 'center',
        fontSize: 24,
        letterSpacing: 8,
    },
    submitButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    submitText: {
        color: COLORS.deepBlack,
        fontSize: 16,
        fontWeight: 'bold',
    },
    resendText: {
        color: COLORS.neonGreen,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 16,
    },
});
