# Reproducible terrain ranking results

Six bundled targets; three eligible bundled Earth windows. These are terrain indices, not probabilities or validated analog suitability.

| Target | Default top | Default index | Runner-up | Gap | Navigation top/index | Fieldwork top/index |
| --- | --- | ---: | --- | ---: | --- | --- |
| Jezero Crater | Amboy Crater | 86.7 | Wadi Rum | 22.6 | Amboy Crater / 85.8 | Amboy Crater / 87.3 |
| Shackleton region | Wadi Rum | 35.2 | Amboy Crater | 20.6 | Wadi Rum / 46.0 | Wadi Rum / 27.1 |
| Cabeus crater center | Wadi Rum | 69.4 | Amboy Crater | 16.9 | Wadi Rum / 75.6 | Wadi Rum / 64.8 |
| Nobile crater center | Wadi Rum | 47.7 | Amboy Crater | 18.6 | Wadi Rum / 59.9 | Wadi Rum / 38.5 |
| Gale / Bradbury Landing | Wadi Rum | 51.7 | Amboy Crater | 1.2 | Wadi Rum / 67.6 | Wadi Rum / 39.8 |
| Eberswalde delta area | Wadi Rum | 77.2 | Amboy Crater | 4.1 | Wadi Rum / 80.5 | Wadi Rum / 74.7 |

## Jezero Crater

| Candidate | Slope distance | Relief distance | Default index |
| --- | ---: | ---: | ---: |
| Amboy Crater | 0.148148 | 0.106010 | 86.7 |
| Wadi Rum | 0.465608 | 0.161580 | 64.1 |
| Al Wahbah | 0.215168 | 0.674142 | 62.4 |

Unrounded leader intervals (boundary ties must be read separately):

- Slope weight 0.000000–1.000000: Amboy Crater.

All relief distances saturated: false. Rounded top-tie weights in the 101-scenario sweep: none.

## Shackleton region

| Candidate | Slope distance | Relief distance | Default index |
| --- | ---: | ---: | ---: |
| Wadi Rum | 0.458302 | 1.000000 | 35.2 |
| Amboy Crater | 0.775510 | 1.000000 | 14.6 |
| Al Wahbah | 0.939783 | 1.000000 | 3.9 |

Unrounded leader intervals (boundary ties must be read separately):

- Slope weight 0.000000–1.000000: Wadi Rum.

All relief distances saturated: true. Rounded top-tie weights in the 101-scenario sweep: 0.

## Cabeus crater center

| Candidate | Slope distance | Relief distance | Default index |
| --- | ---: | ---: | ---: |
| Wadi Rum | 0.198287 | 0.505022 | 69.4 |
| Amboy Crater | 0.489040 | 0.449452 | 52.5 |
| Al Wahbah | 0.843537 | 1.000000 | 10.2 |

Unrounded leader intervals (boundary ties must be read separately):

- Slope weight 0.000000–0.160458: Amboy Crater.
- Slope weight 0.160458–1.000000: Wadi Rum.

All relief distances saturated: false. Rounded top-tie weights in the 101-scenario sweep: 0.16.

## Nobile crater center

| Candidate | Slope distance | Relief distance | Default index |
| --- | ---: | ---: | ---: |
| Wadi Rum | 0.308894 | 0.920246 | 47.7 |
| Amboy Crater | 0.625850 | 0.864676 | 29.1 |
| Al Wahbah | 0.914336 | 1.000000 | 5.6 |

Unrounded leader intervals (boundary ties must be read separately):

- Slope weight 0.000000–0.149171: Amboy Crater.
- Slope weight 0.149171–1.000000: Wadi Rum.

All relief distances saturated: false. Rounded top-tie weights in the 101-scenario sweep: 0.15.

## Gale / Bradbury Landing

| Candidate | Slope distance | Relief distance | Default index |
| --- | ---: | ---: | ---: |
| Wadi Rum | 0.204334 | 1.000000 | 51.7 |
| Amboy Crater | 0.223230 | 1.000000 | 50.5 |
| Al Wahbah | 0.488536 | 1.000000 | 33.2 |

Unrounded leader intervals (boundary ties must be read separately):

- Slope weight 0.000000–1.000000: Wadi Rum.

All relief distances saturated: true. Rounded top-tie weights in the 101-scenario sweep: 0, 0.01, 0.02.

## Eberswalde delta area

| Candidate | Slope distance | Relief distance | Default index |
| --- | ---: | ---: | ---: |
| Wadi Rum | 0.170320 | 0.336120 | 77.2 |
| Amboy Crater | 0.262787 | 0.280550 | 73.1 |
| Al Wahbah | 0.617284 | 0.848681 | 30.2 |

Unrounded leader intervals (boundary ties must be read separately):

- Slope weight 0.000000–0.375381: Amboy Crater.
- Slope weight 0.375381–1.000000: Wadi Rum.

All relief distances saturated: false. Rounded top-tie weights in the 101-scenario sweep: none.

Independent numerical comparisons passed: 6078. All ten production terrain-file SHA-256 values were unchanged after analysis. Full data, hashes, all presets, the 101-weight sweep, analytic intersections and tie sets are in results.json.
