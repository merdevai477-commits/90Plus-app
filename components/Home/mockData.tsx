import { Video, Player, Team, TeamPlayer } from './types';

const create433Formation = (playerNames: string[]): TeamPlayer[] => [
  { id: '1', name: playerNames[0], position: 'GK', image: 'https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=50&h=50&fit=crop&crop=face', x: 50, y: 85 },
  { id: '2', name: playerNames[1], position: 'RB', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face', x: 80, y: 65 },
  { id: '3', name: playerNames[2], position: 'CB', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face', x: 60, y: 65 },
  { id: '4', name: playerNames[3], position: 'CB', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=50&h=50&fit=crop&crop=face', x: 40, y: 65 },
  { id: '5', name: playerNames[4], position: 'LB', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop&crop=face', x: 20, y: 65 },
  { id: '6', name: playerNames[5], position: 'CM', image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=50&h=50&fit=crop&crop=face', x: 70, y: 45 },
  { id: '7', name: playerNames[6], position: 'CM', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face', x: 50, y: 45 },
  { id: '8', name: playerNames[7], position: 'CM', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face', x: 30, y: 45 },
  { id: '9', name: playerNames[8], position: 'RW', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=50&h=50&fit=crop&crop=face', x: 75, y: 25 },
  { id: '10', name: playerNames[9], position: 'ST', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop&crop=face', x: 50, y: 15 },
  { id: '11', name: playerNames[10], position: 'LW', image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=50&h=50&fit=crop&crop=face', x: 25, y: 25 },
];

export const mockVideos: Video[] = [
  {
    id: '1',
    title: 'Amazing Goal Compilation',
    thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300&h=200&fit=crop',
    views: 125000,
    likes: 8500,
    duration: '3:45',
  },
  {
    id: '2',
    title: 'Best Saves of the Week',
    thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=300&h=200&fit=crop',
    views: 98000,
    likes: 6200,
    duration: '2:30',
  },
  {
    id: '3',
    title: 'Skills & Tricks Masterclass',
    thumbnail: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=300&h=200&fit=crop',
    views: 156000,
    likes: 12000,
    duration: '5:12',
  },
  {
    id: '4',
    title: 'Champions League Highlights',
    thumbnail: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=300&h=200&fit=crop',
    views: 234000,
    likes: 18500,
    duration: '4:20',
  },
  {
    id: '5',
    title: 'Penalty Shootout Drama',
    thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=300&h=200&fit=crop',
    views: 87000,
    likes: 5400,
    duration: '6:15',
  },
  {
    id: '6',
    title: 'Free Kick Masterpiece',
    thumbnail: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=300&h=200&fit=crop',
    views: 145000,
    likes: 9800,
    duration: '3:28',
  },
];

export const mockPlayers: Player[] = [
  {
    id: '1',
    name: 'Marcus Silva',
    position: 'Forward',
    image: 'https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=150&h=150&fit=crop&crop=face',
    rating: 9.2,
    team: 'FC Barcelona',
  },
  {
    id: '2',
    name: 'Ahmed Hassan',
    position: 'Midfielder',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    rating: 8.8,
    team: 'Real Madrid',
  },
  {
    id: '3',
    name: 'David Johnson',
    position: 'Defender',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    rating: 8.5,
    team: 'Manchester City',
  },
  {
    id: '4',
    name: 'Carlos Rodriguez',
    position: 'Goalkeeper',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    rating: 9.0,
    team: 'PSG',
  },
  {
    id: '5',
    name: 'Mohamed Ali',
    position: 'Winger',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
    rating: 8.7,
    team: 'Liverpool',
  },
  {
    id: '6',
    name: 'James Wilson',
    position: 'Striker',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
    rating: 8.9,
    team: 'Chelsea',
  },
];

export const mockTeams: Team[] = [
  {
    id: '1',
    name: 'Dream Team Alpha',
    formation: '4-3-3',
    players: create433Formation(['Silva', 'Hassan', 'Johnson', 'Rodriguez', 'Ali', 'Wilson', 'Brown', 'Davis', 'Miller', 'Garcia', 'Martinez']),
    logo: 'https://images.unsplash.com/photo-1614632537190-23e4b2e69c88?w=100&h=100&fit=crop',
  },
  {
    id: '2',
    name: 'Elite Squad Beta',
    formation: '4-3-3',
    players: create433Formation(['Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Moore', 'Clark', 'Lewis']),
    logo: 'https://images.unsplash.com/photo-1614632537190-23e4b2e69c88?w=100&h=100&fit=crop',
  },
];