import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_RETRO_PARAMS,
  type RetroParams,
} from "./retroreflectance-params";

/*
 * The retroreflective background lives in the root layout while its trigger
 * lives in the footer, which routes render inside <Outlet />. They are separate
 * subtrees, so the shared on/off state and parameters sit in a context above
 * both rather than being passed down.
 */
interface RetroreflectanceValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  params: RetroParams;
  setParams: (params: RetroParams) => void;
  /** False when WebGL is unavailable, so the trigger can stay hidden. */
  supported: boolean;
  setSupported: (supported: boolean) => void;
}

const RetroreflectanceContext = createContext<RetroreflectanceValue | null>(
  null,
);

export function RetroreflectanceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);
  const [params, setParams] = useState<RetroParams>(DEFAULT_RETRO_PARAMS);
  const [supported, setSupported] = useState(true);

  const value = useMemo(
    () => ({ enabled, setEnabled, params, setParams, supported, setSupported }),
    [enabled, params, supported],
  );

  return (
    <RetroreflectanceContext.Provider value={value}>
      {children}
    </RetroreflectanceContext.Provider>
  );
}

/**
 * Null outside the provider rather than throwing, so a route rendering the
 * footer on its own degrades to simply not offering the control.
 */
export function useRetroreflectance() {
  return useContext(RetroreflectanceContext);
}
