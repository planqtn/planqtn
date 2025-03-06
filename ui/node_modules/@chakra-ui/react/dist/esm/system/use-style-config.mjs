'use client';
import { resolveStyleConfig } from '@chakra-ui/styled-system';
import { memoizedGet, mergeWith, compact, omit } from '@chakra-ui/utils';
import { useRef } from 'react';
import isEqual from 'react-fast-compare';
import { useChakra } from './hooks.mjs';

function useStyleConfigImpl(themeKey, props = {}) {
  const { styleConfig: styleConfigProp, ...rest } = props;
  const { theme, colorMode } = useChakra();
  const themeStyleConfig = themeKey ? memoizedGet(theme, `components.${themeKey}`) : void 0;
  const styleConfig = styleConfigProp || themeStyleConfig;
  const mergedProps = mergeWith(
    { theme, colorMode },
    styleConfig?.defaultProps ?? {},
    compact(omit(rest, ["children"])),
    (obj, src) => !obj ? src : void 0
  );
  const stylesRef = useRef({});
  if (styleConfig) {
    const getStyles = resolveStyleConfig(styleConfig);
    const styles = getStyles(mergedProps);
    const isStyleEqual = isEqual(stylesRef.current, styles);
    if (!isStyleEqual) {
      stylesRef.current = styles;
    }
  }
  return stylesRef.current;
}
function useStyleConfig(themeKey, props = {}) {
  return useStyleConfigImpl(themeKey, props);
}
function useMultiStyleConfig(themeKey, props = {}) {
  return useStyleConfigImpl(themeKey, props);
}

export { useMultiStyleConfig, useStyleConfig };
