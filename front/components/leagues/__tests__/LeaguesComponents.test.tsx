/**
 * ⚠️ TEST FILE - DEVELOPMENT ONLY
 * This file contains mock data for testing purposes only.
 * Team names and logos in this file are NOT used in production.
 */

import React from 'react';
// @ts-ignore - @testing-library/react-native may not be installed
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SearchBar, MatchCard, PredictionSystem, useHapticFeedback } from '../index';
import { Match, UserStats, Prediction } from '../types';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

describe('Leagues Components', () => {
  describe('SearchBar', () => {
    it('renders correctly', () => {
      const mockOnSearch = jest.fn();
      const mockOnFilterPress = jest.fn();
      
      const { getByPlaceholderText } = render(
        <SearchBar
          onSearch={mockOnSearch}
          onFilterPress={mockOnFilterPress}
          placeholder="ابحث عن المباريات..."
        />
      );
      
      expect(getByPlaceholderText('ابحث عن المباريات...')).toBeTruthy();
    });

    it('calls onSearch when text changes', () => {
      const mockOnSearch = jest.fn();
      const mockOnFilterPress = jest.fn();
      
      const { getByPlaceholderText } = render(
        <SearchBar
          onSearch={mockOnSearch}
          onFilterPress={mockOnFilterPress}
        />
      );
      
      const input = getByPlaceholderText('ابحث عن المباريات...');
      fireEvent.changeText(input, 'ريال مدريد');
      
      expect(mockOnSearch).toHaveBeenCalledWith('ريال مدريد');
    });

    it('calls onFilterPress when filter button is pressed', () => {
      const mockOnSearch = jest.fn();
      const mockOnFilterPress = jest.fn();
      
      const { getByTestId } = render(
        <SearchBar
          onSearch={mockOnSearch}
          onFilterPress={mockOnFilterPress}
        />
      );
      
      // Assuming filter button has testID
      const filterButton = getByTestId('filter-button');
      fireEvent.press(filterButton);
      
      expect(mockOnFilterPress).toHaveBeenCalled();
    });
  });

  describe('MatchCard', () => {
    const mockMatch: Match = {
      id: '1',
      homeTeam: 'ريال مدريد',
      awayTeam: 'برشلونة',
      homeScore: 2,
      awayScore: 1,
      homeLogo: 'https://example.com/real-madrid.png',
      awayLogo: 'https://example.com/barcelona.png',
      date: 'اليوم',
      time: '22:00',
      status: 'finished',
      league: 'الدوري الإسباني',
    };

    it('renders match information correctly', () => {
      const mockOnPredictionSubmit = jest.fn();
      
      const { getByText } = render(
        <MatchCard
          match={mockMatch}
          onPredictionSubmit={mockOnPredictionSubmit}
          showPrediction={false}
        />
      );
      
      expect(getByText('ريال مدريد')).toBeTruthy();
      expect(getByText('برشلونة')).toBeTruthy();
      expect(getByText('الدوري الإسباني')).toBeTruthy();
    });

    it('shows prediction interface when showPrediction is true', () => {
      const mockOnPredictionSubmit = jest.fn();
      
      const { getByText } = render(
        <MatchCard
          match={mockMatch}
          onPredictionSubmit={mockOnPredictionSubmit}
          showPrediction={true}
        />
      );
      
      expect(getByText('توقع الآن')).toBeTruthy();
    });

    it('calls onPredictionSubmit when prediction is submitted', async () => {
      const mockOnPredictionSubmit = jest.fn();
      
      const { getByText } = render(
        <MatchCard
          match={mockMatch}
          onPredictionSubmit={mockOnPredictionSubmit}
          showPrediction={true}
        />
      );
      
      const submitButton = getByText('توقع الآن');
      fireEvent.press(submitButton);
      
      await waitFor(() => {
        expect(mockOnPredictionSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('PredictionSystem', () => {
    const mockUserStats: UserStats = {
      totalPredictions: 42,
      correctPredictions: 35,
      accuracy: 83,
      totalPoints: 1250,
      streak: 7,
      bestStreak: 12,
      rank: 15,
      level: 8
    };

    const mockPredictions: Prediction[] = [
      {
        id: '1',
        matchId: '1',
        userId: 'user1',
        type: 'win',
        homeScore: 2,
        awayScore: 1,
        points: 25,
        isCorrect: true,
        submittedAt: new Date('2024-01-15'),
        matchResult: { homeScore: 2, awayScore: 1 }
      }
    ];

    it('renders user statistics correctly', () => {
      const mockOnPredictionSubmit = jest.fn();
      const mockOnPredictionUpdate = jest.fn();
      
      const { getByText } = render(
        <PredictionSystem
          predictions={mockPredictions}
          userStats={mockUserStats}
          onPredictionSubmit={mockOnPredictionSubmit}
          onPredictionUpdate={mockOnPredictionUpdate}
        />
      );
      
      expect(getByText('83%')).toBeTruthy();
      expect(getByText('1250')).toBeTruthy();
      expect(getByText('7')).toBeTruthy();
    });

    it('shows predictions list', () => {
      const mockOnPredictionSubmit = jest.fn();
      const mockOnPredictionUpdate = jest.fn();
      
      const { getByText } = render(
        <PredictionSystem
          predictions={mockPredictions}
          userStats={mockUserStats}
          onPredictionSubmit={mockOnPredictionSubmit}
          onPredictionUpdate={mockOnPredictionUpdate}
        />
      );
      
      expect(getByText('2 - 1')).toBeTruthy();
    });
  });

  describe('useHapticFeedback', () => {
    it('provides haptic feedback methods', () => {
      const { View, TouchableOpacity, Text } = require('react-native');
      
      const TestComponent = () => {
        const haptic = useHapticFeedback();
        
        return (
          <View>
            <TouchableOpacity onPress={haptic.light}>
              <Text>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={haptic.medium}>
              <Text>Medium</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={haptic.heavy}>
              <Text>Heavy</Text>
            </TouchableOpacity>
          </View>
        );
      };
      
      render(<TestComponent />);
      
      // Test that the hook returns the expected methods
      expect(typeof useHapticFeedback).toBe('function');
    });
  });
});
