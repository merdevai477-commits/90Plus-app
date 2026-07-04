import React from 'react';
import { Stack } from 'expo-router';

export default function GroupsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    />
  );
}
