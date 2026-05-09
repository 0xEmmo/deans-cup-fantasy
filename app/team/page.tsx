'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';

// Types
type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
type Department = 'Philosophy' | 'History and Strategic Studies' | 'Creative Art' | 'English' | 'Linguistic' | 'Religious Studies';

interface Player {
  id: string;
  name: string;
  position: Position;
  department: Department;
  price: number;
}

interface SelectedPlayer extends Player {
  slot: number;
  isBench: boolean;
}

type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '3-4-3' | '5-3-2';

// Mock Data
const MOCK_PLAYERS: Player[] = [
  // Philosophy Department
  { id: 'p1', name: 'Ariyo', position: 'GK', department: 'Philosophy', price: 5.5 },
  { id: 'p2', name: 'Dee Joe', position: 'GK', department: 'Philosophy', price: 5.0 },
  { id: 'p3', name: 'Akinpelu', position: 'DEF', department: 'Philosophy', price: 6.0 },
  { id: 'p4', name: 'Balogun', position: 'DEF', department: 'Philosophy', price: 6.5 },
  { id: 'p5', name: 'Daniel', position: 'DEF', department: 'Philosophy', price: 5.5 },
  { id: 'p6', name: 'Dexter', position: 'DEF', department: 'Philosophy', price: 5.0 },
  { id: 'p7', name: 'Chizoba', position: 'DEF', department: 'Philosophy', price: 7.0 },
  { id: 'p8', name: 'Ogunyemi', position: 'DEF', department: 'Philosophy', price: 6.0 },
  { id: 'p9', name: 'Shabalaky', position: 'DEF', department: 'Philosophy', price: 5.5 },
  { id: 'p10', name: 'Dotun', position: 'MID', department: 'Philosophy', price: 8.0 },
  { id: 'p11', name: 'Olise', position: 'MID', department: 'Philosophy', price: 9.0 },
  { id: 'p12', name: 'Mustapha', position: 'MID', department: 'Philosophy', price: 7.5 },
  { id: 'p13', name: 'Simon', position: 'MID', department: 'Philosophy', price: 7.0 },
  { id: 'p14', name: 'Mubarak', position: 'MID', department: 'Philosophy', price: 6.5 },
  { id: 'p15', name: 'Remedy', position: 'MID', department: 'Philosophy', price: 6.0 },
  { id: 'p16', name: 'Sulaimon', position: 'MID', department: 'Philosophy', price: 7.5 },
  { id: 'p17', name: 'Bolaji', position: 'FWD', department: 'Philosophy', price: 9.5 },
  { id: 'p18', name: 'Chuks', position: 'FWD', department: 'Philosophy', price: 10.0 },
  { id: 'p19', name: 'Prime', position: 'FWD', department: 'Philosophy', price: 11.0 },
  { id: 'p20', name: 'James', position: 'FWD', department: 'Philosophy', price: 8.5 },
  { id: 'p21', name: 'Ogo', position: 'FWD', department: 'Philosophy', price: 9.0 },
  { id: 'p22', name: 'Zion', position: 'FWD', department: 'Philosophy', price: 8.0 },

  // History and Strategic Studies
  { id: 'h1', name: 'Alisson Becker', position: 'GK', department: 'History and Strategic Studies', price: 6.0 },
  { id: 'h2', name: 'Virgil van Dijk', position: 'DEF', department: 'History and Strategic Studies', price: 7.5 },
  { id: 'h3', name: 'Sergio Ramos', position: 'DEF', department: 'History and Strategic Studies', price: 7.0 },
  { id: 'h4', name: 'Thiago Silva', position: 'DEF', department: 'History and Strategic Studies', price: 6.5 },
  { id: 'h5', name: 'Kevin De Bruyne', position: 'MID', department: 'History and Strategic Studies', price: 11.5 },
  { id: 'h6', name: 'Luka Modric', position: 'MID', department: 'History and Strategic Studies', price: 9.5 },
  { id: 'h7', name: 'Toni Kroos', position: 'MID', department: 'History and Strategic Studies', price: 9.0 },
  { id: 'h8', name: 'Robert Lewandowski', position: 'FWD', department: 'History and Strategic Studies', price: 11.0 },
  { id: 'h9', name: 'Karim Benzema', position: 'FWD', department: 'History and Strategic Studies', price: 10.5 },

  // Creative Art
  { id: 'c1', name: 'Gianluigi Donnarumma', position: 'GK', department: 'Creative Art', price: 5.5 },
  { id: 'c2', name: 'Marquinhos', position: 'DEF', department: 'Creative Art', price: 7.0 },
  { id: 'c3', name: 'Achraf Hakimi', position: 'DEF', department: 'Creative Art', price: 7.5 },
  { id: 'c4', name: 'Vinicius Jr', position: 'FWD', department: 'Creative Art', price: 11.5 },
  { id: 'c5', name: 'Neymar', position: 'FWD', department: 'Creative Art', price: 12.0 },
  { id: 'c6', name: 'Rafael Leao', position: 'FWD', department: 'Creative Art', price: 9.5 },
  { id: 'c7', name: 'Pedri', position: 'MID', department: 'Creative Art', price: 8.5 },
  { id: 'c8', name: 'Gavi', position: 'MID', department: 'Creative Art', price: 8.0 },

  // English
  { id: 'e1', name: 'Jordan Pickford', position: 'GK', department: 'English', price: 5.0 },
  { id: 'e2', name: 'Harry Maguire', position: 'DEF', department: 'English', price: 6.0 },
  { id: 'e3', name: 'John Stones', position: 'DEF', department: 'English', price: 6.5 },
  { id: 'e4', name: 'Bukayo Saka', position: 'MID', department: 'English', price: 10.0 },
  { id: 'e5', name: 'Phil Foden', position: 'MID', department: 'English', price: 10.5 },
  { id: 'e6', name: 'Jude Bellingham', position: 'MID', department: 'English', price: 11.0 },
  { id: 'e7', name: 'Harry Kane', position: 'FWD', department: 'English', price: 11.5 },
  { id: 'e8', name: 'Marcus Rashford', position: 'FWD', department: 'English', price: 9.5 },

  // Linguistic
  { id: 'l1', name: 'Thibaut Courtois', position: 'GK', department: 'Linguistic', price: 6.0 },
  { id: 'l2', name: 'Antonio Rudiger', position: 'DEF', department: 'Linguistic', price: 7.0 },
  { id: 'l3', name: 'David Alaba', position: 'DEF', department: 'Linguistic', price: 6.5 },
  { id: 'l4', name: 'Ilkay Gundogan', position: 'MID', department: 'Linguistic', price: 8.5 },
  { id: 'l5', name: 'Rodri', position: 'MID', department: 'Linguistic', price: 9.0 },
  { id: 'l6', name: 'Kylian Mbappe', position: 'FWD', department: 'Linguistic', price: 12.0 },
  { id: 'l7', name: 'Erling Haaland', position: 'FWD', department: 'Linguistic', price: 12.0 },

  // Religious Studies
  { id: 'r1', name: 'Alisson', position: 'GK', department: 'Religious Studies', price: 6.0 },
  { id: 'r2', name: 'Thiago Silva', position: 'DEF', department: 'Religious Studies', price: 6.5 },
  { id: 'r3', name: 'Kalidou Koulibaly', position: 'DEF', department: 'Religious Studies', price: 7.0 },
  { id: 'r4', name: 'Mohamed Salah', position: 'FWD', department: 'Religious Studies', price: 11.5 },
  { id: 'r5', name: 'Sadio Mane', position: 'FWD', department: 'Religious Studies', price: 10.0 },
  { id: 'r6', name: 'Lionel Messi', position: 'FWD', department: 'Religious Studies', price: 12.0 },
  { id: 'r7', name: 'Paul Pogba', position: 'MID', department: 'Religious Studies', price: 8.5 },
  { id: 'r8', name: 'NGolo Kante', position: 'MID', department: 'Religious Studies', price: 8.0 },
];

const FORMATIONS: Record<Formation, { GK: number; DEF: number; MID: number; FWD: number }> = {
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '3-4-3': { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
};

const BUDGET_CAP = 100;

export default function TeamPage() {
  const [user, setUser] = useState<User | null>(null);
  const [formation, setFormation] = useState<Formation>('4-4-2');
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<{ slot: number; position: Position; isBench: boolean } | null>(null);
  const [filterPosition, setFilterPosition] = useState<Position | 'ALL'>('ALL');
  const [filterDepartment, setFilterDepartment] = useState<Department | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  // Fetch user session
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const formationConfig = FORMATIONS[formation];

  // Calculate total spent
  const totalSpent = useMemo(() => {
    return selectedPlayers.reduce((sum, player) => sum + player.price, 0);
  }, [selectedPlayers]);

  const remainingBudget = BUDGET_CAP - totalSpent;

  // Get starting players and bench players
  const startingPlayers = selectedPlayers.filter(p => !p.isBench);
  const benchPlayers = selectedPlayers.filter(p => p.isBench);

  // Filter available players
  const availablePlayers = useMemo(() => {
    return MOCK_PLAYERS.filter(player => {
      // Exclude already selected players
      if (selectedPlayers.some(sp => sp.id === player.id)) return false;

      // Position filter
      if (filterPosition !== 'ALL' && player.position !== filterPosition) return false;

      // Department filter
      if (filterDepartment !== 'ALL' && player.department !== filterDepartment) return false;

      // Search filter
      if (searchQuery && !player.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      // Budget filter
      if (player.price > remainingBudget) return false;

      return true;
    });
  }, [selectedPlayers, filterPosition, filterDepartment, searchQuery, remainingBudget]);

  const openModal = (slot: number, position: Position, isBench: boolean) => {
    setCurrentSlot({ slot, position, isBench });
    setFilterPosition(position);
    setFilterDepartment('ALL');
    setSearchQuery('');
    setIsModalOpen(true);
  };

  const selectPlayer = (player: Player) => {
    if (!currentSlot) return;

    const newPlayer: SelectedPlayer = {
      ...player,
      slot: currentSlot.slot,
      isBench: currentSlot.isBench,
    };

    setSelectedPlayers([...selectedPlayers, newPlayer]);
    setIsModalOpen(false);
    setCurrentSlot(null);
  };

  const removePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
    if (captainId === playerId) {
      setCaptainId(null);
    }
  };

  const toggleCaptain = (playerId: string) => {
    setCaptainId(captainId === playerId ? null : playerId);
  };

  const validateTeam = (): { valid: boolean; message: string } => {
    // Check if we have exactly 11 starters
    if (startingPlayers.length !== 11) {
      return {
        valid: false,
        message: `You need exactly 11 starting players. Currently have ${startingPlayers.length}.`,
      };
    }

    // Check if we have exactly 4 substitutes
    if (benchPlayers.length !== 4) {
      return {
        valid: false,
        message: `You need exactly 4 substitutes. Currently have ${benchPlayers.length}.`,
      };
    }

    // Check if a captain is selected
    if (!captainId) {
      return {
        valid: false,
        message: 'You must select a captain from your starting 11.',
      };
    }

    // Check if captain is in starting 11
    const captainInStarting = startingPlayers.some(p => p.id === captainId);
    if (!captainInStarting) {
      return {
        valid: false,
        message: 'Captain must be in the starting 11.',
      };
    }

    // Check budget
    if (totalSpent > BUDGET_CAP) {
      return {
        valid: false,
        message: `You are over budget by £${(totalSpent - BUDGET_CAP).toFixed(1)}M.`,
      };
    }

    return { valid: true, message: 'Team is valid!' };
  };

  const saveTeam = async () => {
    // Validate team first
    const validation = validateTeam();
    if (!validation.valid) {
      setSaveMessage({ type: 'error', text: validation.message });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Fetch the authenticated user correctly inside the save function
      const { data: { user } } = await supabase.auth.getUser();

      // Stop the save if no user is found
      if (!user) {
        setSaveMessage({ type: 'error', text: 'You must be logged in to save your team.' });
        setTimeout(() => setSaveMessage(null), 5000);
        setIsSaving(false);
        return;
      }

      // Prepare the team data with explicit user_id
      const teamData = {
        user_id: user.id,
        formation,
        players: selectedPlayers.map(p => ({
          id: p.id,
          name: p.name,
          position: p.position,
          department: p.department,
          price: p.price,
          slot: p.slot,
          isBench: p.isBench,
        })),
        captain_id: captainId,
        total_spent: parseFloat(totalSpent.toFixed(2)), // Ensure numeric with 2 decimal places
      };

      // Use upsert instead of insert so the user can save and update later
      // Remove ignoreDuplicates as it's not a valid option for Supabase upsert
      const { error } = await supabase
        .from('user_teams')
        .upsert(teamData, {
          onConflict: 'user_id',
        });

      if (error) {
        throw error;
      }

      setSaveMessage({ type: 'success', text: '✓ Team saved successfully!' });
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error: any) {
      // Improved error logging with explicit message and details
      console.error('Error saving team:', error);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      setSaveMessage({
        type: 'error',
        text: `Failed to save team: ${error.message || 'Unknown error'}${error.details ? ` - ${error.details}` : ''}`,
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const getPlayerInSlot = (slot: number, isBench: boolean) => {
    return selectedPlayers.find(p => p.slot === slot && p.isBench === isBench);
  };

  const renderPlayerSlot = (slot: number, position: Position, isBench: boolean = false) => {
    const player = getPlayerInSlot(slot, isBench);
    const isCaptain = player && captainId === player.id;

    return (
      <div
        key={`${isBench ? 'bench' : 'pitch'}-${slot}`}
        className="relative group"
      >
        {player ? (
          <div className="relative">
            <div 
              onClick={() => removePlayer(player.id)}
              className={`bg-white border-2 rounded-lg p-3 shadow-md hover:shadow-lg transition-all cursor-pointer min-w-[100px] max-w-[120px] ${
                isCaptain 
                  ? 'border-yellow-500 ring-2 ring-yellow-400' 
                  : 'border-gray-300 hover:border-red-400'
              }`}
              title="Click to remove player"
            >
              <div className="text-center">
                <div className="text-xs font-semibold text-gray-500 mb-1">{player.position}</div>
                <div className="text-sm font-bold text-gray-900 truncate">{player.name}</div>
                <div className="text-xs text-gray-600 mt-1">£{player.price.toFixed(1)}M</div>
                <div className="text-xs text-blue-600 mt-1 truncate">{player.department}</div>
              </div>
            </div>
            {/* Captain button - always visible for starting 11 */}
            {!isBench && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCaptain(player.id);
                }}
                className={`absolute -top-2 -right-2 w-7 h-7 rounded-full text-xs font-bold shadow-md transition-all ${
                  isCaptain
                    ? 'bg-yellow-500 text-white ring-2 ring-yellow-300'
                    : 'bg-gray-200 text-gray-700 hover:bg-yellow-400 hover:text-white'
                }`}
                title={isCaptain ? 'Remove Captain' : 'Make Captain'}
              >
                C
              </button>
            )}
            {/* Remove button - shows on hover */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removePlayer(player.id);
              }}
              className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              title="Remove Player"
            >
              ×
            </button>
            {isCaptain && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                CAPTAIN
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => openModal(slot, position, isBench)}
            className="bg-white/30 border-2 border-dashed border-white/50 rounded-lg p-3 hover:bg-white/40 hover:border-white/70 transition-all min-w-[100px] max-w-[120px] h-[90px] flex flex-col items-center justify-center"
          >
            <div className="text-white text-2xl mb-1">+</div>
            <div className="text-xs font-semibold text-white">{position}</div>
          </button>
        )}
      </div>
    );
  };

  const renderPitchRow = (position: Position, count: number, startSlot: number) => {
    return (
      <div className="flex justify-center items-center gap-4 my-6">
        {Array.from({ length: count }, (_, i) => renderPlayerSlot(startSlot + i, position))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">My Team</h1>
            <p className="text-gray-400">Build your fantasy squad</p>
            {user && (
              <p className="text-gray-500 text-sm mt-1">
                Logged in as: {user.email}
              </p>
            )}
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              saveMessage.type === 'success'
                ? 'bg-green-100 border border-green-400 text-green-700'
                : 'bg-red-100 border border-red-400 text-red-700'
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        {/* Budget Bar */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Budget</h2>
              <p className="text-sm text-gray-600">
                {startingPlayers.length}/11 Starting • {benchPlayers.length}/4 Bench
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                £{remainingBudget.toFixed(1)}M
              </div>
              <div className="text-sm text-gray-600">
                Remaining of £{BUDGET_CAP}M
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full transition-all ${
                totalSpent > BUDGET_CAP
                  ? 'bg-red-500'
                  : totalSpent > BUDGET_CAP * 0.9
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min((totalSpent / BUDGET_CAP) * 100, 100)}%` }}
            />
          </div>
          {totalSpent > BUDGET_CAP && (
            <p className="text-red-600 text-sm mt-2 font-semibold">
              ⚠️ Over budget by £{(totalSpent - BUDGET_CAP).toFixed(1)}M
            </p>
          )}
        </div>

        {/* Formation Selector */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Formation
          </label>
          <select
            value={formation}
            onChange={(e) => {
              setFormation(e.target.value as Formation);
              // Clear players when changing formation
              setSelectedPlayers([]);
              setCaptainId(null);
            }}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Object.keys(FORMATIONS).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Football Pitch */}
        <div className="bg-gradient-to-b from-green-600 to-green-700 rounded-lg shadow-2xl p-8 mb-6 relative overflow-hidden">
          {/* Pitch markings */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-20 border-2 border-white rounded-b-lg" />
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/3 h-20 border-2 border-white rounded-t-lg" />
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white rounded-full" />
          </div>

          <div className="relative z-10">
            {/* Forwards */}
            {renderPitchRow('FWD', formationConfig.FWD, 0)}

            {/* Midfielders */}
            {renderPitchRow('MID', formationConfig.MID, formationConfig.FWD)}

            {/* Defenders */}
            {renderPitchRow('DEF', formationConfig.DEF, formationConfig.FWD + formationConfig.MID)}

            {/* Goalkeeper */}
            {renderPitchRow('GK', formationConfig.GK, formationConfig.FWD + formationConfig.MID + formationConfig.DEF)}
          </div>
        </div>

        {/* Bench */}
        <div className="bg-gray-700 rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">Substitutes Bench</h3>
          <div className="flex justify-start items-center gap-4 flex-wrap">
            {Array.from({ length: 4 }, (_, i) => renderPlayerSlot(i, 'GK', true))}
          </div>
        </div>

        {/* Save Team Button */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {(() => {
            const validation = validateTeam();
            return (
              <>
                {!validation.valid && (
                  <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-6 py-3 rounded-lg text-sm font-semibold">
                    ⚠️ {validation.message}
                  </div>
                )}
                <button
                  onClick={saveTeam}
                  disabled={isSaving || !validation.valid}
                  className={`px-8 py-4 rounded-lg font-bold text-white text-lg transition-all ${
                    isSaving || !validation.valid
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                  }`}
                >
                  {isSaving ? 'Saving Team...' : 'Save Team'}
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Player Picker Modal */}
      {isModalOpen && currentSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Select {currentSlot.position} Player
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Position
                  </label>
                  <select
                    value={filterPosition}
                    onChange={(e) => setFilterPosition(e.target.value as Position | 'ALL')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Positions</option>
                    <option value="GK">Goalkeeper</option>
                    <option value="DEF">Defender</option>
                    <option value="MID">Midfielder</option>
                    <option value="FWD">Forward</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Department
                  </label>
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value as Department | 'ALL')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Departments</option>
                    <option value="Philosophy">Philosophy</option>
                    <option value="History and Strategic Studies">History & Strategic Studies</option>
                    <option value="Creative Art">Creative Art</option>
                    <option value="English">English</option>
                    <option value="Linguistic">Linguistic</option>
                    <option value="Religious Studies">Religious Studies</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search player name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Player List */}
            <div className="flex-1 overflow-y-auto p-6">
              {availablePlayers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No players available</p>
                  <p className="text-sm mt-2">Try adjusting your filters or budget</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availablePlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => selectPlayer(player)}
                      className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-lg transition-all text-left"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-1">
                            {player.position}
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {player.name}
                          </div>
                        </div>
                        <div className="text-xl font-bold text-green-600">
                          £{player.price.toFixed(1)}M
                        </div>
                      </div>
                      <div className="text-sm text-blue-600 truncate">
                        {player.department}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
