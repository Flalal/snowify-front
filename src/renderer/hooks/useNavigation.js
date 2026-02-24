import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

const NavigationContext = createContext(null);
export const NavigationProvider = NavigationContext.Provider;

export function useNavigation() {
  return useContext(NavigationContext);
}
