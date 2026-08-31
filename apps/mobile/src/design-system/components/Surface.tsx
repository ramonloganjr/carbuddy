import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, SURFACE_AT_ELEVATION, type ElevationLevel } from '../tokens/elevation';
import { SHAPE, type ShapeToken } from '../tokens/shape';

export interface SurfaceProps extends ViewProps {
  level?: ElevationLevel;
  shape?: ShapeToken | number;
  /** Draw a 1dp outline instead of a shadow — the M3 "outlined" container. */
  outlined?: boolean;
  /** Override the tonal surface; use a container role, not a raw hex. */
  background?: string;
  style?: ViewStyle | ViewStyle[];
}

/**
 * A tonal Material 3 surface.
 *
 * Depth here comes from the surface-container tone that matches the elevation,
 * with the shadow playing a supporting role. That ordering is what makes dark
 * mode look correct: the classic approach of laying translucent white over a
 * dark surface washes the hue out, whereas the container tones are generated
 * from the same palette and stay in family.
 */
export const Surface = React.forwardRef<View, SurfaceProps>(function Surface(
  { level = 0, shape = 'large', outlined = false, background, style, children, ...rest },
  ref,
) {
  const theme = useTheme();
  const radius = typeof shape === 'number' ? shape : SHAPE[shape];
  const surfaceRole = SURFACE_AT_ELEVATION[level];

  return (
    <View
      ref={ref}
      {...rest}
      style={[
        {
          backgroundColor: background ?? theme.colors[surfaceRole],
          borderRadius: radius,
          ...(outlined
            ? { borderWidth: 1, borderColor: theme.colors.outlineVariant }
            : elevation(level, theme.colors.shadow)),
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
});
