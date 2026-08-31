import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPE_SCALE, type TypeRole } from '../tokens/typography';
import type { ColorScheme } from '../tokens/colors';

/** Colour roles text is allowed to use. Arbitrary hex is deliberately not an option. */
export type TextColorRole = keyof Pick<
  ColorScheme,
  | 'onSurface'
  | 'onSurfaceVariant'
  | 'onPrimary'
  | 'onPrimaryContainer'
  | 'onSecondaryContainer'
  | 'onTertiaryContainer'
  | 'onErrorContainer'
  | 'onSuccessContainer'
  | 'onWarningContainer'
  | 'onInfoContainer'
  | 'primary'
  | 'error'
  | 'success'
  | 'warning'
  | 'info'
  | 'outline'
  | 'inverseOnSurface'
>;

export interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TypeRole;
  color?: TextColorRole;
  align?: TextStyle['textAlign'];
  style?: TextStyle | TextStyle[];
  children?: React.ReactNode;
}

/**
 * The only text primitive in the app.
 *
 * Constraining callers to a type role and a colour role — rather than free
 * `fontSize` and `color` — is what actually keeps a design system coherent
 * once several screens are being built in parallel. It also lets every text
 * node carry the right `maxFontSizeMultiplier` automatically, so Dynamic Type
 * and Android font scaling work everywhere without each screen remembering.
 */
export const Text = React.memo(function Text({
  variant = 'bodyMedium',
  color = 'onSurface',
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const token = TYPE_SCALE[variant];

  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={token.maxFontSizeMultiplier}
      style={[
        {
          fontSize: token.fontSize,
          lineHeight: token.lineHeight,
          letterSpacing: token.letterSpacing,
          fontWeight: token.fontWeight,
          color: theme.colors[color],
          ...(token.fontVariant ? { fontVariant: token.fontVariant } : {}),
          ...(align ? { textAlign: align } : {}),
        },
        style as TextStyle,
      ]}
    >
      {children}
    </RNText>
  );
});
