'use client';
import { create } from 'zustand';
import type { Game, User, AppSettings, StarlineGame, JackpotGame } from './types';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  collection,
  onSnapshot,
  doc,
  serverTimestamp,
  query,
  setDoc,
  getDocs,
  where,
  updateDoc,
  increment,
  writeBatch,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { signOut } from 'firebase/auth';
import { logTransaction } from './transactions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const parseTime = (timeString: string) => {
    if (!timeString || !timeString.includes(':')) return 9999;
    const cleanTime = timeString.trim().toUpperCase();
    const is12Hour = cleanTime.includes('AM') || cleanTime.includes('PM');
    let hours, minutes;
    if (is12Hour) {
        const parts = cleanTime.split(' ');
        const timePart = parts[0];
        const modifier = parts[1];
        const timeParts = timePart.split(':').map(Number);
        hours = timeParts[0];
        minutes = timeParts[1];
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
    } else {
        const timeParts = cleanTime.split(':').map(Number);
        hours = timeParts[0];
        minutes = timeParts[1];
    }
    return (hours || 0) * 60 + (minutes || 0);
};

// Game Store
interface GameState {
  games: Game[];
  starlineGames: StarlineGame[];
  jackpotGames: JackpotGame[];
  marketOpenTime: string;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  getGameById: (gameId: string) => Game | undefined;
  addGame: (game: Omit<Game, 'id'>) => Promise<void>;
  updateGame: (gameId: string, updates: Partial<Omit<Game, 'id'>>) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;
  initializeGameSubscription: () => () => void;
  resetAllResults: () => Promise<void>;
}

let isGameSubscribed = false;

const useGameStore = create(
    persist<GameState>(
        (set, get) => ({
            games: [],
            starlineGames: [],
            jackpotGames: [],
            marketOpenTime: '12:00 AM',
            hydrated: false,
            setHydrated: (hydrated) => set({ hydrated }),
            getGameById: (gameId: string) => get().games.find((g) => g.id === gameId),
            addGame: async (game) => {
                const ref = doc(collection(db, 'games'));
                await setDoc(ref, { 
                  ...game, 
                  id: ref.id,
                  createdAt: serverTimestamp() 
                }).catch(e => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ref.path,
                    operation: 'create',
                    requestResourceData: game
                  }));
                });
            },
            updateGame: async (gameId, updates) => {
                const ref = doc(db, 'games', gameId);
                await updateDoc(ref, updates).catch(e => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ref.path,
                    operation: 'update',
                    requestResourceData: updates
                  }));
                });
            },
            deleteGame: async (gameId) => {
                const gameDoc = doc(db, 'games', gameId);
                await deleteDoc(gameDoc).catch(e => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: gameDoc.path,
                    operation: 'delete'
                  }));
                });
            },
            initializeGameSubscription: () => {
                if (isGameSubscribed) return () => {};
                isGameSubscribed = true;

                const unsubGames = onSnapshot(collection(db, 'games'), (snap) => {
                    const gamesList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                    gamesList.sort((a, b) => parseTime(a.openTime) - parseTime(b.openTime));
                    set({ games: gamesList });
                }, (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                      path: 'games',
                      operation: 'list'
                    }));
                });

                const unsubStarline = onSnapshot(collection(db, 'starlineGames'), (snap) => {
                    const gamesList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StarlineGame));
                    gamesList.sort((a, b) => parseTime(a.time) - parseTime(b.time));
                    set({ starlineGames: gamesList });
                }, (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                      path: 'starlineGames',
                      operation: 'list'
                    }));
                });

                const unsubJackpot = onSnapshot(collection(db, 'jackpotGames'), (snap) => {
                    const gamesList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JackpotGame));
                    gamesList.sort((a, b) => parseTime(a.time) - parseTime(b.time));
                    set({ jackpotGames: gamesList });
                }, (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                      path: 'jackpotGames',
                      operation: 'list'
                    }));
                });

                const unsubSettings = onSnapshot(doc(db, 'settings', 'app-settings'), (snap) => {
                    if (snap.exists()) set({ marketOpenTime: snap.data().marketOpenTime || '12:00 AM' });
                }, (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                      path: 'settings/app-settings',
                      operation: 'get'
                    }));
                });

                return () => {
                    unsubGames(); unsubStarline(); unsubJackpot(); unsubSettings();
                    isGameSubscribed = false;
                };
            },
            resetAllResults: async () => {
                const snap = await getDocs(collection(db, 'games'));
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.update(d.ref, { result: '***-**-***', openResult: '***', closeResult: '**' }));
                await batch.commit().catch(e => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'games',
                    operation: 'update'
                  }));
                });
            },
        }),
        {
            name: 'game-storage',
            storage: createJSONStorage(() => localStorage),
             onRehydrateStorage: () => (state) => {
                state?.initializeGameSubscription();
                state?.setHydrated(true);
             }
        }
    )
);

// User Store
interface UserState {
    users: User[];
    currentUser: User | null;
    hydrated: boolean;
    setHydrated: (hydrated: boolean) => void;
    addUser: (user: Omit<User, 'id' | 'isAdmin' | 'balance' | 'bonusBalance' | 'status' | 'joinedAt'>) => Promise<User | null>;
    findUserByMobile: (mobile: string) => User | undefined;
    findUserById: (userId: string) => User | undefined;
    login: (mobile: string, password: string) => Promise<User | null>;
    logout: () => void;
    setCurrentUser: (user: User | null) => void;
    updateUser: (user: Partial<User> & { id: string }) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    toggleUserAdminStatus: (userId: string) => Promise<void>;
    toggleUserStatus: (userId: string) => Promise<void>;
    addFunds: (mobile: string, amount: number) => Promise<boolean>;
    addBonus: (userId: string, amount: number) => Promise<boolean>;
    deductBonus: (userId: string, amount: number) => Promise<boolean>;
    deductPoints: (userId: string, amount: number) => Promise<boolean>;
    setBalanceToZero: (userId: string) => Promise<boolean>;
    setBonusToZero: (userId: string) => Promise<boolean>;
    initializeUserSubscription: () => () => void;
}

let isUserSubscribed = false;

export const useUserStore = create(
    persist<UserState>(
        (set, get) => ({
            users: [],
            currentUser: null,
            hydrated: false,
            setHydrated: (hydrated) => set({ hydrated }),
            addUser: async (userData) => {
                try {
                    const userId = "USER_" + userData.mobile;
                    const newUserRef = doc(db, "users", userId);
                    
                    const isAdmin = userData.mobile === '9999999999';
                    const newUser: User = {
                        ...userData,
                        id: userId,
                        isAdmin: isAdmin,
                        balance: 0,
                        bonusBalance: 0,
                        status: 'active',
                        joinedAt: new Date().toISOString(),
                    };
                    
                    await setDoc(newUserRef, newUser);
                    return newUser;
                } catch (error: any) {
                    console.error("Signup error:", error);
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                      path: 'users',
                      operation: 'create'
                    }));
                    return null;
                }
            },
            findUserByMobile: (mobile) => get().users.find((u) => u.mobile === mobile),
            findUserById: (userId) => get().users.find((u) => u.id === userId),
            login: async (mobile, password) => {
                try {
                    // Admin hardcoded fallback
                    if (mobile === '9999999999' && password === 'admin123') {
                        const adminUser: User = { 
                          id: "USER_9999999999",
                          name: "Admin", 
                          mobile, 
                          password, 
                          isAdmin: true, 
                          balance: 1000000, 
                          bonusBalance: 0, 
                          status: 'active', 
                          joinedAt: new Date().toISOString() 
                        };
                        
                        await setDoc(doc(db, 'users', adminUser.id), adminUser, { merge: true });
                        set({ currentUser: adminUser });
                        return adminUser;
                    }

                    const q = query(collection(db, "users"), where("mobile", "==", mobile));
                    const snap = await getDocs(q);
                    if (snap.empty) return null;
                    
                    const loggedUser = { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
                    if (loggedUser.password === password && loggedUser.status !== 'blocked') {
                        set({ currentUser: loggedUser });
                        return loggedUser;
                    }
                } catch (e) { 
                  console.error("Login err:", e); 
                }
                return null;
            },
            logout: () => {
                signOut(auth).catch(() => {});
                set({ currentUser: null });
            },
            setCurrentUser: (user) => set({ currentUser: user }),
            updateUser: async (updatedData) => {
                const { id, ...userData } = updatedData;
                const ref = doc(db, 'users', id);
                await updateDoc(ref, userData).catch(e => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ref.path,
                    operation: 'update',
                    requestResourceData: userData
                  }));
                });
            },
            deleteUser: async (userId) => {
                const ref = doc(db, 'users', userId);
                await deleteDoc(ref).catch(e => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ref.path,
                    operation: 'delete'
                  }));
                });
            },
            toggleUserAdminStatus: async (userId: string) => {
                const user = get().findUserById(userId);
                if(user) await get().updateUser({ ...user, isAdmin: !user.isAdmin, id: userId });
            },
            toggleUserStatus: async (userId: string) => {
                const user = get().findUserById(userId);
                if (user) {
                    const newStatus = user.status === 'active' ? 'blocked' : 'active';
                    await get().updateUser({ ...user, status: newStatus, id: userId });
                }
            },
            addFunds: async (mobile, amount) => {
                const user = get().findUserByMobile(mobile);
                if (!user) return false;
                const bal = Number(user.balance || 0);
                const ref = doc(db, 'users', user.id);
                await updateDoc(ref, { balance: increment(amount) }).catch(e => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ref.path,
                    operation: 'update',
                    requestResourceData: { balance: increment(amount) }
                  }));
                });
                logTransaction({ userId: user.id, userName: user.name, amount: Math.abs(amount), type: amount < 0 ? 'withdrawal' : 'deposit', status: 'approved', description: 'Admin adjustment', balanceBefore: bal, balanceAfter: bal + amount });
                return true;
            },
            addBonus: async (userId, amount) => {
                const user = get().findUserById(userId);
                if (!user) return false;
                const ref = doc(db, 'users', userId);
                await updateDoc(ref, { bonusBalance: increment(amount), totalBonusGiven: increment(amount > 0 ? amount : 0) }).catch(e => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ref.path,
                    operation: 'update',
                    requestResourceData: { bonusBalance: increment(amount) }
                  }));
                });
                return true;
            },
            deductBonus: async (userId, amount) => get().addBonus(userId, -Math.abs(amount)),
            deductPoints: async (userId, amount) => {
                const user = get().findUserById(userId);
                return user ? get().addFunds(user.mobile, -Math.abs(amount)) : false;
            },
            setBalanceToZero: async (userId) => {
                const ref = doc(db, 'users', userId);
                await updateDoc(ref, { balance: 0 }).catch(e => {
                   errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ref.path,
                    operation: 'update',
                    requestResourceData: { balance: 0 }
                  }));
                });
                return true;
            },
            setBonusToZero: async (userId) => {
                const ref = doc(db, 'users', userId);
                await updateDoc(ref, { bonusBalance: 0 }).catch(e => {
                   errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ref.path,
                    operation: 'update',
                    requestResourceData: { bonusBalance: 0 }
                  }));
                });
                return true;
            },
            initializeUserSubscription: () => {
                if (isUserSubscribed) return () => {};
                isUserSubscribed = true;
                const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
                    const usersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
                    set({ users: usersList });
                    const currentId = get().currentUser?.id;
                    if (currentId) {
                        const fresh = usersList.find(u => u.id === currentId);
                        if (fresh) set({ currentUser: fresh });
                    }
                }, (err) => {
                    console.warn("User list access restricted.");
                });
                return () => { unsubscribe(); isUserSubscribed = false; };
            },
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: (state) => (rehydrated) => {
                if (rehydrated) rehydrated.initializeUserSubscription();
                rehydrated?.setHydrated(true);
            }
        }
    )
);

// Settings Store
interface SettingsState {
  appSettings: AppSettings;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  initializeSettingsSubscription: () => () => void;
}

const defaultAppSettings: AppSettings = {
    marqueeText: "", headerMarqueeSpeed: 15, headerMarqueeSize: 14, withdrawalMarqueeText: "", withdrawalMarqueeSpeed: 15, withdrawalMarqueeSize: 14,
    minWithdrawal: 1000, maxWithdrawal: 50000, shareLink: '', minDeposit: 500, whatsappNumber: '919999999999', appName: 'KALYAN 777', upiId: 'paytmqr281005051011j86r9p876v01@paytm', supportNumber: '919999999999',
    autoResetEnabled: false, autoResetTime: '12:00 AM', autoResultEnabled: false, marketOpenTime: '12:00 AM', withdrawalStartTime: '10:00 AM', withdrawalEndTime: '10:00 PM',
    minBidSingleDigit: 10, minBidJodiDigit: 10, minBidSinglePana: 10, minBidDoublePana: 10, minBidTriplePana: 10, minBidHalfSangam: 10, minBidFullSangam: 10,
    minBidSingleDigitBulk: 10, minBidSinglePanaBulk: 10, minBidDoublePanaBulk: 10, minBidSpDpTp: 10, minBidSpMotor: 10, minBidDpMotor: 10,
    starlineRateSingleDigit: 100, starlineRateSinglePana: 1500, starlineRateDoublePana: 3000, starlineRateTriplePana: 7000, jackpotRateJodi: 1000,
};

let isSettingsSubscribed = false;

export const useSettingsStore = create(
    persist<SettingsState>(
        (set) => ({
            appSettings: defaultAppSettings,
            hydrated: false,
            setHydrated: (hydrated) => set({ hydrated }),
            initializeSettingsSubscription: () => {
                if (isSettingsSubscribed) return () => {};
                isSettingsSubscribed = true;
                const unsubscribe = onSnapshot(doc(db, 'settings', 'app-settings'), (snap) => {
                    if (snap.exists()) set({ appSettings: { ...defaultAppSettings, ...snap.data() } as AppSettings });
                }, (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                      path: 'settings/app-settings',
                      operation: 'get'
                    }));
                });
                return () => { unsubscribe(); isSettingsSubscribed = false; };
            },
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: (state) => (rehydrated) => {
                if (rehydrated) rehydrated.initializeSettingsSubscription();
                rehydrated?.setHydrated(true);
            }
        }
    )
);

if (typeof window !== 'undefined') {
    useGameStore.getState().initializeGameSubscription();
    useSettingsStore.getState().initializeSettingsSubscription();
}

export { useGameStore };
