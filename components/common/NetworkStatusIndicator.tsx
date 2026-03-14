/**
 * Network Status Indicator
 * مؤشر حالة الشبكة والاتصال
 * 
 * يعرض:
 * 1. حالة الاتصال بالإنترنت
 * 2. حالة الاتصال بالسيرفر
 * 3. نوع الاتصال (WiFi, Cellular, etc.)
 * 4. إحصائيات الشبكة
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EnhancedNetworkService from '../../utils/enhancedNetworkService';
import { logger } from '../../services/logger';

interface NetworkStatusIndicatorProps {
    showDetails?: boolean;
    position?: 'top' | 'bottom';
    style?: any;
}

export default function NetworkStatusIndicator({
    showDetails = false,
    position = 'top',
    style,
}: NetworkStatusIndicatorProps) {
    const [networkState, setNetworkState] = useState(EnhancedNetworkService.getNetworkState());
    const [showModal, setShowModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        // Update network state every second
        const interval = setInterval(() => {
            setNetworkState(EnhancedNetworkService.getNetworkState());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const getStatusColor = () => {
        if (!networkState.isConnected) return '#FF4444'; // Red
        if (!networkState.isInternetReachable) return '#FF8800'; // Orange
        if (!networkState.isServerReachable) return '#FFAA00'; // Yellow
        return '#44AA44'; // Green
    };

    const getStatusText = () => {
        if (!networkState.isConnected) return 'غير متصل';
        if (!networkState.isInternetReachable) return 'لا يوجد إنترنت';
        if (!networkState.isServerReachable) return 'السيرفر غير متاح';
        return 'متصل';
    };

    const getStatusIcon = () => {
        if (!networkState.isConnected) return 'wifi-off';
        if (!networkState.isInternetReachable) return 'warning';
        if (!networkState.isServerReachable) return 'server';
        return 'wifi';
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await EnhancedNetworkService.checkServerHealth();
            setNetworkState(EnhancedNetworkService.getNetworkState());
        } catch (error) {
            logger.error('[NetworkStatus] Refresh failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const renderStatusIndicator = () => (
        <TouchableOpacity
            style={[
                styles.indicator,
                { backgroundColor: getStatusColor() },
                position === 'bottom' && styles.indicatorBottom,
                style,
            ]}
            onPress={() => setShowModal(true)}
        >
            <Ionicons name={getStatusIcon()} size={16} color="white" />
            {showDetails && (
                <Text style={styles.statusText}>{getStatusText()}</Text>
            )}
        </TouchableOpacity>
    );

    const renderDetailModal = () => (
        <Modal
            visible={showModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>حالة الشبكة</Text>
                    <TouchableOpacity
                        onPress={() => setShowModal(false)}
                        style={styles.closeButton}
                    >
                        <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.modalContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                        />
                    }
                >
                    {/* Connection Status */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>حالة الاتصال</Text>
                        
                        <View style={styles.statusRow}>
                            <Ionicons
                                name={networkState.isConnected ? 'checkmark-circle' : 'close-circle'}
                                size={20}
                                color={networkState.isConnected ? '#44AA44' : '#FF4444'}
                            />
                            <Text style={styles.statusLabel}>متصل بالشبكة</Text>
                            <Text style={styles.statusValue}>
                                {networkState.isConnected ? 'نعم' : 'لا'}
                            </Text>
                        </View>

                        <View style={styles.statusRow}>
                            <Ionicons
                                name={networkState.isInternetReachable ? 'checkmark-circle' : 'close-circle'}
                                size={20}
                                color={networkState.isInternetReachable ? '#44AA44' : '#FF4444'}
                            />
                            <Text style={styles.statusLabel}>الإنترنت متاح</Text>
                            <Text style={styles.statusValue}>
                                {networkState.isInternetReachable ? 'نعم' : 'لا'}
                            </Text>
                        </View>

                        <View style={styles.statusRow}>
                            <Ionicons
                                name={networkState.isServerReachable ? 'checkmark-circle' : 'close-circle'}
                                size={20}
                                color={networkState.isServerReachable ? '#44AA44' : '#FF4444'}
                            />
                            <Text style={styles.statusLabel}>السيرفر متاح</Text>
                            <Text style={styles.statusValue}>
                                {networkState.isServerReachable ? 'نعم' : 'لا'}
                            </Text>
                        </View>
                    </View>

                    {/* Connection Details */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>تفاصيل الاتصال</Text>
                        
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>نوع الاتصال:</Text>
                            <Text style={styles.detailValue}>
                                {networkState.connectionType || 'غير معروف'}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>آخر فحص للسيرفر:</Text>
                            <Text style={styles.detailValue}>
                                {networkState.lastHealthCheck
                                    ? new Date(networkState.lastHealthCheck).toLocaleTimeString('ar-SA')
                                    : 'لم يتم الفحص بعد'
                                }
                            </Text>
                        </View>
                    </View>

                    {/* Troubleshooting */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>استكشاف الأخطاء</Text>
                        
                        {!networkState.isConnected && (
                            <View style={styles.troubleshootItem}>
                                <Ionicons name="warning" size={20} color="#FF8800" />
                                <Text style={styles.troubleshootText}>
                                    تأكد من تشغيل WiFi أو البيانات الخلوية
                                </Text>
                            </View>
                        )}

                        {networkState.isConnected && !networkState.isInternetReachable && (
                            <View style={styles.troubleshootItem}>
                                <Ionicons name="warning" size={20} color="#FF8800" />
                                <Text style={styles.troubleshootText}>
                                    الشبكة متصلة لكن لا يوجد إنترنت. تحقق من إعدادات الشبكة
                                </Text>
                            </View>
                        )}

                        {networkState.isInternetReachable && !networkState.isServerReachable && (
                            <View style={styles.troubleshootItem}>
                                <Ionicons name="warning" size={20} color="#FF8800" />
                                <Text style={styles.troubleshootText}>
                                    الإنترنت متاح لكن السيرفر غير متاح. قد يكون هناك مشكلة مؤقتة
                                </Text>
                            </View>
                        )}

                        {networkState.isConnected && networkState.isInternetReachable && networkState.isServerReachable && (
                            <View style={styles.troubleshootItem}>
                                <Ionicons name="checkmark-circle" size={20} color="#44AA44" />
                                <Text style={styles.troubleshootText}>
                                    جميع الاتصالات تعمل بشكل طبيعي
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleRefresh}
                            disabled={isRefreshing}
                        >
                            <Ionicons name="refresh" size={20} color="white" />
                            <Text style={styles.actionButtonText}>
                                {isRefreshing ? 'جاري الفحص...' : 'فحص الاتصال'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.secondaryButton]}
                            onPress={() => {
                                EnhancedNetworkService.clearCache();
                                setShowModal(false);
                            }}
                        >
                            <Ionicons name="trash" size={20} color="#666" />
                            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                                مسح الكاش
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );

    return (
        <>
            {renderStatusIndicator()}
            {renderDetailModal()}
        </>
    );
}

const styles = StyleSheet.create({
    indicator: {
        position: 'absolute',
        top: 50,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    indicatorBottom: {
        top: undefined,
        bottom: 50,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 5,
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    section: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    statusLabel: {
        flex: 1,
        fontSize: 16,
        color: '#666',
        marginLeft: 12,
    },
    statusValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    detailLabel: {
        fontSize: 16,
        color: '#666',
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    troubleshootItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
    },
    troubleshootText: {
        flex: 1,
        fontSize: 14,
        color: '#666',
        marginLeft: 12,
        lineHeight: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginBottom: 12,
    },
    secondaryButton: {
        backgroundColor: '#f0f0f0',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    secondaryButtonText: {
        color: '#666',
    },
});