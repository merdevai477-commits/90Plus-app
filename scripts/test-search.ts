import { footballService } from '../src/services/football.service';

async function test() {
  console.log("Configured:", footballService.isConfigured());
  
  // const players = await footballService.searchPlayers("Messi");
  // console.log("Players:", JSON.stringify(players[0]).substring(0, 100));

  const teams = await footballService.searchTeams("Real Madrid");
  console.log("Teams:", JSON.stringify(teams[0]).substring(0, 100));

  const leagues = await footballService.searchLeagues("Premier League");
  console.log("Leagues:", JSON.stringify(leagues[0]).substring(0, 100));

  const venues = await footballService.searchVenues("Camp Nou");
  console.log("Venues:", JSON.stringify(venues[0]).substring(0, 100));
}

test().catch(console.error);
