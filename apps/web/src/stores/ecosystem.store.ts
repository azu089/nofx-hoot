import { create } from 'zustand';
import type { StakingRecord, StakingPool } from '@/types';

interface EcosystemStore {
  // 状态
  stakingRecords: StakingRecord[];
  stakingPools: StakingPool[];
  pointsBalance: string;
  totalStaked: string;
  totalRewards: string;
  isLoading: boolean;
  error: string | null;

  // 操作
  setStakingRecords: (records: StakingRecord[]) => void;
  addStakingRecord: (record: StakingRecord) => void;
  setStakingPools: (pools: StakingPool[]) => void;
  setPointsBalance: (balance: string) => void;
  setTotalStaked: (total: string) => void;
  setTotalRewards: (total: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  stakingRecords: [],
  stakingPools: [],
  pointsBalance: '0',
  totalStaked: '0',
  totalRewards: '0',
  isLoading: false,
  error: null,
};

export const useEcosystemStore = create<EcosystemStore>((set, get) => ({
  ...initialState,

  setStakingRecords: (records) => set({ stakingRecords: records }),

  addStakingRecord: (record) =>
    set({ stakingRecords: [record, ...get().stakingRecords] }),

  setStakingPools: (pools) => set({ stakingPools: pools }),

  setPointsBalance: (balance) => set({ pointsBalance: balance }),

  setTotalStaked: (total) => set({ totalStaked: total }),

  setTotalRewards: (total) => set({ totalRewards: total }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
