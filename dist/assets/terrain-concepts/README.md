# Illustrative terrain textures

Four AI-generated base-color material concepts for the Expedition 3D surface:

- `moon-highlands.png`: pale rough lunar regolith.
- `moon-mare.png`: dark smoother lunar regolith.
- `mars-layered.png`: rusty layered bedrock.
- `mars-dunes.png`: reddish rippled sand.

Generated with the built-in image generation tool on 15 November 2026. Exact
prompts are retained in `generation.json`. These are hypothetical visual assets,
not NASA observations, coordinate-specific terrain, elevation or geological
evidence. No physical pixel scale or observed rock locations are assigned.
Seamless tiling was requested but edge continuity is not technically certified.

These assets are loaded by Expedition as illustrative albedo. Smooth and rough
materials blend using a slope-based artistic convention, not inferred geology.
Coordinate-derived decorative seeds vary UV placement and illustrative rocks.
Slope, elevation and thermal analysis layers do not use these material maps.
Coordinate-specific surfaces require georeferenced imagery and elevation data;
changing a material alone does not reconstruct a different landing location.
