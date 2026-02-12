"use client";

import * as React from "react";
import { ChevronRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * DropdownMenu context
 * -------------------------------------------------------------------------*/

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<
  DropdownMenuContextValue | undefined
>(undefined);

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error(
      "DropdownMenu compound components must be used within a <DropdownMenu>"
    );
  }
  return context;
}

/* ---------------------------------------------------------------------------
 * Root
 * -------------------------------------------------------------------------*/

export interface DropdownMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function DropdownMenu({
  open: controlledOpen,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(value);
      }
      onOpenChange?.(value);
    },
    [controlledOpen, onOpenChange]
  );

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

/* ---------------------------------------------------------------------------
 * Trigger
 * -------------------------------------------------------------------------*/

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { open, setOpen } = useDropdownMenuContext();

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      onClick={(e) => {
        setOpen(!open);
        onClick?.(e);
      }}
      {...props}
    />
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

/* ---------------------------------------------------------------------------
 * Content
 * -------------------------------------------------------------------------*/

export interface DropdownMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(({ className, align = "start", sideOffset = 4, children, ...props }, ref) => {
  const { open, setOpen } = useDropdownMenuContext();
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.parentElement?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    // Delay to avoid catching the triggering click
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, setOpen]);

  if (!open) return null;

  const alignClass =
    align === "end"
      ? "right-0"
      : align === "center"
        ? "left-1/2 -translate-x-1/2"
        : "left-0";

  return (
    <div
      ref={(node) => {
        contentRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
        alignClass,
        className
      )}
      style={{ marginTop: sideOffset }}
      {...props}
    >
      {children}
    </div>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

/* ---------------------------------------------------------------------------
 * Item
 * -------------------------------------------------------------------------*/

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
}

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuItemProps
>(({ className, inset, onClick, ...props }, ref) => {
  const { setOpen } = useDropdownMenuContext();

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        inset && "pl-8",
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

/* ---------------------------------------------------------------------------
 * CheckboxItem
 * -------------------------------------------------------------------------*/

export interface DropdownMenuCheckboxItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuCheckboxItemProps
>(({ className, children, checked, onCheckedChange, onClick, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={(e) => {
        onCheckedChange?.(!checked);
        onClick?.(e);
      }}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {checked && <Check className="h-4 w-4" />}
      </span>
      {children}
    </button>
  );
});
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

/* ---------------------------------------------------------------------------
 * Label
 * -------------------------------------------------------------------------*/

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

/* ---------------------------------------------------------------------------
 * Separator
 * -------------------------------------------------------------------------*/

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

/* ---------------------------------------------------------------------------
 * Shortcut (decoration only)
 * -------------------------------------------------------------------------*/

const DropdownMenuShortcut = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
    {...props}
  />
));
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

/* ---------------------------------------------------------------------------
 * Sub-menu (simplified: no nested positioning, uses inline expand)
 * -------------------------------------------------------------------------*/

export interface DropdownMenuSubProps {
  children: React.ReactNode;
}

function DropdownMenuSub({ children }: DropdownMenuSubProps) {
  const [subOpen, setSubOpen] = React.useState(false);

  return (
    <DropdownMenuSubContext.Provider value={{ subOpen, setSubOpen }}>
      <div className="relative">
        {children}
      </div>
    </DropdownMenuSubContext.Provider>
  );
}

interface DropdownMenuSubContextValue {
  subOpen: boolean;
  setSubOpen: (open: boolean) => void;
}

const DropdownMenuSubContext = React.createContext<
  DropdownMenuSubContextValue | undefined
>(undefined);

function useDropdownMenuSubContext() {
  const context = React.useContext(DropdownMenuSubContext);
  if (!context) {
    throw new Error("DropdownMenuSub components must be within <DropdownMenuSub>");
  }
  return context;
}

const DropdownMenuSubTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => {
  const { subOpen, setSubOpen } = useDropdownMenuSubContext();

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent",
        inset && "pl-8",
        subOpen && "bg-accent",
        className
      )}
      onClick={() => setSubOpen(!subOpen)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </button>
  );
});
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { subOpen } = useDropdownMenuSubContext();

  if (!subOpen) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute left-full top-0 z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

/* ---------------------------------------------------------------------------
 * Exports
 * -------------------------------------------------------------------------*/

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
