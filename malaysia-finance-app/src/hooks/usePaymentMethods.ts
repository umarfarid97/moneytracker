import { useData } from './DataProvider';

export function usePaymentMethods() {
  const { paymentMethods, paymentMethodOps } = useData();
  return { data: paymentMethods, ...paymentMethodOps };
}
