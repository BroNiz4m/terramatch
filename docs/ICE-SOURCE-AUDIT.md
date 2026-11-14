# Ice-source audit — 14 November 2026

This is a source audit, not an implemented ice module. The application, its 17
bundled datasets, terrain scores and live release were not changed. The decision
is to build **separate evidence layers**, with the gates below resolved before
claiming a validated ice map. There is no justified common ice-match percentage.

Machine-readable access evidence and source-record hashes are in
[research/ice-audit-2026-11-14/probes.json](research/ice-audit-2026-11-14/probes.json).

## Decision matrix

| Source | What it can support | Access checked | Decision |
| --- | --- | --- | --- |
| Diviner PRP `ice_depth` | Modelled sublimation-stability depth | Label and five exact source facets | Use only as model evidence; unresolved negative values prevent complete classification |
| M3 surface-ice results | Published spectral evidence of exposed surface ice | NASA account of the study; no analysis-ready detection mask acquired | Context now; defer mapped detections until an attributable georeferenced dataset is obtained |
| GLIMS | Dated mapped glacier extent | REST metadata and bounds succeed; three tested WFS/WMS URLs return 404 | Candidate Earth inventory source; full outline geometry still required |
| ESA WorldCover 2021 v200 | Classified persistent snow/glacier cover | Exact 4 KiB COG range and TIFF metadata succeed | Candidate Earth raster source; numerical pixels and quality layer still need extraction |
| MODIS MOD10A1.061 | Daily snow-cover observations | NSIDC product documentation | Optional temporal context; Earthdata Login is required for scientific downloads |

## Moon: a model is not a detection

The [Diviner product label](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.xml)
defines `ice_depth` as a calculated depth under a sublimation-loss criterion of
1 kg m^-2 per billion years. Its zero convention describes surface stability, not
measured ice. The label excludes depths above 2.8738 m with `-999`; the
[SIS, section 7.1, page 54](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/document/Diviner_RDR_SIS.pdf)
instead lists `-32768`. This discrepancy must remain visible.

The existing thermal provenance lets us request the same actual facets. Five
210-byte records were retrieved with HTTP 206. Their `temp_max` values exactly
match the corresponding bundled thermal samples. Byte positions 198–208 hold:

| Terrain sample index | Source record | Annual surface maximum, K | Raw `ice_depth`, m | Audit interpretation |
| --- | --- | --- | --- | --- |
| 0 | 1395568 | 163.900 | 0.00670 | Positive model depth |
| 2112, window centre | 1470031 | 85.199 | -1.00000 | Unresolved negative value |
| 387 | 1407690 | 45.332 | -1.00000 | Unresolved negative value |
| 1068 | 1431623 | 347.495 | 0.10419 | Positive model depth |
| 4224 | 1546894 | 211.361 | 0.03767 | Positive model depth |

These are five probes, not a completed 4,225-point ice analysis. The inspected
documentation did not establish the meaning of `-1`. Preserve it as unresolved;
do not clamp it to zero, call it no ice, or infer surface ice from temperature.
No change to the existing valid `temp_max` data is indicated by this finding.

NASA's [M3 surface-ice account](https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles/)
describes infrared spectral evidence from Chandrayaan-1, which is a different
evidence class. The publication DOI is `10.1073/pnas.1802345115`. Full article and
supplement access was not completed in this audit. A publication illustration
cannot substitute for a georeferenced detection dataset, nor establish a
detection at every location within TerraMatch's Shackleton window.

## Earth: GLIMS inventory route

[GLIMS documentation](https://www.glims.org/glacierdata/index.php) describes dated
glacier polygons and OGC access. During this audit the generic WFS URL and the
viewer-configured GLIMS WFS/WMS paths returned HTTP 404. This is an observed
access result, not a statement that all GLIMS data are unavailable.

The provider's [REST discovery endpoint](https://www.glims.org/services) works.
`search` and `glacierbounds` returned HTTP 200 with an
`Access-Control-Allow-Origin` header allowing the current Site origin. Search
results can repeat one analysis for multiple contributors: the Longyearbreen
query returned 20 rows but five distinct analysis IDs, spanning two glacier IDs.
Deduplicate before selecting or summing anything.

An access example, **not a newly established lunar analog**, is:

- Glacier: Longyearbreen, Svalbard, ID `G015474E78170N`.
- Selected analysis: `994985`; source observation date `2016-08-23`, analysis date
  `2020-07-13`.
- Provider-reported glacier area: 1.59787 km²; not an area measured in our 32 km window.
- Bounds: west 15.421543°, south 78.161203°, east 15.532312°, north 78.189819°.
- [Metadata query](https://www.glims.org/services/search?glac_name=Longyearbreen&results_count=50),
  [bounds query](https://www.glims.org/services/glacierbounds?anlys_id=994985).

The bounds response is not a polygon. No full outline, raster mask, contemporary
ice extent or window ice percentage has been verified. Observation date takes
precedence over processing date, and historical/split outlines require care.

The official download page describes internal-rock exclusions and bundled
analysis-specific citations; both must be retained when full outlines are
obtained. See [download conventions](https://www.glims.org/maps/download) and
[dataset citation](https://nsidc.org/data/nsidc-0272/versions/1), DOI
`10.7265/N5V98602`. A prepackaged download link redirected to Earthdata Login.

**Location guard:** a name search for Taylor Glacier returned an Alaska record
(`G211358E60580N`), not the intended Antarctic glacier. Adding `country=AQ` in the
tested request did not remove that result. Validate actual geometry/coordinates;
do not rely on names or that filter as used. Canada Glacier returned zero rows,
which does not establish no ice or complete regional coverage.

## Earth: raster alternative and temporal context

[ESA WorldCover's manual](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf)
defines class 70 as persistent snow or glacier cover. It does not separate snow
from glacier ice, or measure purity, buried ice or thickness. The product excludes
Antarctica and ends at 82.75° N. The 2021 v200 map has a separate input-quality
layer; glacier/shadow confusion and classification errors must be considered.

The Svalbard-area tile `ESA_WorldCover_10m_2021_v200_N78E015_Map.tif` returned
HTTP 206 for bytes 0–4095: a valid single-band, 8-bit, 36,000 × 36,000 TIFF with
compression code 8. The probe had no allow-origin header. Metadata/range access
is verified; direct browser reads and numerical class-pixel decoding are not.
Use offline bundled ingestion or a properly supported service, not RGB WMS
colours as analysis. Adjacent tiles may be needed for a full 32 km window.

The [official access/licence page](https://esa-worldcover.org/en/data-access)
provides public S3 access and CC BY 4.0 attribution requirements. Retain the
2021 v200 identity and required ESA/Copernicus credits. Do not treat differences
from the 2020 v100 map as pure environmental change: the algorithms differ too.

[MOD10A1.061](https://nsidc.org/data/mod10a1/versions/61) is daily 500 m snow-cover
data, DOI `10.5067/MODIS/MOD10A1.061`. Cloud, polar darkness and quality flags must
be distinguished from valid clear-sky observations. NSIDC requires Earthdata
Login for downloads. It can add seasonal context, but does not by itself prove
perennial or subsurface ice. No granule was downloaded in this audit.

## Proposed implementation contract

The following are design recommendations inferred from the audit, not new
scientific measurements:

1. Store evidence type separately from availability and interpreted result:
   `spectral_detection`, `mapped_glacier_extent`, `classified_snow_or_ice`,
   `modelled_stability`, and `indirect_proxy`. Retain unknowns explicitly.
2. Every record needs source URL/ID, version, observation period, geometry/CRS,
   units or class definitions, quality flags, retrieval time and source hashes.
3. Never map glacier bounding boxes as ice polygons, missing observations as
   no ice, or negative model sentinels as measured depths.
4. Keep terrain ranking independent. A glacier outline and a lunar stability
   depth are incompatible quantities; do not generate a combined ice percentage.
5. Add an Earth polar reference only after its full terrain window and ice
   evidence are verified. Existing land-screen exclusions still apply.
6. Explain a task-specific use: field sampling, instrument workflow or
   documentation of ice-associated terrain. Atmosphere, gravity, heat transfer
   and ice occurrence remain different. Svalbard has prior analogue use according
   to [ESA](https://www.esa.int/Enabling_Support/Preparing_for_the_Future/Space_for_Earth/Arctic/Mars_in_the_Arctic)
   and [JPL](https://robotics.jpl.nasa.gov/what-we-do/research-tasks/amase-arctic-mars-analogue-svalbard-expedition/);
   this does not establish Longyearbreen as a Moon-base analog or a new discovery.

### Gates before an ice-map release

- Resolve or visibly quarantine Diviner `-1` and both documented exclusion
  conventions; verify the full selected window rather than five probes.
- Obtain full dated GLIMS geometry with internal-rock handling, or decode and
  quality-screen actual WorldCover class values. Bounds/headers are insufficient.
- Verify candidate coordinates, source dates, footprint and land-screen status.
- If adding direct lunar detections, acquire attributable georeferenced M3
  analysis data; keep absent/unevaluated pixels distinct from non-detections.
- Test coordinate registration, no-data handling, evidence labels, source
  inspection, exports and 3D overlays. Do not publish a placeholder ice mask.

## Reproduce the bounded access audit

```sh
node scripts/audit-ice-sources.mjs
```

Requires Node 22+ and public network access. It reads the existing lunar thermal
provenance and writes only `research/ice-audit-2026-11-14/probes.json`. Responses
are bounded to 1 MiB; TIFF access requires an exact range response. It retains
scientific fields and hashes, not download tokens or contributor contact details.
Metadata and API availability can change. The saved report records this run;
no application dataset, score, dependency or hosting configuration is modified.

## Follow-up — 15 November 2026

The [Longyearbreen candidate audit](LONGYEARBREEN-AUDIT.md) acquired and verified
a complete **NPI 2020** glacier polygon through the official public map service.
This resolves the geometry-acquisition gap for that historical evidence source,
not for the separate GLIMS 2016 outline whose export requires Earthdata Login.
The candidate's chosen 32 km window is deferred from ranking: Natural Earth
1:10m land mapping contradicts the app's coarse all-land screen. The application
and the release gates above remain unchanged; there is no implemented ice module.
