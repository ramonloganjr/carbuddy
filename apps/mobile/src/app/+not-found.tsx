import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '../design-system';

export default function NotFound() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <EmptyState
        icon="explore-off"
        title="We couldn't find that"
        description="The link may be out of date, or the record may have been removed."
        actionLabel="Go to dashboard"
        onAction={() => router.replace('/(tabs)')}
      />
    </View>
  );
}
