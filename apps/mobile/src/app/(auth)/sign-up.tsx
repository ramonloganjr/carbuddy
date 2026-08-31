import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Card, LinearProgress, Text, TextField, useTheme } from '../../design-system';
import { useSession } from '../../features/auth/sessionStore';

/**
 * Password strength, scored on length and character variety.
 *
 * Shown as guidance rather than enforcement beyond the 8-character floor.
 * Aggressive composition rules ("must contain a symbol") push people toward
 * `Password1!` — predictable, and weaker than a long passphrase — so length is
 * what the meter rewards most.
 */
function scorePassword(password: string): { score: number; label: string } {
  if (password.length === 0) return { score: 0, label: '' };

  let score = 0;
  if (password.length >= 8) score += 0.25;
  if (password.length >= 12) score += 0.25;
  if (password.length >= 16) score += 0.2;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 0.15;
  if (/\d/.test(password)) score += 0.075;
  if (/[^A-Za-z0-9]/.test(password)) score += 0.075;

  const clamped = Math.min(score, 1);
  const label = clamped < 0.4 ? 'Weak' : clamped < 0.7 ? 'Fair' : clamped < 0.9 ? 'Good' : 'Strong';
  return { score: clamped, label };
}

export default function SignUpScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const signUp = useSession((state) => state.signUp);
  const error = useSession((state) => state.error);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit = name.trim().length > 0 && emailValid && password.length >= 8 && !submitting;

  const handleSubmit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    const success = await signUp(email, password, name);
    setSubmitting(false);
    if (success) router.replace('/(onboarding)');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          gap: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 8 }}>
          <Text variant="displaySmall" accessibilityRole="header">
            Create your account
          </Text>
          <Text variant="bodyLarge" color="onSurfaceVariant">
            Your vehicles, fuel log and documents, synced securely across your devices.
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <TextField
            label="Your name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            textContentType="name"
            leadingIcon="person-outline"
            error={touched && name.trim().length === 0 ? 'Tell us what to call you' : undefined}
          />

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            leadingIcon="mail-outline"
            error={touched && !emailValid ? 'Enter a valid email address' : undefined}
          />

          <View style={{ gap: 8 }}>
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              leadingIcon="lock-outline"
              supportingText="At least 8 characters. Longer is stronger than complicated."
              error={touched && password.length < 8 ? 'Use at least 8 characters' : undefined}
            />
            {password.length > 0 ? (
              <LinearProgress
                progress={strength.score}
                status={strength.score < 0.4 ? 'overdue' : strength.score < 0.7 ? 'due_soon' : 'ok'}
                label={`Password strength: ${strength.label}`}
                accessibilityLabel={`Password strength ${strength.label}`}
                height={4}
              />
            ) : null}
          </View>

          {error ? (
            <Card variant="filled" background={theme.colors.errorContainer} padding={12}>
              <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLiveRegion="assertive">
                <MaterialIcons
                  name="error-outline"
                  size={20}
                  color={theme.colors.onErrorContainer}
                />
                <Text
                  variant="bodyMedium"
                  style={{ flex: 1, color: theme.colors.onErrorContainer }}
                >
                  {error}
                </Text>
              </View>
            </Card>
          ) : null}

          <Button
            label="Create account"
            size="large"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
            onPress={handleSubmit}
          />

          <Button
            label="I already have an account"
            variant="text"
            fullWidth
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
