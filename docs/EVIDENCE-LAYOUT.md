# Compare, Planet overview and Sources

15 November 2026. This implements the three approved design previews using
the existing real datasets and runtime comparison. Generated concept images,
illustrative locations and mockup numbers are not used as application data.

## Compare

The initial state asks the user to select a search pair or explicitly confirm
a manual comparison. Previously loaded Earth windows remain available. A
reference pair is not silently presented as a fresh search result.

The selected Earth and planetary areas appear first, with elevation-derived
shaded-relief thumbnails, actual coordinates, measured mean slopes and relief.
Bars use a common zero-based scale within each measurement. The summary is
calculated from the selected pair's actual measurements. The index still uses
full slope distributions and relief under the recorded weights; mean slope is
a readable summary, not a replacement scoring model.

Other discovered pairs and the loaded-Earth ranking are under **Other matching
pairs**. Target and Earth selectors, source-support counts, coverage findings,
task measures, temperature evidence, profiles, slope histograms, characterization,
footprint sensitivity where available, literature and notebook exports remain
under **Detailed charts & analysis**. Selecting an evidence row opens that
analysis section. The thermal entry point opens the same section. Open sections
are retained when the selected location changes.

The common grid is dynamic: 2 km / 4 km gradients for automatic planetary
search windows, 500 m / 1 km for reference comparisons. A coverage exclusion
withholds the index and proposed exercise while retaining full-window evidence.
Export JSON and Markdown retain the existing measured data and provenance.

## Planet overview

The hero uses real body dimensions, original agency mosaics, and the existing
globe's source-derived numeric geometry. Its static WebGL preview fits each body
to its frame; the separate SVG size comparison preserves relative physical size.
If WebGL or a loaded texture is unavailable, the original published map can be
shown directly. No artificial surface or replacement observation is generated.
Elevation thumbnails are a labelled display palette calculated from the actual
1° global numeric grid, distinct from local comparison grids.

Surface and elevation actions switch the actual Explore globe layer. The
environment action opens the full existing facts, dated Earth layers, daily
NASA POWER records, dated EONET events and the body-specific reference records.
Technical details retain physical reference figures, coordinate frames, image
registration, dates, original-byte hashes, links and DEM provenance.

Browsing another body changes the globe view without replacing the selected
comparison target. Jezero pressure is explicitly labelled as a reference-location
record; arbitrary Martian targets do not inherit it as local weather. Source
metadata requests can be retried after failure.

## Sources

Two cards describe the selected Earth/planetary data, with original product
links and labels where available. Native source posting and output analysis
spacing are separate. Observation dates come from recorded source metadata.
Unknown metadata remain unavailable and unsafe URLs are not made into links.

The visible method has three steps and concise interpretation limits. Exact
selected provenance, search coverage, the loaded-window table, existing method
details and exclusion notes are under **Inspect source records**. The complete
source catalogue, licences, contextual citations, thermal source information
and visual credits remain under **All project sources & visual credits**.

## Verification

Functional DOM checks cover initial/manual states, location changes, real-number
binding, disclosure behaviour, source links/records, both automatic body types,
return navigation, global versus local scales, environment records, unavailable
thermal data, coverage exclusions and both scientific exports. Browser geometry,
imagery assets and the 324-tile search atlas remain verified by the existing
checks. These are functional/data checks; they do not claim visual/GPU QA.
