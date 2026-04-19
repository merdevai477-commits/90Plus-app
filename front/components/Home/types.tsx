export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  duration: string;
}

export interface Player {
  id: string;
  name: string;
  position: string;
  image: string;
  rating: number;
  team: string;
}

export interface Team {
  id: string;
  name: string;
  formation: string;
  players: TeamPlayer[];
  logo: string;
}

export interface TeamPlayer {
  id: string;
  name: string;
  position: string;
  image: string;
  x: number;
  y: number;
}

export const ADMIN_USER = {
  username: 'admen12',
  password: '187m',
  displayName: 'mahmoud'
};