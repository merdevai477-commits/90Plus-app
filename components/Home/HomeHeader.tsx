import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Search, Bell, Menu } from 'lucide-react-native';
import { styles } from './homeStyles';

interface HomeHeaderProps {
  onMenuPress: () => void;
  onSearchPress: () => void;
  onNotificationPress: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onMenuPress,
  onSearchPress,
  onNotificationPress,
}) => {
  return (
    <View style={styles.header}>
      <Text style={styles.appTitle}>Football Hub</Text>
      <View style={styles.headerIcons}>
        <TouchableOpacity style={styles.headerIcon} onPress={onSearchPress}>
          <Search color="#22c55e" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIcon} onPress={onNotificationPress}>
          <Bell color="#fff" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIcon} onPress={onMenuPress}>
          <Menu color="#fff" size={24} />
        </TouchableOpacity>
      </View>
    </View>
  );
};