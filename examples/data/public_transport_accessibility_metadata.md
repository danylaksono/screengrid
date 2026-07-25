# The Public Transport Accessibility data

The Public Transport Accessibility data represent accessibility to select amenities in the UK at LSOA level. See Verduzco et. al. (2024) for details on the dataset.

> **Note on the shipped file.** This document describes the *source* columns. The
> committed dataset is `ptal-london.json` — the Greater London subset (4,835
> LSOAs), reduced to the `_pct_` columns described below and stored columnar to
> keep it at 1.1 MB. `ptal-loader.js` expands it back to per-LSOA GeoJSON
> features. The full 19.1 MB extract remains in git history at
> `d78801d:examples/data/public_transport_accessibility.json`; see
> `scripts/ptal/slim-ptal.mjs` to regenerate.

<table>
    <thead>
        <tr>
            <th>File</th>
            <th>Measure</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <th colspan="3" style="text-align: left; background-color: #f2f2f2;">Education: Primary schools and secondary schools</th>
        </tr>
        <tr>
            <td>schools/access_school_pt.csv</td>
            <td>Cumulative: time cut 15, 30, 45, 60, 75, 90, 105, 120</td>
            <td>Number of primary schools within N minutes by public transport</td>
        </tr>
        <tr>
            <td>schools/access_school_pt.csv</td>
            <td>Relative cumulative: time cut 15, 30, 45, 60, 75, 90, 105, 120</td>
            <td>Number of primary schools within N minutes by public transport divided by the total primary schools in Great Britain</td>
        </tr>
        <tr>
            <td>schools/access_school_pt.csv</td>
            <td>Minimum travel time</td>
            <td>Travel time in minutes to the closest primary school</td>
        </tr>
        <tr>
            <td>schools/access_school_pt.csv</td>
            <td>Cumulative: time cut 15, 30, 45, 60, 75, 90, 105, 120</td>
            <td>Number of secondary schools within N minutes by public transport</td>
        </tr>
        <tr>
            <td>schools/access_school_pt.csv</td>
            <td>Relative cumulative: time cut 15, 30, 45, 60, 75, 90, 105, 120</td>
            <td>Number of secondary schools within N minutes by public transport divided by the total secondary schools in Great Britain</td>
        </tr>
        <tr>
            <td>schools/access_school_pt.csv</td>
            <td>Minimum travel time</td>
            <td>Travel time in minutes to the closest secondary school</td>
        </tr>
        <tr>
            <th colspan="3" style="text-align: left; background-color: #f2f2f2;">Urban centre: city and greater city</th>
        </tr>
        <tr>
            <td>urban_centre/access_cities_pt.csv</td>
            <td>Minimum travel time</td>
            <td>Travel time in minutes to the closest city</td>
        </tr>
        <tr>
            <td>urban_centre/access_cities_pt.csv</td>
            <td>Minimum travel time</td>
            <td>Travel time in minutes to the closes greater city</td>
        </tr>
        <tr>
            <th colspan="3" style="text-align: left; background-color: #f2f2f2;">Supermarkets</th>
        </tr>
        <tr>
            <td>supermarket/access_supermaet_pt.csv</td>
            <td>Cumulative: time cut 15, 30, 45, 60, 75, 90, 105, 120</td>
            <td>Number of supermarkets within N minutes by public transport</td>
        </tr>
        <tr>
            <td>supermarket/access_supermaet_pt.csv</td>
            <td>Relative cumulative: time cut 15, 30, 45, 60, 75, 90, 105, 120</td>
            <td>Number of supermarkets within N minutes by public transport divided by the total number of supermarkets in Great Britain</td>
        </tr>
        <tr>
            <td>supermarket/access_supermaet_pt.csv</td>
            <td>Minimum travel time</td>
            <td>Travel time in minutes to the closes supermarket</td>
        </tr>
    </tbody>
</table>



We exclude urban accessibilities, as it lacks the time cut attributes. We further processed the data as follow:

```
key_data = Array(6) ["employment", "supermarket", "school_primary", "school_secondary", "gp", "hospitals"]
minutes = Array(8) [15, 30, 45, 60, 75, 90, 105, 120]
```

The `pct` in the variable denotes percentage of the dataset normalised to the global data in the UK. We filter the data to only use columns with percentage values, and exclude the raw data. This might be changed in the future depending on the visualisation requirements.

The final data is combined with LSOA boundaries.