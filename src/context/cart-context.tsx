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
const EMPTY_CART: CartItem[] = [];

let memoryCart: CartItem[] = EMPTY_CART;
let isInitialized = false;

function loadFromStorage(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;
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
  return EMPTY_CART;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setStoreItems(newItems: CartItem[]) {
  memoryCart = newItems;
  if (typeof window !== "undefined") {
    try {
      if (newItems.length === 0) {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      } else {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
      }
    } catch {
      // Ignore quota errors
    }
  }
  notify();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === CART_STORAGE_KEY) {
      memoryCart = loadFromStorage();
      notify();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

function getSnapshot(): CartItem[] {
  if (!isInitialized && typeof window !== "undefined") {
    memoryCart = loadFromStorage();
    isInitialized = true;
  }
  return memoryCart;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY_CART;
}

const emptySubscribe = () => () => {};

const CartContext = React.createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = React.useState(false);
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const addItem = React.useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      const prev = getSnapshot();
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
        setStoreItems(updated);
        return;
      }
      setStoreItems([...prev, { ...item, quantity }]);
    },
    []
  );

  const removeItem = React.useCallback((variantId: string) => {
    const prev = getSnapshot();
    setStoreItems(prev.filter((i) => i.variantId !== variantId));
  }, []);

  const updateQuantity = React.useCallback(
    (variantId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(variantId);
        return;
      }
      const prev = getSnapshot();
      setStoreItems(
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
    setStoreItems(EMPTY_CART);
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
