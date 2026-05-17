import React from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { getProfileExtras } from '../../lib/profileExtras';

import { useFinanceStore } from '../../store/useFinanceStore';
import { TransactionAdderModal } from '../../components/features/TransactionAdderModal';
import { CreateVaultModal } from '../../components/features/CreateVaultModal';
import { TrendChart } from '../../components/features/TrendChart';
import { MagicScanWindow } from '../../components/features/MagicScanWindow';
import { ScanResponse, ScannedTransaction, ScanTaxonomy } from '../../services/geminiService';
import { parsePdfWithPasswordFlow, parseImageViaBackend } from '../../services/uploadService';
import { useCategoriesStore } from '../../store/useCategoriesStore';
import { MagicScanReviewModal } from '../../components/features/MagicScanModal';
import { financeApi } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { DEV_DISABLE_AUTH } from '../../constants/Config';
import { GradientCard, NeonButton, Skeleton, Surface, SurfaceHeaderArea } from '../../components/ui';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { AvatarStack } from '../../components/features/AvatarStack';
import { useVaultGroupsStore } from '../../store/useVaultGroupsStore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;

type VaultAccent = 'coral' | 'mint' | 'rose' | 'amber';

const accentForVaultType = (type: string): VaultAccent => {
  switch (type) {
    case 'PERSONAL':
      return 'coral';
    case 'FAMILY':
      return 'mint';
    case 'TRIP':
      return 'rose';
    case 'CRYPTO':
      return 'amber';
    default:
      return 'coral';
  }
};

const tintForVaultType = (type: string) => {
  switch (type) {
    case 'PERSONAL':
      return '#FF6B4A';
    case 'FAMILY':
      return '#5BE0B0';
    case 'TRIP':
      return '#FF5C7C';
    case 'CRYPTO':
      return '#FFB547';
    default:
      return '#FF6B4A';
  }
};


export default function HomeScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const [modalVisible, setModalVisible] = React.useState(false);
  const [vaultModalVisible, setVaultModalVisible] = React.useState(false);
  const [groupSwitcherVisible, setGroupSwitcherVisible] = React.useState(false);
  const setActiveGroup = useVaultGroupsStore(s => s.setActiveGroup);

  const [isScanning, setIsScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<ScanResponse | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [scanModalVisible, setScanModalVisible] = React.useState(false);
  const [scanWindowVisible, setScanWindowVisible] = React.useState(false);

  // Pull the user's configured categories + labels so the Magic Scan
  // LLM tags new rows with their own vocabulary, not a hardcoded enum.
  const categoriesByKind = useCategoriesStore(s => s.categories);
  const labelsAll = useCategoriesStore(s => s.labels);
  const syncCategoriesFromBackend = useCategoriesStore(s => s.syncFromBackend);
  const buildScanTaxonomy = (): ScanTaxonomy => ({
    expenseCategories: categoriesByKind.filter(c => c.kind === 'expense').map(c => c.name),
    incomeCategories: categoriesByKind.filter(c => c.kind === 'income').map(c => c.name),
    labels: labelsAll.map(l => l.name),
  });
  const wallets = useFinanceStore(s => s.wallets);
  const transactions = useFinanceStore(s => s.transactions);
  const activeWalletId = useFinanceStore(s => s.activeWalletId);
  const setActiveWallet = useFinanceStore(s => s.setActiveWallet);
  const addTransactionsBatch = useFinanceStore(s => s.addTransactionsBatch);
  const syncData = useFinanceStore(s => s.syncData);
  const isSyncing = useFinanceStore(s => s.isSyncing);
  const hasSynced = useFinanceStore(s => s.hasSynced);
  const { isAuthenticated, user } = useAuth();
  // Vault Group context: drives the avatar stack on the active vault
  // card (replacing the legacy P1/P2 placeholder dots) and is the
  // anchor for the upcoming activity-row author badges.
  const vaultGroups = useVaultGroupsStore(s => s.groups);
  const activeGroupId = useVaultGroupsStore(s => s.activeGroupId);
  const activeVaultGroup =
    vaultGroups.find(g => g.id === activeGroupId) ?? vaultGroups[0] ?? null;

  // Backend has no avatar upload endpoint yet — the Profile screen
  // saves the picked image as a file:// URI in SecureStore, so the
  // server-side `member.avatar_url` for the current user stays null
  // and the AvatarStack falls back to "NS" initials. Patch the local
  // URI onto the matching member entry so the wallet card mirrors
  // what Settings shows.
  const [localAvatarUri, setLocalAvatarUri] = React.useState<string | null>(null);
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      if (user?.id) {
        void getProfileExtras(user.id).then((extras) => {
          if (!cancelled) setLocalAvatarUri(extras.avatarUri ?? null);
        });
      } else {
        setLocalAvatarUri(null);
      }
      return () => {
        cancelled = true;
      };
    }, [user?.id]),
  );
  const membersWithLocalAvatar = React.useMemo(() => {
    const members = activeVaultGroup?.members ?? [];
    if (!localAvatarUri || !user?.id) return members;
    return members.map((m) =>
      m.user_id === user.id ? { ...m, avatar_url: localAvatarUri } : m,
    );
  }, [activeVaultGroup?.members, localAvatarUri, user?.id]);

  React.useEffect(() => {
    // Skip the backend sync while the dev auth bypass is on — the seeded
    // fake token won't validate against FastAPI and the 401 used to
    // light up LogBox on every reload. Real auth flows still sync.
    if (isAuthenticated && !DEV_DISABLE_AUTH) {
      syncData();
      // Pull the user's persisted categories + labels from backend so
      // any customization survives a reinstall. First sync on a fresh
      // user also bootstraps the local seeds up to the backend.
      syncCategoriesFromBackend();
    }
  }, [isAuthenticated]);

  const extendedWallets = [
    ...wallets,
    { id: 'NEW_VAULT_TRIGGER', name: 'Add Wallet', type: 'NEW', balance: 0, currency: '' },
  ];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    const targetWallet = extendedWallets[index];
    if (targetWallet && targetWallet.id !== activeWalletId && targetWallet.id !== 'NEW_VAULT_TRIGGER') {
      setActiveWallet(targetWallet.id);
    }
  };

  const handleSelectFile = async (uri: string, mimeType: string) => {
    setScanWindowVisible(false);
    setScanModalVisible(true);
    setIsScanning(true);

    setScanError(null);
    try {
      let data: ScanResponse | null;
      if (mimeType === 'application/pdf' && user?.id) {
        // PDFs route through the backend so encrypted statements can
        // be decrypted with pikepdf using a password stored only on
        // this device. See services/uploadService.ts.
        data = await parsePdfWithPasswordFlow(uri, user.id);
      } else {
        // Receipts/photos also route through the backend now (used to
        // call Gemini directly from the client, which hung when the
        // API key was missing in EAS profiles or the network stalled).
        data = await parseImageViaBackend(uri, mimeType);
      }
      setScanResult(data);
    } catch (err: any) {
      console.warn('[MagicScan] parse failed', err);
      setScanResult(null);
      // Surface a useful diagnostic instead of a generic "failed" state.
      // The most common live cases: backend image route not yet deployed
      // (400 "Unsupported file type"), auth blip (401), network blip
      // (timeout/no response), or Gemini transient 5xx.
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      let msg: string;
      if (!err?.response) {
        msg = `Could not reach the backend. Check your connection or try again in a moment.`;
      } else if (status === 401) {
        msg = `Your session expired. Sign in again and retry.`;
      } else if (status === 400 && typeof detail === 'string') {
        msg = detail;
      } else if (typeof detail === 'string') {
        msg = detail;
      } else {
        msg = err?.message ?? 'Something went wrong on the server. Please try again.';
      }
      setScanError(msg);
    } finally {
      setIsScanning(false);
    }
  };

  const confirmScan = async (scannedTransactions: ScannedTransaction[]) => {
    if (!activeWalletId) {
      Alert.alert('No wallet yet', 'Create a wallet before importing transactions.');
      setScanModalVisible(false);
      return;
    }
    const targetWalletId = activeWalletId;
    const { added, skipped } = addTransactionsBatch(
      scannedTransactions.map(tx => ({
        walletId: targetWalletId,
        merchant: tx.merchant,
        amount: tx.amount,
        category: tx.category,
        date: new Date(tx.date),
        type: tx.type,
        // Carry the LLM's auto-suggested labels through so the user
        // sees them on the Activity row right after Confirm.
        labels: tx.labels,
      })),
    );

    setScanModalVisible(false);

    // Hop to the Activity tab so the user can immediately see where
    // the scanned rows landed. Anchors to the LATEST added tx's
    // month — most Magic Scans are of a recent statement so this
    // typically lines up with the current month; the user can scroll
    // the picker back if their statement spanned earlier months.
    if (added.length > 0) {
      const latest = added.reduce(
        (acc, t) => (t.date > acc ? t.date : acc),
        added[0].date,
      );
      const month = `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}`;
      router.push({
        pathname: '/(tabs)/transactions',
        params: { month, walletId: targetWalletId },
      });
    }

    if (skipped > 0) {
      Alert.alert(
        added.length === 0 ? 'Already in Wallet' : 'Duplicates Skipped',
        added.length === 0
          ? `All ${skipped} scanned ${skipped === 1 ? 'transaction was' : 'transactions were'} already in your wallet. Nothing was added.`
          : `Added ${added.length} new ${added.length === 1 ? 'transaction' : 'transactions'}. Skipped ${skipped} that already existed.`,
      );
    }

    if (isAuthenticated && !DEV_DISABLE_AUTH && added.length > 0) {
      try {
        const activeWallet = wallets.find(w => w.id === activeWalletId);
        await financeApi.confirmUpload({
          file_hash: `mobile_${Date.now()}`,
          // `bank` is a strict enum (DBS|OCBC|UOB|CITI|UNKNOWN) — the
          // wallet's display name doesn't fit it, so we send UNKNOWN.
          // Once the parser hands back a confidence-typed bank guess
          // (Phase 2.2), thread it through here.
          bank: 'UNKNOWN',
          account_type: activeWallet?.type === 'PERSONAL' ? 'SAVINGS' : 'CREDIT_CARD',
          account_name: activeWallet?.name || 'Default',
          transactions: added.map(tx => ({
            tx_date: tx.date.toISOString().slice(0, 10),
            description: tx.merchant,
            amount: tx.amount,
            direction: tx.type === 'INCOME' ? 'CREDIT' : 'DEBIT',
            category: tx.category,
            currency: activeWallet?.currency ?? 'SGD',
            // Phase 2.1: pass auto-suggested labels through the upload
            // pipeline so the backend writes the transaction_labels join.
            labels: tx.labels ?? [],
          })),
        });
        syncData();
      } catch (error) {
        // warn (not error) so LogBox doesn't pop a red banner — the
        // scan still landed locally; the backend push is best-effort.
        console.warn('Failed to sync scan result to backend', error);
      }
    }
  };

  const renderWalletCard = ({ item }: { item: any }) => {
    if (item.id === 'NEW_VAULT_TRIGGER') {
      return (
        <View style={{ width }} className="items-center px-6">
          <Pressable
            onPress={() => setVaultModalVisible(true)}
            style={{
              width: CARD_WIDTH,
              height: 200,
              borderStyle: 'dashed',
              borderWidth: 1.5,
              borderColor: themeColors.textDim,
              borderRadius: 24,
            }}
            className="justify-center items-center bg-surface-2/40">
            <Ionicons name="add-circle-outline" size={36} color={themeColors.textLow} />
            <Text className="font-jakarta-bold text-text-low tracking-widest uppercase text-xs mt-3">
              Add Wallet
            </Text>
          </Pressable>
        </View>
      );
    }

    const isActive = item.id === activeWalletId;
    const accent = accentForVaultType(item.type);
    const tint = tintForVaultType(item.type);
    const isManualTracker = item.type === 'PERSONAL';
    const trackedSpend = transactions
      .filter(t => t.walletId === item.id && t.type === 'EXPENSE')
      .reduce((a, b) => a + b.amount, 0);
    const trackedIncome = transactions
      .filter(t => t.walletId === item.id && t.type === 'INCOME')
      .reduce((a, b) => a + b.amount, 0);

    return (
      <View style={{ width }} className="items-center px-6">
        <Pressable
          onPress={() => router.push('/(tabs)/transactions')}
          style={{ width: CARD_WIDTH }}>
          <GradientCard
            padding="lg"
            accent={isActive ? accent : undefined}
            style={{ height: 200 }}>
            <View className="flex-1 justify-between">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text
                    className="font-jakarta-bold tracking-widest text-[10px] uppercase mb-1.5"
                    style={{ color: tint }}>
                    {item.type} WALLET
                  </Text>
                  <Text className="font-jakarta-bold text-text-high text-lg">{item.name}</Text>
                </View>

                {/* Vault Group member avatars — replaces the legacy
                    P1/P2 placeholder dots. Falls back to a single dot
                    when the active group has one member (solo vault),
                    or shows nothing if the user is in zero groups.
                    The current user's avatar is patched in from local
                    storage above so picked photos show without a
                    backend upload round-trip. */}
                {activeVaultGroup && membersWithLocalAvatar.length > 0 && (
                  <AvatarStack
                    members={membersWithLocalAvatar}
                    size={32}
                    maxVisible={4}
                  />
                )}
              </View>

              <View>
                {isManualTracker ? (
                  <View>
                    <Text className="font-jakarta-bold text-text-low text-[10px] mb-1.5 uppercase tracking-widest">
                      This Month Activity
                    </Text>
                    <View className="flex-row items-baseline gap-2">
                      <Text className="font-jakarta-bold text-accent-mint text-[28px]">
                        +{trackedIncome.toLocaleString()}
                      </Text>
                      <Text className="font-jakarta text-text-dim text-xl">/</Text>
                      <Text className="font-jakarta-bold text-accent-rose text-[28px]">
                        -{trackedSpend.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text className="font-jakarta-bold text-text-low text-[10px] mb-1.5 uppercase tracking-widest">
                      Current Balance ({item.currency})
                    </Text>
                    <Text className="font-jakarta-light text-text-high text-[40px] tracking-tighter">
                      ${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </GradientCard>
        </Pressable>
      </View>
    );
  };

  return (
    <Surface>
      <SurfaceHeaderArea>
        <View className="flex-row justify-between items-center px-6 pt-3 pb-6">
          {/* Active-group chip: makes the current vault context
              visible at a glance and is the entry point to the
              switcher (Settings → Vault Groups → Manage was too
              deep for routine context toggling). */}
          <Pressable
            onPress={() => setGroupSwitcherVisible(true)}
            disabled={vaultGroups.length <= 1}
            className="flex-row items-center gap-3 active:opacity-80">
            <View
              className="w-10 h-10 rounded-full bg-accent-coral justify-center items-center"
              style={{ boxShadow: '0 0 20px rgba(255, 107, 74, 0.5)' }}>
              <Text className="font-jakarta-bold text-white text-base">
                {activeVaultGroup?.emoji ?? '🏡'}
              </Text>
            </View>
            <View>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
                {vaultGroups.length > 1 ? 'Active vault' : 'Vault'}
              </Text>
              <View className="flex-row items-center gap-1">
                <Text className="font-jakarta-bold text-text-high text-lg">
                  {activeVaultGroup?.name ?? 'My Vault'}
                </Text>
                {vaultGroups.length > 1 && (
                  <Ionicons name="chevron-down" size={14} color={themeColors.textMid} />
                )}
              </View>
            </View>
          </Pressable>
          <Pressable
            className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
            <Ionicons name="notifications-outline" size={18} color="#FF6B4A" />
          </Pressable>
        </View>
      </SurfaceHeaderArea>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}
        refreshControl={
          // Pull-to-refresh re-fetches everything group-scoped:
          // wallets, transactions, categories, labels. Using
          // `isSyncing` directly means the spinner stays up as long as
          // the actual fetch is in flight (no fake fixed-duration UX).
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={() => {
              if (isAuthenticated && !DEV_DISABLE_AUTH) {
                void syncData();
                void syncCategoriesFromBackend();
              }
            }}
            tintColor="#FF6B4A"
          />
        }>
        {/* Three states for the carousel area:
              1. First sync still in flight → skeleton card so the user
                 sees motion instead of a blank or a misleading empty
                 state during the 200–600ms initial fetch.
              2. Sync done, still no wallets → first-launch checklist
                 (brand-new account that hasn't created any wallets).
              3. Wallets exist → real carousel. */}
        {isSyncing && !hasSynced ? (
          <View className="px-6 mb-8">
            <View style={{ height: 200, marginBottom: 12 }}>
              <Skeleton width="100%" height={200} radius={24} />
            </View>
            <View className="flex-row justify-center gap-2">
              <Skeleton width={24} height={6} radius={3} />
              <Skeleton width={6} height={6} radius={3} />
              <Skeleton width={6} height={6} radius={3} />
            </View>
          </View>
        ) : wallets.length === 0 ? (
          <View className="px-6 mb-2">
            <View className="mb-6 mt-2">
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-2">
                Get started
              </Text>
              <Text className="font-jakarta-bold text-text-high text-2xl tracking-tighter">
                Two quick steps
              </Text>
              <Text className="font-jakarta text-text-mid text-sm mt-2 leading-relaxed">
                Set up a wallet to track money in, then import or log
                your first transaction.
              </Text>
            </View>

            {/* Step 1 — Add wallet */}
            <Pressable onPress={() => setVaultModalVisible(true)}>
              <GradientCard padding="lg" accent="coral" className="mb-3">
                <View className="flex-row items-center gap-4">
                  <View
                    className="w-11 h-11 rounded-2xl bg-accent-coral justify-center items-center"
                    style={{ boxShadow: '0 0 16px rgba(255, 107, 74, 0.45)' }}>
                    <Text className="font-jakarta-bold text-white text-base">1</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-jakarta-bold text-text-high text-base">
                      Add your first wallet
                    </Text>
                    <Text className="font-jakarta text-text-low text-xs mt-1">
                      Bank account, trip fund, anything you want to track
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={themeColors.textMid} />
                </View>
              </GradientCard>
            </Pressable>

            {/* Step 2 — Import / log a transaction. Disabled until step 1. */}
            <View className="opacity-50">
              <GradientCard padding="lg" radius="card">
                <View className="flex-row items-center gap-4">
                  <View
                    className="w-11 h-11 rounded-2xl bg-surface-3 border border-hairline justify-center items-center">
                    <Text className="font-jakarta-bold text-text-low text-base">2</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-jakarta-bold text-text-high text-base">
                      Import a statement or add an entry
                    </Text>
                    <Text className="font-jakarta text-text-low text-xs mt-1">
                      Magic Scan a PDF or type a single transaction
                    </Text>
                  </View>
                  <Ionicons name="lock-closed-outline" size={18} color={themeColors.textLow} />
                </View>
              </GradientCard>
            </View>
          </View>
        ) : (
          <>
            <FlatList
              data={extendedWallets}
              renderItem={renderWalletCard}
              keyExtractor={item => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              className="flex-none mb-5"
              style={{ height: 210 }}
            />

            <View className="flex-row justify-center gap-2 mb-8">
              {extendedWallets.map(w => {
                const isActive = w.id === activeWalletId;
                const isTrigger = w.id === 'NEW_VAULT_TRIGGER';
                return (
                  <View
                    key={w.id}
                    className={`h-1.5 rounded-full ${
                      isActive && !isTrigger ? 'w-6 bg-accent-coral' : 'w-1.5 bg-surface-3'
                    }`}
                  />
                );
              })}
            </View>
          </>
        )}

        {/* The two add-transaction actions read as a pair: same coral
            family, same shape, same icon weight. Magic Scan stays the
            "killer action" (solid coral fill + glow); Add Entry is its
            quieter sibling with a translucent coral fill + coral
            border, so both feel like primary actions while the
            hierarchy is preserved by intensity.
            Hidden while the user is still on the first-launch
            checklist (no wallets yet) — the checklist owns the CTA. */}
        {wallets.length > 0 && (
        <View className="flex-row gap-3 px-6 mb-10">
          <Pressable
            onPress={() => {
              // No active wallet means TransactionAdderModal can't
              // actually save (it short-circuits on null walletId). Stop
              // the user from typing into a dead-end modal and offer the
              // wallet-creation flow instead.
              if (!activeWalletId) {
                Alert.alert(
                  'No wallet yet',
                  'Add a wallet first — entries need a wallet to live in.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Add Wallet',
                      style: 'default',
                      onPress: () => setVaultModalVisible(true),
                    },
                  ],
                );
                return;
              }
              setModalVisible(true);
            }}
            className="flex-row items-center justify-center gap-2 rounded-full py-3.5 active:scale-95 transition-all"
            style={{
              flex: 1,
              backgroundColor: 'rgba(255, 107, 74, 0.12)',
              borderWidth: 1.5,
              borderColor: 'rgba(255, 107, 74, 0.45)',
            }}>
            <Ionicons name="add-circle-outline" size={20} color="#FF6B4A" />
            <Text className="font-jakarta-bold text-accent-coral text-base">
              Add Entry
            </Text>
          </Pressable>
          <NeonButton
            size="lg"
            icon="flash-outline"
            block
            onPress={() => setScanWindowVisible(true)}
            style={{ flex: 1 }}>
            Magic Scan
          </NeonButton>
        </View>
        )}

        <View className="px-6">
          <TrendChart walletId={activeWalletId} />
        </View>
      </ScrollView>

      <TransactionAdderModal visible={modalVisible} onClose={() => setModalVisible(false)} />
      <CreateVaultModal visible={vaultModalVisible} onClose={() => setVaultModalVisible(false)} />
      <MagicScanReviewModal
        visible={scanModalVisible}
        onClose={() => setScanModalVisible(false)}
        loading={isScanning}
        scanData={scanResult}
        errorMessage={scanError}
        onConfirm={confirmScan}
        onEditTransaction={(index, patch) =>
          setScanResult(prev =>
            prev
              ? {
                  ...prev,
                  transactions: prev.transactions.map((t, i) =>
                    i === index ? { ...t, ...patch } : t,
                  ),
                }
              : prev,
          )
        }
      />
      <MagicScanWindow
        visible={scanWindowVisible}
        onClose={() => setScanWindowVisible(false)}
        onSelectFile={handleSelectFile}
      />

      {/* Quick switch between Vault Groups without leaving Home.
          Tapping a group flips activeGroupId in the store, which
          fires the cache reset + refetch wired in useVaultGroupsStore. */}
      <Modal
        visible={groupSwitcherVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupSwitcherVisible(false)}>
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setGroupSwitcherVisible(false)}>
          <Pressable
            className="bg-surface-1 rounded-t-[40px] px-6 pt-6 pb-12"
            style={{ borderTopWidth: 1, borderTopColor: themeColors.hairline }}
            onPress={(e) => e.stopPropagation()}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="font-jakarta-bold text-text-high text-xl">Switch vault</Text>
              <Pressable
                onPress={() => setGroupSwitcherVisible(false)}
                className="w-9 h-9 rounded-full bg-surface-2 border border-hairline justify-center items-center">
                <Ionicons name="close" size={18} color={themeColors.textMid} />
              </Pressable>
            </View>
            {vaultGroups.map((g) => {
              const isActive = g.id === activeGroupId;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => {
                    if (!isActive) setActiveGroup(g.id);
                    setGroupSwitcherVisible(false);
                  }}
                  className="flex-row items-center gap-4 p-4 rounded-2xl mb-2 active:bg-surface-3"
                  style={{
                    backgroundColor: isActive ? 'rgba(255, 107, 74, 0.12)' : 'transparent',
                    borderWidth: 1,
                    borderColor: isActive ? 'rgba(255, 107, 74, 0.45)' : themeColors.hairline,
                  }}>
                  <View className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
                    <Text className="text-lg">{g.emoji ?? '🏡'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-jakarta-bold text-text-high text-base">{g.name}</Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={20} color="#FF6B4A" />
                  )}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setGroupSwitcherVisible(false);
                router.push('/groups');
              }}
              className="flex-row items-center justify-center gap-2 mt-3 py-3 rounded-2xl bg-surface-2 border border-hairline">
              <Ionicons name="settings-outline" size={16} color={themeColors.textMid} />
              <Text className="font-jakarta-bold text-text-mid text-sm">
                Manage vaults
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Surface>
  );
}
