import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassWrapper, glassProps, ACCENT, ACCENT_DARK, SURFACE_BG, AppGradients } from '../../constants/ui';

export interface Stats {
  age: string;
  height: string;
  weight: string;
  foot: '' | 'R' | 'L' | 'B';
}

interface StatsEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (stats: Stats) => void;
  initialStats: Stats;
}

const FOOT_OPTIONS: { value: 'R' | 'L' | 'B'; label: string; labelAr: string }[] = [
  { value: 'R', label: 'R', labelAr: 'يمين' },
  { value: 'L', label: 'L', labelAr: 'يسار' },
  { value: 'B', label: 'B', labelAr: 'كلاهما' },
];

export default function StatsEditModal({
  visible,
  onClose,
  onSave,
  initialStats,
}: StatsEditModalProps) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    setStats(initialStats);
    setFocusedField(null);
  }, [initialStats, visible]);

  const handleChange = (key: keyof Stats, value: string) => {
    setStats(prev => ({ ...prev, [key]: value as any }));
  };

  const handleSave = () => {
    const validFoot: '' | 'R' | 'L' | 'B' =
      stats.foot === 'R' || stats.foot === 'L' || stats.foot === 'B'
        ? stats.foot
        : '';
    onSave({ ...stats, foot: validFoot });
    onClose();
  };

  const inputBorder = (field: string) =>
    focusedField === field ? ACCENT : 'rgba(168,85,247,0.2)';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.overlay}
      >
        {/* Backdrop */}
        <GlassWrapper {...(glassProps.modal as any)} style={StyleSheet.absoluteFill} />

        <View style={s.sheet}>
          {/* Purple top accent */}
          <LinearGradient
            colors={[ACCENT, ACCENT_DARK, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.topAccent}
          />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>تعديل الإحصائيات ⚡</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={s.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Age */}
            <View style={s.field}>
              <Text style={s.label}>العمر (Age)</Text>
              <View style={[s.inputWrap, { borderColor: inputBorder('age') }]}>
                <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                <TextInput
                  style={s.input}
                  value={stats.age}
                  onChangeText={t => handleChange('age', t)}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="—"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  onFocus={() => setFocusedField('age')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Height */}
            <View style={s.field}>
              <Text style={s.label}>الطول (Height - cm)</Text>
              <View style={[s.inputWrap, { borderColor: inputBorder('height') }]}>
                <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                <TextInput
                  style={s.input}
                  value={stats.height}
                  onChangeText={t => handleChange('height', t)}
                  keyboardType="numeric"
                  maxLength={3}
                  placeholder="—"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  onFocus={() => setFocusedField('height')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Weight */}
            <View style={s.field}>
              <Text style={s.label}>الوزن (Weight - kg)</Text>
              <View style={[s.inputWrap, { borderColor: inputBorder('weight') }]}>
                <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                <TextInput
                  style={s.input}
                  value={stats.weight}
                  onChangeText={t => handleChange('weight', t)}
                  keyboardType="numeric"
                  maxLength={3}
                  placeholder="—"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  onFocus={() => setFocusedField('weight')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Foot selector */}
            <View style={s.field}>
              <Text style={s.label}>القدم المفضلة (Foot)</Text>
              <View style={s.footRow}>
                {FOOT_OPTIONS.map(opt => {
                  const isSelected = stats.foot === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={s.footBtnWrap}
                      onPress={() => handleChange('foot', opt.value)}
                      activeOpacity={0.8}
                    >
                      {isSelected ? (
                        <LinearGradient
                          colors={AppGradients.purpleCTA}
                          style={s.footBtn}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Text style={s.footTxtSelected}>{opt.labelAr}</Text>
                          <Text style={s.footCode}>{opt.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={s.footBtnInactive}>
                          <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                          <Text style={s.footTxt}>{opt.labelAr}</Text>
                          <Text style={[s.footCode, { color: 'rgba(255,255,255,0.35)' }]}>{opt.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <LinearGradient
              colors={AppGradients.purpleCTA}
              style={s.saveBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={s.saveTxt}>حفظ التغييرات</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: SURFACE_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    maxHeight: '82%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168,85,247,0.15)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  form: { paddingBottom: 16 },

  /* Fields */
  field: { marginBottom: 16 },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'right',
  },

  /* Input */
  inputWrap: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  input: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'right',
  },

  /* Foot selector */
  footRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footBtnWrap: { flex: 1 },
  footBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  footBtnInactive: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  footTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  footTxtSelected: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  footCode: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },

  /* Save */
  saveBtn: {
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  saveTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
