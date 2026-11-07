/** @doc Clean confirmation dialog — used for destructive and sign-out flows. */
import { ReactNode, createContext, useCallback, useContext, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import "@/styles/confirmation.css";
import { AlertTriangle, LogOut, Loader2 } from "lucide-react";

export type ConfirmTone = "danger" | "neutral";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: ReactNode;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "neutral",
  icon,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const danger = tone === "danger";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(value) => { if (!value && !loading) onCancel(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="cfd-overlay" />
        <DialogPrimitive.Content className="cfd-card" aria-describedby={description ? undefined : ""} onEscapeKeyDown={(e) => { if (loading) e.preventDefault(); }} onInteractOutside={(e) => { if (loading) e.preventDefault(); }}>
          <div className={`cfd-icon ${danger ? "is-danger" : ""}`} aria-hidden="true">
            {icon ?? (danger ? <AlertTriangle size={22} strokeWidth={1.7} /> : <LogOut size={22} strokeWidth={1.7} />)}
          </div>
          <DialogPrimitive.Title className="cfd-title">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="cfd-desc">{description}</DialogPrimitive.Description>}
          <div className="cfd-actions">
            <Button variant="ghost" type="button" className="cfd-btn" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
            <Button variant="ghost" type="button" className={`cfd-btn cfd-btn-primary ${danger ? "is-danger" : ""}`} onClick={onConfirm} disabled={loading}>
              {loading && <Loader2 className="animate-spin" size={16} />}{confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default ConfirmDialog;

// ---------------------------------------------------------------------------
// Imperative API: <ConfirmProvider> + useConfirm()
// ---------------------------------------------------------------------------
type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: ReactNode;
};

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  async () => false,
);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = useCallback(
    (value: boolean) => {
      setState((s) => {
        s?.resolve(value);
        return null;
      });
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!state}
        title={state?.title ?? ""}
        description={state?.description}
        confirmLabel={state?.confirmLabel}
        cancelLabel={state?.cancelLabel}
        tone={state?.tone}
        icon={state?.icon}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
