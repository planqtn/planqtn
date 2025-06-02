import { Box, Text } from "@chakra-ui/react";

export const BlochSphereLoader: React.FC = () => {
  return (
    <Box p={4} display="flex" justifyContent="center" alignItems="center">
      <svg width="100" height="100" viewBox="-50 -50 100 100">
        {/* Circle (sphere outline) */}
        <circle
          cx="0"
          cy="0"
          r="40"
          fill="none"
          stroke="#3182CE"
          strokeWidth="2"
          opacity="0.3"
        />
        {/* Rotating arrow (state vector) */}
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="-40"
          stroke="#3182CE"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="2s"
            repeatCount="indefinite"
          />
        </line>
        {/* Equator ellipse */}
        <ellipse
          cx="0"
          cy="0"
          rx="40"
          ry="15"
          fill="none"
          stroke="#3182CE"
          strokeWidth="1"
          opacity="0.3"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="4s"
            repeatCount="indefinite"
          />
        </ellipse>
      </svg>
      <Text ml={4} color="blue.600" fontWeight="medium">
        Calculating weight enumerator...
      </Text>
    </Box>
  );
};
