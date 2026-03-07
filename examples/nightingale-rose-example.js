import { ScreenGridLayerGL } from "../src/index.js";
import { drawNightingaleRoseChart } from "./nightingale-rose-glyph.js";

const map = new maplibregl.Map({
  container: "map",
  style: "https://demotiles.maplibre.org/style.json",
  center: [0.07, 52.21], // Cambridge area (adjust to your data center)
  zoom: 11
});

map.on("load", async () => {
  // Load your data - adjust the URL/path to your actual data source
  // Example data structure:
  // {
  //   lat: 52.21287407591035,
  //   long: 0.07015766072019418,
  //   pv_annualgen: 62.79,
  //   ashp_suitable_pct: 76.91,
  //   gshp_suitable_pct: 79.56,
  //   insulation_epcABCD: 42.86,
  //   electricity_use: 85.27,
  //   gas_use: 100,
  //   fuel_poverty: 92.97,
  //   depriv_index: 90,
  //   score: 630.36,
  //   rank: 1
  // }
  const data = await fetch("your-data-url.json").then((r) => r.json());

  const parameters = [
    'pv_annualgen',
    'ashp_suitable_pct',
    'gshp_suitable_pct',
    'insulation_epcABCD',
    'electricity_use',
    'gas_use',
    'fuel_poverty',
    'depriv_index'
  ];

  // Store max values per parameter (computed from aggregated grid)
  // This will be updated in onAggregate callback
  let maxValuesPerParameter = {};
  
  // Function to compute max values per parameter from aggregated grid
  // Similar to your postAggrFn, but computes max values across all cells
  const computeMaxValuesFromGrid = (gridData, parameters, aggregationMode = 'average') => {
    const maxValues = {};
    
    // Initialize max values
    parameters.forEach(param => {
      maxValues[param] = 0;
    });
    
    // Iterate through all cells and compute max aggregated value per parameter
    if (gridData && gridData.cellData) {
      for (let i = 0; i < gridData.cellData.length; i++) {
        const cellDataArray = gridData.cellData[i];
        if (!cellDataArray || cellDataArray.length === 0) continue;
        
        parameters.forEach(parameter => {
          let aggregatedValue;
          
          if (aggregationMode === 'average') {
            // Average the values (useful for percentages)
            const values = cellDataArray
              .map(item => item.data && item.data[parameter] !== undefined ? item.data[parameter] : null)
              .filter(v => v !== null && !isNaN(v));
            aggregatedValue = values.length > 0 
              ? values.reduce((sum, val) => sum + val, 0) / values.length 
              : 0;
          } else {
            // Sum the values
            aggregatedValue = cellDataArray.reduce((sum, item) => {
              const value = item.data && item.data[parameter] !== undefined 
                ? item.data[parameter] 
                : 0;
              return sum + value;
            }, 0);
          }
          
          // Update max if this cell's aggregated value is higher
          if (aggregatedValue > maxValues[parameter]) {
            maxValues[parameter] = aggregatedValue;
          }
        });
      }
    }
    
    // Set minimum to 1 to avoid division by zero
    parameters.forEach(param => {
      if (maxValues[param] === 0) {
        maxValues[param] = 100; // Default fallback
      }
    });
    
    return maxValues;
  };

  // Configuration for the Nightingale Rose Chart
  const roseChartConfig = {
    // Define which parameters to visualize (8 segments)
    selected_parameters: parameters,
    
    // Weights for each parameter (controls the angular width of segments)
    // Higher weight = wider segment angle
    weights: {
      'pv_annualgen': 0.7,
      'ashp_suitable_pct': 0.8,
      'gshp_suitable_pct': 0.8,
      'insulation_epcABCD': 0.6,
      'electricity_use': 0.9,
      'gas_use': 1.0,
      'fuel_poverty': 0.9,
      'depriv_index': 0.8
    },
    
    // Colors for each segment (8 colors for 8 parameters)
    colours: [
      '#ff6b6b', // Red - pv_annualgen
      '#4ecdc4', // Teal - ashp_suitable_pct
      '#45b7d1', // Blue - gshp_suitable_pct
      '#96ceb4', // Green - insulation_epcABCD
      '#ffeaa7', // Yellow - electricity_use
      '#dda15e', // Orange - gas_use
      '#bc6c25', // Brown - fuel_poverty
      '#6c5ce7'  // Purple - depriv_index
    ],
    
    // Maximum value for normalization (fallback if maxValues not provided)
    maxValue: 100,
    
    // Per-parameter max values (computed from aggregated grid in onAggregate)
    // This ensures each parameter is normalized to its own scale based on actual aggregated values
    maxValues: maxValuesPerParameter,
    
    // Normalize each parameter independently using its own max value
    normalizePerParameter: true,
    
    // Aggregation mode: 'sum' or 'average'
    // Use 'average' for percentages (most of your parameters)
    // Use 'sum' for totals (like pv_annualgen if it represents total generation)
    aggregationMode: 'average',
    
    // Number of segments (should match selected_parameters length)
    numSegments: 8,
    
    // Padding around the glyph
    padding: 2
  };

  const gridLayer = new ScreenGridLayerGL({
    data,
    // Use lat/long from your data structure
    getPosition: (d) => [d.long, d.lat],
    // Use score or another aggregated value for cell weighting
    getWeight: (d) => d.score || 0,
    cellSizePixels: 60,
    colorScale: (v) => [255 * v, 200 * (1 - v), 50, 220],
    enableGlyphs: true,
    glyphSize: 0.8,
    onAggregate: (gridData) => {
      // Compute max values per parameter from the aggregated grid
      // This is similar to your postAggrFn but computes max values across all cells
      maxValuesPerParameter = computeMaxValuesFromGrid(
        gridData, 
        parameters, 
        roseChartConfig.aggregationMode
      );
      console.log('Computed max values per parameter from aggregated grid:', maxValuesPerParameter);
      
      // Update the config with new max values
      roseChartConfig.maxValues = maxValuesPerParameter;
    },
    onDrawCell: (ctx, x, y, normVal, cellInfo) => {
      // Call the Nightingale Rose Chart function with config
      drawNightingaleRoseChart(ctx, x, y, normVal, cellInfo, roseChartConfig);
    },
    onHover: ({ cell }) => {
      if (cell.cellData && cell.cellData.length > 0) {
        // Aggregate values for display
        const avgPvGen = cell.cellData.reduce((sum, item) => sum + (item.data.pv_annualgen || 0), 0) / cell.cellData.length;
        const avgFuelPoverty = cell.cellData.reduce((sum, item) => sum + (item.data.fuel_poverty || 0), 0) / cell.cellData.length;
        const avgScore = cell.cellData.reduce((sum, item) => sum + (item.data.score || 0), 0) / cell.cellData.length;
        
        console.log(`Cell: ${cell.cellData.length} points, Avg PV Gen: ${avgPvGen.toFixed(2)}, Avg Fuel Poverty: ${avgFuelPoverty.toFixed(2)}, Avg Score: ${avgScore.toFixed(2)}`);
      }
    },
    onClick: ({ cell }) => {
      if (cell.cellData && cell.cellData.length > 0) {
        // Show detailed info for clicked cell
        const params = roseChartConfig.selected_parameters;
        const info = params.map(param => {
          const sum = cell.cellData.reduce((s, item) => s + (item.data[param] || 0), 0);
          const avg = sum / cell.cellData.length;
          return `${param}: ${avg.toFixed(2)}`;
        }).join('\n');
        
        alert(`Cell Details:\nData Points: ${cell.cellData.length}\n\n${info}`);
      }
    }
  });

  map.addLayer(gridLayer);
});

