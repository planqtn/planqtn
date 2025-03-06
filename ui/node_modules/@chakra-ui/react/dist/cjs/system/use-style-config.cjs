'use client';
'use strict';

var styledSystem = require('@chakra-ui/styled-system');
var utils = require('@chakra-ui/utils');
var React = require('react');
var isEqual = require('react-fast-compare');
var hooks = require('./hooks.cjs');

function useStyleConfigImpl(themeKey, props = {}) {
  const { styleConfig: styleConfigProp, ...rest } = props;
  const { theme, colorMode } = hooks.useChakra();
  const themeStyleConfig = themeKey ? utils.memoizedGet(theme, `components.${themeKey}`) : void 0;
  const styleConfig = styleConfigProp || themeStyleConfig;
  const mergedProps = utils.mergeWith(
    { theme, colorMode },
    styleConfig?.defaultProps ?? {},
    utils.compact(utils.omit(rest, ["children"])),
    (obj, src) => !obj ? src : void 0
  );
  const stylesRef = React.useRef({});
  if (styleConfig) {
    const getStyles = styledSystem.resolveStyleConfig(styleConfig);
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

exports.useMultiStyleConfig = useMultiStyleConfig;
exports.useStyleConfig = useStyleConfig;
