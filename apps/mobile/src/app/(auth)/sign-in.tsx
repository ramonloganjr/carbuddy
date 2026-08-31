import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Card, Text, TextField, useTheme } from '../../design-system';
import { useSession } from '../../features/auth/sessionStore';

export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const signIn = useSession((state) => state.signIn);
  const error = useSession((state) => state.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit = emailValid && password.length >= 8 && !submitting;

  const handleSubmit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    const success = await signIn(email, password);
    setSubmitting(false);
    if (success) router.replace('/');
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
        <View style={{ gap: 12, alignItems: 'center' }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primaryContainer,
            }}
          >
            <MaterialIcons
              name="directions-car"
              size={36}
              color={theme.colors.onPrimaryContainer}
            />
          </View>
          <Text variant="displaySmall" align="center" accessibilityRole="header">
            CarBuddy
          </Text>
          <Text variant="bodyLarge" color="onSurfaceVariant" align="center">
            Know your car. Understand its costs. Maintain it on time.
          </Text>
        </View>

        <View style={{ gap: 16 }}>
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

          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            leadingIcon="lock-outline"
            trailingIcon={showPassword ? 'visibility-off' : 'visibility'}
            trailingIconLabel={showPassword ? 'Hide password' : 'Show password'}
            onTrailingIconPress={() => setShowPassword((visible) => !visible)}
            error={
              touched && password.length < 8 ? 'Passwords are at least 8 characters' : undefined
            }
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          {error ? (
            <Card variant="filled" background={theme.colors.errorContainer} padding={12}>
              <View
                style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
                accessibilityLiveRegion="assertive"
              >
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
            label="Sign in"
            size="large"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
            onPress={handleSubmit}
          />

          <Button
            label="Create an account"
            variant="text"
            fullWidth
            onPress={() => router.push('/(auth)/sign-up')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
