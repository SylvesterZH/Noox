import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  surface: '#fdf8fd',
  surfaceDark: '#1c1b1f',
  onSurface: '#1c1b1f',
  onSurfaceVariant: '#564334',
  white: '#ffffff',
  orange500: '#ff8a00',
  orange600: '#914c00',
  error: '#EF4444',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  // Redirect authenticated users to home
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [authLoading, user]);

  const bg = isDark ? COLORS.surfaceDark : COLORS.surface;
  const textColor = isDark ? '#fff' : COLORS.onSurface;
  const textSecondary = isDark ? '#aaa' : COLORS.onSurfaceVariant;

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Please enter your password');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const result = isSignUp
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);

      if (result.error) {
        setErrorMsg(result.error.message);
      } else {
        if (isSignUp) {
          Alert.alert(
            'Account created!',
            'Please check your email to confirm your account, then sign in.',
            [{ text: 'OK', onPress: () => setIsSignUp(false) }]
          );
          setPassword('');
        } else {
          router.replace('/');
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Logo */}
      <View style={styles.logoSection}>
        <Text style={[styles.logo, { color: COLORS.orange500 }]}>Noox</Text>
        <Text style={[styles.tagline, { color: textSecondary }]}>
          Your second brain, indexed.
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={[styles.formTitle, { color: textColor }]}>
          {isSignUp ? 'Create account' : 'Welcome back'}
        </Text>

        {/* Email input */}
        <View style={[
          styles.inputContainer,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }
        ]}>
          <MaterialCommunityIcons name="email-outline" size={20} color={textSecondary} style={{ marginRight: 12 }} />
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Email address"
            placeholderTextColor="#888"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrorMsg(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password input */}
        <View style={[
          styles.inputContainer,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }
        ]}>
          <MaterialCommunityIcons name="lock-outline" size={20} color={textSecondary} style={{ marginRight: 12 }} />
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
            secureTextEntry
          />
        </View>

        {/* Error message */}
        {errorMsg && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitBtnText}>
            {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        {/* Toggle sign in / sign up */}
        <TouchableOpacity style={styles.toggleBtn} onPress={() => {
          setIsSignUp(!isSignUp);
          setErrorMsg(null);
          setPassword('');
        }}>
          <Text style={[styles.toggleText, { color: textSecondary }]}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={{ color: COLORS.orange500, fontWeight: '600' }}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 14,
    marginTop: 8,
  },
  form: {
    gap: 12,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: COLORS.orange500,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
  },
});