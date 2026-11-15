# Terrain preview rendering

Compare renders the full input DEM footprint into a 1024-pixel-wide PNG. Smaller
cards use cached 256-pixel-wide images. Output aspect follows the physical width
and depth of the input study area. The image is contained inside its display
frame instead of enlarged and cropped with `object-fit: cover`. Captions sit
outside Compare maps and identify the study extent and actual sampling grid.

Color is an elevation tint scaled independently from each area's minimum to
maximum. Hillshade uses source-grid slopes in physical metres, northwest light
at 45 degrees, and no vertical exaggeration. Both fields are bilinearly sampled
for display. Interpolated contour lines use rounded display intervals, at least
5 m, and are omitted when the area's elevation range is below 10 m. Their line
positions are interpolations of the same grid, not additional observations.
Color is not observed surface material, optical imagery or a common
cross-planet elevation scale. Numerical terrain measurements remain the basis
for comparison.

More output pixels reduce display enlargement artifacts; they do not create
new measurements or native-resolution information. A flat DEM stays uniform.
A 17 × 17 automatic grid remains a 2 km sampling grid even when displayed in a
1024 × 1024 PNG. Source heights, search indexes and similarity scores are not
modified by rendering. Missing input data do not fall back to an unrelated
Jezero photograph.

Cached previews are keyed by the input data object and output width, and are
invalidated when a location's terrain is replaced. Tests cover full-footprint
corners, physical aspect, uniform flat terrain, invalid grids and preservation
of all reference heights, alongside existing comparison and search UI flows.
