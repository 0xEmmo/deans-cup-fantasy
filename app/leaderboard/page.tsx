import { createClient } from '@/utils/supabase/server';
import { Suspense } from 'react';

// Types
interface Player {
  id: string;
  name: string;
  position: string;
  department: string;
  price: number;
  slot: number;
  isBench: boolean;
}

interface UserTeam {
  id: string;
  user_id: string;
  formation: string;
  players: Player[];
  captain_id: string;
  total_spent: number;
  created_at: string;
  updated_at: string;
  users: {
    name: string;
    department: string;
  } | null;
}

interface LeaderboardEntry {
  rank: number;
  managerId: string;
  managerName: string;
  department: string;
  totalPoints: number;
}

interface LeaderboardDataBeforeRank {
  managerId: string;
  managerName: string;
  department: string;
  totalPoints: number;
}

// Loading skeleton component
function LeaderboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-10 w-64 bg-gray-700 rounded animate-pulse mb-2"></div>
          <div className="h-6 w-96 bg-gray-700 rounded animate-pulse"></div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <div className="h-5 w-16 bg-blue-500 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="h-5 w-32 bg-blue-500 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="h-5 w-28 bg-blue-500 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="h-5 w-24 bg-blue-500 rounded animate-pulse"></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="px-6 py-4">
                      <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-40 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-48 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main leaderboard content component
async function LeaderboardContent() {
  const supabase = await createClient();

  // Fetch all drafted teams with user information
  const { data: teams, error } = await supabase
    .from('user_teams')
    .select('*, users(name, department)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching teams:', error);
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-bold">Error loading leaderboard</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Mock points for demonstration (since scoring engine isn't built yet)
  const mockPoints: Record<string, number> = {};
  
  // Add mock points to a couple of users for visual demonstration
  if (teams && teams.length > 0) {
    // Give random points to first few users
    if (teams[0]) mockPoints[teams[0].user_id] = 87;
    if (teams[1]) mockPoints[teams[1].user_id] = 65;
    if (teams[2]) mockPoints[teams[2].user_id] = 52;
    if (teams[3]) mockPoints[teams[3].user_id] = 48;
    if (teams[4]) mockPoints[teams[4].user_id] = 31;
  }

  // Transform data into leaderboard entries
  const leaderboardData: LeaderboardDataBeforeRank[] = (teams || []).map((team) => ({
    managerId: team.user_id,
    managerName: team.users?.name || 'Unknown Manager',
    department: team.users?.department || 'Unknown Department',
    totalPoints: mockPoints[team.user_id] || 0,
  }));

  // Sort by points descending
  leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);

  // Add ranks
  const rankedData: LeaderboardEntry[] = leaderboardData.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));

  // Helper function to get rank badge
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-white font-bold text-lg shadow-lg">
            🥇
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 text-white font-bold text-lg shadow-lg">
            🥈
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-lg shadow-lg">
            🥉
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-700 font-bold text-lg">
            {rank}
          </div>
        );
    }
  };

  // Helper function to get row styling based on rank
  const getRowClass = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-400';
      case 3:
        return 'bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500';
      case 4:
      case 5:
        return 'bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-indigo-300'; // Soft blue/purple gradient
      default:
        return 'hover:bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            🏆 Leaderboard
          </h1>
          <p className="text-gray-400 text-lg">
            See how you stack up against other managers
          </p>
          {rankedData.length === 0 && (
            <p className="text-yellow-400 text-sm mt-2">
              No teams have been drafted yet. Be the first to create your team!
            </p>
          )}
        </div>

        {/* Leaderboard Table */}
        {rankedData.length > 0 ? (
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Manager
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Total Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rankedData.map((entry) => (
                    <tr
                      key={entry.managerId}
                      className={`transition-all ${getRowClass(entry.rank)}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRankBadge(entry.rank)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-base font-bold text-gray-900">
                              {entry.managerName} <span className="text-sm font-normal text-gray-600">({entry.department})</span>
                            </div>
                            {entry.rank <= 5 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {entry.rank === 1 && '👑 League Leader'}
                                {entry.rank === 2 && '⭐ Runner Up'}
                                {entry.rank === 3 && '🔥 Top Performer'}
                                {(entry.rank === 4 || entry.rank === 5) && '✨ Top Tier'}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-2xl font-bold text-gray-900">
                          {entry.totalPoints}
                          <span className="text-sm text-gray-500 ml-1">pts</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-2xl p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Teams Yet
            </h2>
            <p className="text-gray-600 mb-6">
              The leaderboard is empty. Create your team to be the first on the board!
            </p>
            <a
              href="/team"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your Team
            </a>
          </div>
        )}

        {/* Info Box */}
        {rankedData.length > 0 && (
          <div className="mt-6 bg-blue-900 rounded-lg p-6 text-white">
            <h3 className="text-lg font-bold mb-2">ℹ️ About Points</h3>
            <p className="text-blue-200 text-sm">
              Points are currently set to 0 for most managers as the scoring engine is still under development. 
              Some mock points are displayed for demonstration purposes. Once matches begin, points will be 
              calculated based on player performance!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main page component with Suspense
export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardContent />
    </Suspense>
  );
}
