/**
 * Real coastline geometry from Natural Earth 1:110m admin-0 countries,
 * public domain (https://www.naturalearthdata.com/about/terms-of-use/).
 * Source: https://github.com/nvkelso/natural-earth-vector
 * Features: ADMIN=United Kingdom and ADMIN=Ireland.
 * Coordinates transformed through the same equirectangular bounds as
 * source-record Atlas locations (west -11.5 east 4 south 49 north 60.5).
 * Low-resolution cartography for exploration, not survey boundaries.
 */
export const UK_LAND_OUTLINES={
  britain:"M328.4,415.2 L281.6,402.3 L243.3,403.2 L256.0,369.7 L243.3,336.1 L295.2,333.5 L361.6,372.2 L328.4,415.2 Z M520.6,444.2 L520.7,444.2 L529.9,407.9 L488.4,369.3 L487.4,368.5 L412.2,357.4 L397.5,340.5 L420.0,312.5 L399.6,295.3 L366.3,324.9 L362.6,264.5 L331.4,232.6 L353.8,167.9 L402.0,117.1 L451.4,122.0 L526.1,116.8 L459.9,184.5 L523.0,175.9 L590.9,176.3 L574.8,227.3 L519.1,283.4 L583.1,287.4 L588.0,294.0 L643.2,367.8 L685.6,377.9 L723.7,449.2 L741.4,473.9 L816.4,485.9 L808.9,525.9 L777.3,544.3 L802.1,576.7 L746.3,609.4 L663.5,608.9 L558.0,626.1 L529.2,613.8 L488.2,643.1 L430.9,636.0 L387.4,659.9 L354.5,647.4 L445.3,581.6 L500.8,568.1 L500.3,568.1 L403.5,557.6 L386.0,532.7 L450.7,513.3 L416.8,479.6 L428.6,438.6 L520.6,444.2 Z",
  ireland:"M328.4,415.2 L338.6,460.0 L291.8,515.9 L182.0,552.9 L94.3,543.4 L144.5,478.0 L112.2,414.4 L196.5,365.4 L243.3,336.1 L256.0,369.7 L243.3,403.2 L281.6,402.3 L328.4,415.2 Z"
} as const;
