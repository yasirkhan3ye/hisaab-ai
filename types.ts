
export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  date: string;
  type: TransactionType;
  description: string;
}

export type LendStatus = 'pending' | 'returned' | 'partial';
export type CurrencyType = 'EUR' | 'PKR';

export interface Repayment {
  id: string;
  amount: number;
  currency: CurrencyType;
  exchangeRateAtRepayment: number;
  date: string;
}

export interface LendRecord {
  id: string;
  personName: string;
  amount: number; // Original principal
  currency: CurrencyType;
  exchangeRateAtLending: number; // The fixed rate for that day
  dateLent: string;
  dueDate: string;
  status: LendStatus;
  description: string;
  repayments: Repayment[]; // List of partial payments
}

export interface WalletState {
  balance: number;
  transactions: Transaction[];
}

export interface UserProfile {
  name: string;
  avatarSeed: string;
  photo?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  type: 'info' | 'alert' | 'success';
}
