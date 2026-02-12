"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Toast variant styles
 * -------------------------------------------------------------------------*/

const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all",
  {
    variants: {
      variant: {
        success:
          "border-[#00C853]/40 bg-[#00C853]/10 text-[#00C853]",
        error:
          "border-destructive/40 bg-destructive/10 text-destructive",
        info:
          "border-blue-500/40 bg-blue-500/10 text-blue-400",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

/* ---------------------------------------------------------------------------
 * Toast types
 * -------------------------------------------------------------------------*/

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

type ToastInput = Omit<ToastItem, "id">;

/* ---------------------------------------------------------------------------
 * Toast context & provider
 * -------------------------------------------------------------------------*/

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
);

function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return context;
}

let toastCounter = 0;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = `toast-${++toastCounter}`;
      const duration = input.duration ?? 5000;

      setToasts((prev) => [...prev, { ...input, id }]);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

/* ---------------------------------------------------------------------------
 * Toast viewport (renders the stacked toasts)
 * -------------------------------------------------------------------------*/

function ToastViewport() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col-reverse gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Individual toast
 * -------------------------------------------------------------------------*/

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 shrink-0" />,
  error: <AlertCircle className="h-5 w-5 shrink-0" />,
  info: <Info className="h-5 w-5 shrink-0" />,
};

interface ToastProps {
  toast: ToastItem;
  onDismiss: () => void;
}

function Toast({ toast: t, onDismiss }: ToastProps) {
  return (
    <div className={cn(toastVariants({ variant: t.variant }))}>
      <div className="flex items-start gap-3">
        {variantIcons[t.variant]}
        <div className="grid gap-1">
          {t.title && (
            <p className="text-sm font-semibold">{t.title}</p>
          )}
          {t.description && (
            <p className="text-sm opacity-90">{t.description}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-1 top-1 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}

export { ToastProvider, useToast, toastVariants };
export type { ToastItem, ToastInput, ToastVariant };
