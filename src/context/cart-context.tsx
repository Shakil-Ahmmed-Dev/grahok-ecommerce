"use client";

import * as React from "react";

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  variantTitle?: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  sku?: string | null;
  maxStock?: number | null;
  allowBackorder?: boolean;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isOpen: boolean;
  isMounted: boolean;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CART_STORAGE_KEY = "grahok_cart_v1";

const CartContext = React.createContext<CartContextType | undefined>(undefined);

function getInitialCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore corrupted localStorage
  }
  return [];
}

const emptySubscribe = () => () => {};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [hasHydrated, setHasHydrated] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Hydrate cart from localStorage once on client mount
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore corrupted localStorage
    }
    setHasHydrated(true);
  }, []);

  // Save cart to localStorage only AFTER hydration has occurred
  React.useEffect(() => {
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota errors
    }
  }, [items, hasHydrated]);

  const addItem = React.useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      setItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.variantId === item.variantId);
        if (existingIdx > -1) {
          const updated = [...prev];
          const newQty = updated[existingIdx].quantity + quantity;
          const max = item.maxStock ?? Infinity;
          const finalQty = item.allowBackorder ? newQty : Math.min(newQty, max);
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: finalQty,
          };
          return updated;
        }
        return [...prev, { ...item, quantity }];
      });
      setIsOpen(true);
    },
    []
  );

  const removeItem = React.useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const updateQuantity = React.useCallback(
    (variantId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(variantId);
        return;
      }
      setItems((prev) =>
        prev.map((item) => {
          if (item.variantId !== variantId) return item;
          const max = item.maxStock ?? Infinity;
          const finalQty = item.allowBackorder ? quantity : Math.min(quantity, max);
          return { ...item, quantity: finalQty };
        })
      );
    },
    [removeItem]
  );

  const clearCart = React.useCallback(() => {
    setItems([]);
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const openCart = React.useCallback(() => setIsOpen(true), []);
  const closeCart = React.useCallback(() => setIsOpen(false), []);
  const toggleCart = React.useCallback(() => setIsOpen((prev) => !prev), []);

  const itemCount = React.useMemo(
    () => items.reduce((acc, curr) => acc + curr.quantity, 0),
    [items]
  );

  const subtotal = React.useMemo(
    () => items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        isOpen,
        isMounted,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        openCart,
        closeCart,
        toggleCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = React.useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
