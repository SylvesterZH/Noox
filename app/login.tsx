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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fontSizes, spacing } from '../lib/design';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Redirect authenticated users to home
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [authLoading, user]);

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
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={[styles.logo, { color: colors.primary }]}>NOOX</Text>
        <Text style={[styles.tagline, { color: colors.onSurfaceVariant }]}>
          Your second brain, indexed.
        </Text>
      </View>

      {/* Form Card */}
      <View style={styles.card}>
        <Text style={[styles.formTitle, { color: colors.onSurface }]}>
          {isSignUp ? 'Create account' : 'Welcome back'}
        </Text>

        {/* Email input */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <MaterialCommunityIcons name="email-outline" size={20} color={colors.onSurfaceVariant} style={{ marginRight: spacing.md }} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Email address"
            placeholderTextColor={colors.outline}
            value={email}
            onChangeText={(t) => { setEmail(t); setErrorMsg(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password input */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <MaterialCommunityIcons name="lock-outline" size={20} color={colors.onSurfaceVariant} style={{ marginRight: spacing.md }} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Password"
            placeholderTextColor={colors.outline}
            value={password}
            onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
            secureTextEntry
          />
        </View>

        {/* Error message */}
        {errorMsg && (
          <View style={[styles.errorContainer, { backgroundColor: colors.errorContainer }]}>
            <MaterialCommunityIcons name="alert-circle" size={16} color={colors.onErrorContainer} />
            <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>{errorMsg}</Text>
          </View>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: colors.primary },
            loading && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>
            {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        {/* Toggle sign in / sign up */}
        <TouchableOpacity style={styles.toggleBtn} onPress={() => {
          setIsSignUp(!isSignUp);
          setErrorMsg(null);
          setPassword('');
        }}>
          <Text style={[styles.toggleText, { color: colors.onSurfaceVariant }]}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom padding */}
      <View style={{ height: insets.bottom + spacing.xl }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  logo: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: 'transparent',
    gap: spacing.md,
  },
  formTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
  },
  errorText: {
    fontSize: fontSizes.sm,
    flex: 1,
  },
  submitBtn: {
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontWeight: '700',
    fontSize: fontSizes.md,
    letterSpacing: 0.5,
  },
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleText: {
    fontSize: fontSizes.sm,
  },
});