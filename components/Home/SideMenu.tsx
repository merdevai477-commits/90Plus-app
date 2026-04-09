import React from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { View, Text, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { X, Info, Settings, Shield, Mail, LogOut } from 'lucide-react-native';
import { router } from 'expo-router';
import { styles } from './homeStyles'; // Updated with side menu styles

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
  // homeStyles exports an untyped StyleSheet; narrow the keys we use here
  const s = styles as unknown as {
    modalOverlay: ViewStyle;
    sideMenu: ViewStyle;
    sideMenuHeader: ViewStyle;
    sideMenuTitle: TextStyle;
    sideMenuItems: ViewStyle;
    sideMenuItem: ViewStyle;
    sideMenuItemText: TextStyle;
    logoutButton: ViewStyle;
    logoutText: TextStyle;
    sideMenuFooter: ViewStyle;
    versionText: TextStyle;
  };
  
  const handleMenuItemPress = (item: string) => {
    onClose(); // إغلاق القائمة أولاً
    
    switch(item) {
      case 'settings':
        // التنقل لصفحة Settings
        router.push('/(tabs)/settings' as any);
        break;
      case 'about':
        router.push('/about' as any);
        break;
      case 'privacy':
        router.push('/privacy' as any);
        break;
      case 'contact':
        router.push('/contact' as any);
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
        style={s.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            s.sideMenu,
            { transform: [{ translateX: animValue }] },
          ]}
        >
          <View style={s.sideMenuHeader}>
            <Text style={s.sideMenuTitle}>Menu</Text>
          </View>

          <View style={s.sideMenuItems}>
            <TouchableOpacity 
              style={s.sideMenuItem} 
              onPress={() => handleMenuItemPress('about')}
            >
              <Info color="#22c55e" size={24} />
              <Text style={s.sideMenuItemText}>About Us</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={s.sideMenuItem} 
              onPress={() => handleMenuItemPress('privacy')}
            >
              <Shield color="#22c55e" size={24} />
              <Text style={s.sideMenuItemText}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={s.sideMenuItem} 
              onPress={() => handleMenuItemPress('settings')}
            >
              <Settings color="#22c55e" size={24} />
              <Text style={s.sideMenuItemText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={s.sideMenuItem} 
              onPress={() => handleMenuItemPress('contact')}
            >
              <Mail color="#22c55e" size={24} />
              <Text style={s.sideMenuItemText}>Contact Us</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[s.sideMenuItem, s.logoutButton]} 
            onPress={onLogout}
          >
            <LogOut color="#ff3b30" size={24} />
            <Text style={[s.sideMenuItemText, s.logoutText]}>LogOut</Text>
          </TouchableOpacity>

          <View style={s.sideMenuFooter}>
            <Text style={s.versionText}>Version 1.0.0</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};