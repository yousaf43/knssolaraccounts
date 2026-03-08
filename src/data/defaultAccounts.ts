export type Account = { id: string; name: string; accountTitle: string; code: string; reconcileDate: string; currency: string; fxBalance: number; balance: number };

export const defaultAccounts: Account[] = [
  { id: "0", name: "Cash on Hand", accountTitle: "Cash on Hand", code: "100001", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "1", name: "Faysal Bank", accountTitle: "K&S Solar Energy", code: "230901", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "2", name: "Bank Al Habib", accountTitle: "K&S Solar Energy Pvt. Ltd.", code: "230902", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "3", name: "Bank Islami Pakistan Limited", accountTitle: "K&S Solar Energy", code: "230903", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "4", name: "U MICROFINANCE BANK LIMITED", accountTitle: "K&S Solar Energy", code: "230904", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "5", name: "MEEZAN BANK", accountTitle: "KHAWAR MEHMOOD", code: "230905", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "6", name: "MOBILINK MICROFINANCE BANK", accountTitle: "K&S Solar Energy", code: "230906", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "7", name: "U-BANK LIMITED", accountTitle: "K&S Solar Energy Pvt. Ltd.", code: "230907", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "8", name: "UBL BANK LTD", accountTitle: "KHAWAR MEHMOOD", code: "230908", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "9", name: "Bank of Punjab (BOP)", accountTitle: "Bhakkar Solar House", code: "230909", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "10", name: "Bank of Punjab (BOP)", accountTitle: "BHAKKAR SOLAR HOUSE", code: "230910", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
  { id: "11", name: "UBL BANK LTD", accountTitle: "BHAKKAR SOLAR HOUSE", code: "230911", reconcileDate: "", currency: "PKR", fxBalance: 0, balance: 0 },
];
