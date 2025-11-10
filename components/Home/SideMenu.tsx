import React from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { X, Info, Settings, Shield, Mail, LogOut } from 'lucide-react-native';
import { router } from 'expo-router'; // استيراد router من expo-router
import { styles } from './homeStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SideMenuProps {
  visible: boolean;
  animValue: Animated.Value;
  onClose: () => void;
  onLogout: () => void;
  onMenuItemPress?: (item: string) => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  visible,
  animValue,
  onClose,
  onLogout,
  onMenuItemPress,
}) => {
  
  const handleMenuItemPress = (item: string) => {
    onClose(); // إغلاق القائمة أولاً
    
    switch(item) {
      case 'settings':
        // التنقل لصفحة Settings
        router.push('/(tabs)/settings'); // أو router.push('/(tabs)/settings') حسب هيكل مجلداتك
        break;
      case 'about':
        router.push('/about');
        break;
      case 'privacy':
        router.push('/privacy');
        break;
      case 'contact':
        router.push('/contact');
        break;
      default:
        onMenuItemPress?.(item);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.sideMenu,
            { transform: [{ translateX: animValue }] },
          ]}
        >
          <View style={styles.sideMenuHeader}>
            <Text style={styles.sideMenuTitle}>Menu</Text>
          </View>

          <View style={styles.sideMenuItems}>
            <TouchableOpacity 
              style={styles.sideMenuItem} 
              onPress={() => handleMenuItemPress('about')}
            >
              <Info color="#22c55e" size={24} />
              <Text style={styles.sideMenuItemText}>About Us</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sideMenuItem} 
              onPress={() => handleMenuItemPress('privacy')}
            >
              <Shield color="#22c55e" size={24} />
              <Text style={styles.sideMenuItemText}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sideMenuItem} 
              onPress={() => handleMenuItemPress('settings')}
            >
              <Settings color="#22c55e" size={24} />
              <Text style={styles.sideMenuItemText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sideMenuItem} 
              onPress={() => handleMenuItemPress('contact')}
            >
              <Mail color="#22c55e" size={24} />
              <Text style={styles.sideMenuItemText}>Contact Us</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.sideMenuItem, styles.logoutButton]} 
            onPress={onLogout}
          >
            <LogOut color="#ff3b30" size={24} />
            <Text style={[styles.sideMenuItemText, styles.logoutText]}>LogOut</Text>
          </TouchableOpacity>

          <View style={styles.sideMenuFooter}>
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};