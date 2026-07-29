import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import GlobalMutationLoadingOverlay from "../components/GlobalMutationLoadingOverlay";
import {
  getMutationLoadingSnapshot,
  subscribeToMutationLoading,
} from "../services/request";

type MutationLoadingContextValue = {
  mutationLoading: boolean;
};

const MutationLoadingContext = createContext<MutationLoadingContextValue>({
  mutationLoading: false,
});

type MutationLoadingProviderProps = {
  children: ReactNode;
};

export function MutationLoadingProvider({
  children,
}: MutationLoadingProviderProps) {
  const mutationLoading = useSyncExternalStore(
    subscribeToMutationLoading,
    getMutationLoadingSnapshot,
    getMutationLoadingSnapshot,
  );

  const value = useMemo(
    () => ({
      mutationLoading,
    }),
    [mutationLoading],
  );

  return (
    <MutationLoadingContext.Provider value={value}>
      {children}
      <GlobalMutationLoadingOverlay open={mutationLoading} />
    </MutationLoadingContext.Provider>
  );
}

export function useMutationLoading() {
  return useContext(MutationLoadingContext);
}
