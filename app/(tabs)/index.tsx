import React from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useFinanceStore } from '../../store/useFinanceStore';
import { TransactionAdderModal } from '../../components/features/TransactionAdderModal';
import { CreateVaultModal } from '../../components/features/CreateVaultModal';
import { TrendChart } from '../../components/features/TrendChart';
import { MagicScanWindow } from '../../components/features/MagicScanWindow';
import { scanDocumentWithGemini, ScanResponse, ScannedTransaction, ScanTaxonomy } from '../../services/geminiService';
import { parsePdfWithPasswordFlow } from '../../services/uploadService';
import { useCategoriesStore } from '../../store/useCategoriesStore';
import { MagicScanReviewModal } from '../../components/features/MagicScanModal';
import { financeApi } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { DEV_DISABLE_AUTH } from '../../constants/Config';
import { Surface, SurfaceHeaderArea, GradientCard, NeonButton } from '../../components/ui';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { resolveCategoryStyle, tintWithAlpha } from '../../lib/categoryStyle';
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

  const [isScanning, setIsScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<ScanResponse | null>(null);
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
  const { isAuthenticated, user } = useAuth();
  // Vault Group context: drives the avatar stack on the active vault
  // card (replacing the legacy P1/P2 placeholder dots) and is the
  // anchor for the upcoming activity-row author badges.
  const vaultGroups = useVaultGroupsStore(s => s.groups);
  const activeGroupId = useVaultGroupsStore(s => s.activeGroupId);
  const activeVaultGroup =
    vaultGroups.find(g => g.id === activeGroupId) ?? vaultGroups[0] ?? null;

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

  const localTransactions = transactions.filter(t => t.walletId === activeWalletId).slice(0, 5);

  const extendedWallets = [
    ...wallets,
    { id: 'NEW_VAULT_TRIGGER', name: 'Add Vault', type: 'NEW', balance: 0, currency: '' },
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

    try {
      let data: ScanResponse | null;
      if (mimeType === 'application/pdf' && user?.id) {
        // PDFs route through the backend so encrypted statements can
        // be decrypted with pikepdf using a password stored only on
        // this device. See services/uploadService.ts.
        data = await parsePdfWithPasswordFlow(uri, user.id);
      } else {
        data = await scanDocumentWithGemini(uri, mimeType, buildScanTaxonomy());
      }
      setScanResult(data);
    } catch (err) {
      console.warn('[MagicScan] parse failed', err);
      setScanResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  const confirmScan = async (scannedTransactions: ScannedTransaction[]) => {
    const { added, skipped } = addTransactionsBatch(
      scannedTransactions.map(tx => ({
        walletId: activeWalletId,
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

    if (skipped > 0) {
      Alert.alert(
        added.length === 0 ? 'Already in Vault' : 'Duplicates Skipped',
        added.length === 0
          ? `All ${skipped} scanned ${skipped === 1 ? 'transaction was' : 'transactions were'} already in your vault. Nothing was added.`
          : `Added ${added.length} new ${added.length === 1 ? 'transaction' : 'transactions'}. Skipped ${skipped} that already existed.`,
      );
    }

    if (isAuthenticated && !DEV_DISABLE_AUTH && added.length > 0) {
      try {
        const activeWallet = wallets.find(w => w.id === activeWalletId);
        await financeApi.confirmUpload({
          file_hash: `mobile_${Date.now()}`,
          bank: activeWallet?.name || 'UNKNOWN',
          account_type: activeWallet?.type === 'PERSONAL' ? 'SAVINGS' : 'CREDIT_CARD',
          account_name: activeWallet?.name || 'Default',
          transactions: added.map(tx => ({
            tx_date: tx.date.toISOString().slice(0, 10),
            description: tx.merchant,
            amount: tx.amount,
            direction: tx.type === 'INCOME' ? 'CREDIT' : 'DEBIT',
            category: tx.category,
            currency: 'SGD',
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
              Provision Vault
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
                    {item.type} VAULT
                  </Text>
                  <Text className="font-jakarta-bold text-text-high text-lg">{item.name}</Text>
                </View>

                {/* Vault Group member avatars — replaces the legacy
                    P1/P2 placeholder dots. Falls back to a single dot
                    when the active group has one member (solo vault),
                    or shows nothing if the user is in zero groups. */}
                {activeVaultGroup && activeVaultGroup.members.length > 0 && (
                  <AvatarStack
                    members={activeVaultGroup.members}
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
          <View className="flex-row items-center gap-3">
            <View
              className="w-10 h-10 rounded-full bg-accent-coral justify-center items-center"
              style={{ boxShadow: '0 0 20px rgba(255, 107, 74, 0.5)' }}>
              <Text className="font-jakarta-bold text-white text-base">SG</Text>
            </View>
            <View>
              <Text className="font-jakarta-bold text-text-low text-[10px] uppercase tracking-widest mb-1">
                Welcome back
              </Text>
              <Text className="font-jakarta-bold text-text-high text-lg">Dashboard</Text>
            </View>
          </View>
          <Pressable
            className="w-10 h-10 rounded-full bg-surface-2 border border-hairline justify-center items-center">
            <Ionicons name="notifications-outline" size={18} color="#FF6B4A" />
          </Pressable>
        </View>
      </SurfaceHeaderArea>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>
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

        {/* The two add-transaction actions read as a pair: same coral
            family, same shape, same icon weight. Magic Scan stays the
            "killer action" (solid coral fill + glow); Add Entry is its
            quieter sibling with a translucent coral fill + coral
            border, so both feel like primary actions while the
            hierarchy is preserved by intensity. */}
        <View className="flex-row gap-3 px-6 mb-10">
          <Pressable
            onPress={() => setModalVisible(true)}
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

        <View className="px-6">
          <TrendChart />

          <View className="flex-row justify-between items-center mb-5">
            <Text className="font-jakarta-bold text-text-high text-xl">Vault Activity</Text>
            <Pressable onPress={() => router.push('/(tabs)/transactions')}>
              <Text className="font-jakarta-bold text-accent-coral tracking-wide">See All</Text>
            </Pressable>
          </View>

          {localTransactions.length === 0 ? (
            <GradientCard padding="lg" radius="row">
              <View className="items-center justify-center py-6">
                <Ionicons name="leaf-outline" size={28} color={themeColors.textLow} />
                <Text className="font-jakarta-bold text-text-low text-sm mt-3">
                  No activity in this vault.
                </Text>
              </View>
            </GradientCard>
          ) : (
            <View className="gap-3">
              {localTransactions.map(tx => {
                const icon = resolveCategoryStyle(tx.category, categoriesByKind);
                const isIncome = tx.type === 'INCOME';
                return (
                  <GradientCard key={tx.id} padding="md" radius="row">
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center gap-4">
                        <View
                          className="w-11 h-11 rounded-2xl justify-center items-center"
                          style={{
                            backgroundColor: tintWithAlpha(icon.tint, 0.14),
                            borderWidth: 1,
                            borderColor: tintWithAlpha(icon.tint, 0.32),
                          }}>
                          <Ionicons name={icon.name as any} size={18} color={icon.tint} />
                        </View>
                        <View>
                          <Text className="font-jakarta-bold text-text-high text-base">
                            {tx.merchant}
                          </Text>
                          <Text
                            className="font-jakarta-bold text-[10px] mt-0.5 uppercase tracking-widest"
                            style={{ color: icon.tint }}>
                            {tx.category}
                          </Text>
                        </View>
                      </View>
                      <Text
                        className={`font-jakarta-bold tracking-wide text-base ${
                          isIncome ? 'text-accent-mint' : 'text-text-high'
                        }`}>
                        {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                      </Text>
                    </View>
                  </GradientCard>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <TransactionAdderModal visible={modalVisible} onClose={() => setModalVisible(false)} />
      <CreateVaultModal visible={vaultModalVisible} onClose={() => setVaultModalVisible(false)} />
      <MagicScanReviewModal
        visible={scanModalVisible}
        onClose={() => setScanModalVisible(false)}
        loading={isScanning}
        scanData={scanResult}
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
    </Surface>
  );
}
