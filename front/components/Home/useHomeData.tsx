import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { mockVideos, mockPlayers, mockTeams } from './mockData';
import { globalState } from '../../globalState';
import { ADMIN_USER } from './types';

export const useHomeData = () => {
  const [isGuest, setIsGuest] = useState(true);
  const [username, setUsername] = useState('');
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sideMenuVisible, setSideMenuVisible] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [isTransitioning, setIsTransitioning] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const ballScale = useRef(new Animated.Value(0.6)).current;
  const ballRotate = useRef(new Animated.Value(0)).current;
  const sideMenuAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (globalState.userType === 'admin') {
      setIsGuest(false);
      setUsername(ADMIN_USER.displayName);
    } else {
      setIsGuest(true);
      setUsername('');
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setCurrentVideoIndex(0);
      setCurrentPlayerIndex(0);
      setCurrentTeamIndex(0);
      setRefreshing(false);
    }, 1500);
  }, []);

  const getCurrentVideos = useMemo(() => {
    const videos = [];
    for (let i = 0; i < 5; i++) {
      videos.push(mockVideos[(currentVideoIndex + i) % mockVideos.length]);
    }
    return videos;
  }, [currentVideoIndex]);

  const getCurrentPlayers = useMemo(() => {
    const players = [];
    for (let i = 0; i < 5; i++) {
      players.push(mockPlayers[(currentPlayerIndex + i) % mockPlayers.length]);
    }
    return players;
  }, [currentPlayerIndex]);

  const handleImageError = useCallback((id: string) => {
    setImageErrors(prev => new Set(prev).add(id));
  }, []);

  const startAmoledTransition = (navigate: () => void) => {
    setIsTransitioning(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(ballScale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(ballRotate, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        navigate();
      }, 150);
    });
  };

  return {
    isGuest,
    username,
    currentVideoIndex,
    currentPlayerIndex,
    currentTeamIndex,
    isLoading,
    refreshing,
    sideMenuVisible,
    imageErrors,
    isTransitioning,
    overlayOpacity,
    ballScale,
    ballRotate,
    sideMenuAnim,
    onRefresh,
    getCurrentVideos,
    getCurrentPlayers,
    handleImageError,
    startAmoledTransition,
    setSideMenuVisible,
    currentTeam: mockTeams[currentTeamIndex],
  };
};