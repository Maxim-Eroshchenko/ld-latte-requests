import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { errorMessage } from "../lib/model";
const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  error: string;
}>({ session: null, loading: true, error: "" });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let eventReceived = false;
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      eventReceived = true;
      if (active) {
        setSession(s);
        setLoading(false);
        setError("");
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !eventReceived) {
          setSession(data.session);
          setError(error ? errorMessage(error) : "");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active && !eventReceived) {
          setError(errorMessage(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider value={{ session, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
